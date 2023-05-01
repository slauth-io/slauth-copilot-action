import * as process from 'process'
import * as cp from 'child_process'
import * as path from 'path'
import {expect, test} from '@jest/globals'

// shows how the runner will run a javascript action with env / stdout protocol
test('test runs', () => {
  process.env['INPUT_SLAUTH_TOKEN'] =
    'sla_eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYXV0aGVudGljYXRlZCIsImVtYWlsIjoiam9hb0BzbGF1dGguaW8iLCJzdWIiOiIzOWU0YzFhMC0zZjMzLTQ1NmQtYTE1Yy0yYzJmOWU5MGI2MGMiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiaWF0IjoxNjgyOTQzMDQzLCJleHAiOjE3MTQ0NzkwNDN9.tf7c23efkk1GaWdWomsdMvS7_i7grw6CS3vI3J4FaVk'
  process.env['INPUT_SLAUTH_PROJECT_ID'] =
    '9944a0d2-a13d-4ae7-9276-518858194f3e'
  const np = process.execPath
  const ip = path.join(__dirname, '..', 'lib', 'main.js')
  const options: cp.ExecFileSyncOptions = {
    env: process.env
  }
  console.log(cp.execFileSync(np, [ip], options).toString())
})
