import * as core from '@actions/core'
import axios from 'axios'
import {spawn} from 'child_process'

async function downloadSlauth(): Promise<void> {
  const os = core.getInput('os')
  const arch = core.getInput('arch')
  const version = core.getInput('version')
  // TODO
}

async function runSlauth(
  slauthToken: string,
  slauthProjectId: string
): Promise<void> {
  try {
    console.log(slauthToken)
    const p = spawn('./dist/iamcopilot-linux', ['start', slauthProjectId], {
      detached: true,
      shell: true,
      env: {
        IAM_COPILOT_TOKEN: slauthToken
      }
    })
    core.exportVariable('HTTP_PROXY', 'http://127.0.0.1:10080')
    core.exportVariable('HTTPS_PROXY', 'http://127.0.0.1:10080')
    core.exportVariable(
      'AWS_CA_BUNDLE',
      '/home/joao/slauth/git/slauth-copilot-action/.http-mitm-proxy/certs/ca.pem'
    )
    p.stdout.on('data', data => {
      console.log(`stdout: ${data}`)
    })
    p.stderr.on('data', data => {
      console.error(`stderr: ${data}`)
    })
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}

async function run(): Promise<void> {
  try {
    const slauthToken = core.getInput('slauth_token')
    const slauthProjectId = core.getInput('slauth_project_id')
    // Download Slauth CLI
    await downloadSlauth()
    const slauth = core.info('Slauth CLI downloaded')
    // Run Slauth CLI
    await runSlauth(slauthToken, slauthProjectId)
    core.setOutput('slauth_policy', 'my_policy')
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}

run()
