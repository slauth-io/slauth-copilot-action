import * as core from '@actions/core'
import axios from 'axios'
import {spawn} from 'child_process'
import {chmodSync, createWriteStream} from 'fs'
import {join} from 'path'

import * as stream from 'stream'
import {promisify} from 'util'

const finished = promisify(stream.finished)
const BASE_SLAUTH = 'staging.app.slauth.io'
const SLAUTH_API_URL = `https://${BASE_SLAUTH}`

async function getSlauthProjectId(token: string): Promise<string> {
  const repositoryName = process.env.GITHUB_REPOSITORY
  if (!repositoryName || repositoryName === '') {
    core.error('No repository name found')
  }
  // Find from existing projects
  const {found, id} = await axios
    .post(
      `${SLAUTH_API_URL}/api/projects/findByName`,
      {name: repositoryName},
      {headers: {Authorization: `Bearer ${token}`}}
    )
    .then(({data}) => data)
    .catch(err => core.error(`Error finding project name: ${err}`))
  if (found) {
    return id
  } else {
    // Create project
    const {id} = await axios
      .post(
        `${SLAUTH_API_URL}/api/projects/`,
        {name: repositoryName},
        {headers: {Authorization: `Bearer ${token}`}}
      )
      .then(({data}) => data.id)
      .catch(err => core.error(`Error creating project: ${err}`))
  }
  return 'hello'
}

async function downloadFile(
  fileUrl: string,
  outputLocationPath: string
): Promise<any> {
  const writer = createWriteStream(outputLocationPath)
  return axios.get(fileUrl, {responseType: 'stream'}).then(({data}) => {
    data.pipe(writer)
    return finished(writer) //this is a Promise
  })
}

async function downloadSlauth(): Promise<void> {
  const copilotName = join(__dirname, 'iamcopilot-linux')
  await downloadFile(
    `https://s3.us-east-2.amazonaws.com/${BASE_SLAUTH}-binaries-2/iamcopilot-linux`,
    copilotName
  )
  chmodSync(copilotName, '755')
}

async function generatePolicy(projectId: string, token: string) {
  // TODO subs for env var
  await axios
    .post(
      `${SLAUTH_API_URL}/api/policies/generatePolicy`,
      {projectId},
      {headers: {Authorization: `Bearer ${token}`}}
    )
    .then(({data}) => {
      core.info(`Policy generated: ${JSON.stringify(data)}`)
    })
    .catch(err => {
      core.error(`Error generating policy: ${err}`)
    })
}

async function runTest(command: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const testProcess = spawn('bash', [command], {
      shell: true,
      detached: true,
      env: {
        ...process.env,
        HTTP_PROXY: 'http://localhost:10080',
        HTTPS_PROXY: 'http://localhost:10080',
        AWS_CA_BUNDLE: join(process.cwd(), '.http-mitm-proxy/certs/ca.pem')
      }
    })
    testProcess.stdout.on('data', data => {
      core.info(`Test success: ${data}`)
    })
    testProcess.stderr.on('data', data => {
      core.error(`Test failure: ${data}`)
    })
    testProcess.on('close', code => {
      core.info(`Test exited with code ${code}`)
      resolve()
    })
    testProcess.on('error', error => {
      core.error(`Test error: ${error}`)
      reject(error)
    })
  })
}

async function runSlauthStop(slauthToken: string): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const name = join(__dirname, 'iamcopilot-linux')
      const slauthProcess = spawn(name, ['stop'], {
        detached: true,
        shell: true,
        env: {
          IAM_COPILOT_TOKEN: slauthToken
        }
      })
      slauthProcess.stdout.on('data', data => {
        core.info(`Success: ${data}`)
      })
      slauthProcess.stderr.on('data', data => {
        core.error(`Error starting CLI: ${data}`)
      })
      slauthProcess.on('close', code => {
        core.info(`Slauth CLI exited with code ${code}`)
        resolve()
      })
      slauthProcess.on('error', error => {
        core.error(`Slauth CLI error: ${error}`)
        reject(error)
      })
    } catch (error) {
      if (error instanceof Error) core.setFailed(error.message)
      reject(error)
    }
  })
}

async function runSlauth(
  slauthToken: string,
  slauthProjectId: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const name = join(__dirname, 'iamcopilot-linux')
      const slauthProcess = spawn(name, ['start', slauthProjectId], {
        detached: true,
        shell: true,
        env: {
          IAM_COPILOT_TOKEN: slauthToken
        }
      })
      slauthProcess.stdout.on('data', data => {
        core.info(`Success: ${data}`)
      })
      slauthProcess.stderr.on('data', data => {
        core.error(`Error starting CLI: ${data}`)
      })
      slauthProcess.on('close', code => {
        core.info(`Slauth CLI exited with code ${code}`)
        resolve()
      })
      slauthProcess.on('error', error => {
        core.error(`Slauth CLI error: ${error}`)
        reject(error)
      })
    } catch (error) {
      if (error instanceof Error) core.setFailed(error.message)
      reject(error)
    }
  })
}

async function runMain(): Promise<void> {
  core.saveState('slauth-post', 'true')
  try {
    const slauthToken = core.getInput('slauth_token')
    const slauthProjectId = await getSlauthProjectId(slauthToken)
    const run = core.getInput('run')
    // Download Slauth CLI
    await downloadSlauth()
    core.info('Slauth CLI downloaded')
    // Run Slauth CLI
    await runSlauth(slauthToken, slauthProjectId)
    core.info(`IAM Copilot Running`)
    core.setOutput('slauth_policy', 'my_policy')
    await runTest(run)
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}

async function runPost(): Promise<void> {
  const slauthToken = core.getInput('slauth_token')
  const slauthProjectId = await getSlauthProjectId(slauthToken)
  await runSlauthStop(slauthToken)
  await generatePolicy(slauthProjectId, slauthToken)
}

const SLAUTH_POST = core.getState('slauth-post')

if (SLAUTH_POST === 'true') {
  runPost()
} else {
  runMain()
}
