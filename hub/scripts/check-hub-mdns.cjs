// The Hub announces itself over mDNS the way firmware v2 looks for it (#28):
// a PTR query for _gctally._udp.local must lead to the SRV (tally port, host
// gctally-hub-<id>.local), the TXT (v, id) and an IPv4 address. Stopping the
// Hub says goodbye (TTL 0). The page state says "active".
// Build first: npm run build:backend
'use strict'
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const net = require('node:net')
const { spawn } = require('node:child_process')
const io = require('socket.io-client')
const multicastDns = require('multicast-dns')

const root = path.resolve(__dirname, '..')
const hubId = '0a1b2c3d'
const service = '_gctally._udp.local'
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gc-tally-mdns-'))
const configFile = path.join(tmp, 'config.json')
fs.writeFileSync(configFile, JSON.stringify({ mixer: 'companion', hubId }))

const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
const waitFor = async (fn, ms, name) => {
  const end = Date.now() + ms
  while (Date.now() < end) {
    const value = fn()
    if (value) return value
    await delay(50)
  }
  throw new Error('Timed out waiting for ' + name)
}

async function getFreePort() {
  const server = net.createServer()
  await new Promise((resolve, reject) => server.once('error', reject).listen(0, '127.0.0.1', resolve))
  const port = server.address().port
  await new Promise(resolve => server.close(resolve))
  return port
}

let hub, client
let hubOutput = ''
const mdns = multicastDns()
const records = []
mdns.on('response', packet => {
  for (const record of [...packet.answers, ...packet.additionals]) records.push(record)
})
const find = (type, name, filter = () => true) =>
  records.find(record => record.type === type && record.name.toLowerCase() === name.toLowerCase() && filter(record))

async function run() {
  assert.ok(fs.existsSync(path.join(root, 'dist/server.js')), 'Run npm run build:backend first')
  const port = await getFreePort()
  hub = spawn(process.execPath, [path.join(root, 'dist/server.js'), '--env=production'], {
    cwd: root,
    env: { ...process.env, CONFIG_FILE: configFile, PORT: String(port), NODE_ENV: 'production' },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  hub.stdout.on('data', data => { hubOutput += data.toString() })
  hub.stderr.on('data', data => { hubOutput += data.toString() })
  await waitFor(() => hubOutput.includes('Web Server available'), 8000, 'Hub startup: ' + hubOutput)
  assert.match(hubOutput, /Announcing the Hub over mDNS as "GC Tally Hub 0a1b2c3d"/)

  // ask like a tally does, until the Hub answers
  const ptr = await waitFor(() => {
    mdns.query({ questions: [{ name: service, type: 'PTR' }] })
    return find('PTR', service, record => record.ttl > 0)
  }, 8000, 'PTR answer for ' + service)
  const instance = ptr.data
  assert.equal(instance, `GC Tally Hub ${hubId}.${service}`)

  const srv = await waitFor(() => {
    mdns.query({ questions: [{ name: instance, type: 'SRV' }, { name: instance, type: 'TXT' }] })
    return find('SRV', instance)
  }, 5000, 'SRV of ' + instance)
  assert.equal(srv.data.port, 7411)
  assert.equal(srv.data.target, `gctally-hub-${hubId}.local`)

  const txt = await waitFor(() => find('TXT', instance), 5000, 'TXT of ' + instance)
  const pairs = Object.fromEntries(txt.data.map(entry => entry.toString().split('=')))
  assert.equal(pairs.v, '1')
  assert.equal(pairs.id, hubId)

  const address = await waitFor(() => {
    mdns.query({ questions: [{ name: srv.data.target, type: 'A' }] })
    return find('A', srv.data.target)
  }, 5000, 'A record of ' + srv.data.target)
  assert.match(address.data, /^\d+\.\d+\.\d+\.\d+$/)

  client = io('http://127.0.0.1:' + port, { transports: ['websocket'] })
  const state = await new Promise((resolve, reject) => {
    client.on('connect_error', reject)
    client.on('discovery.state', resolve)
    client.emit('discovery.get')
  })
  assert.deepEqual(state, { status: 'active', hubId, serviceName: instance, port: 7411 })
  client.close()

  // goodbye on a normal stop
  records.length = 0
  const exited = new Promise(resolve => hub.once('exit', resolve))
  hub.kill('SIGTERM')
  await exited
  await waitFor(() => find('PTR', service, record => record.ttl === 0), 3000, 'goodbye (PTR with TTL 0)')

  console.log(`PASS Hub mDNS: ${instance} -> ${srv.data.target}:${srv.data.port} (${address.data}), TXT id=${pairs.id}, goodbye on stop`)
}

run().then(() => {
  mdns.destroy()
  process.exit(0)
}, error => {
  console.error('FAIL', error && error.stack || error)
  console.error('--- Hub output ---\n' + hubOutput)
  if (client) client.close()
  if (hub && hub.exitCode === null) hub.kill('SIGKILL')
  mdns.destroy()
  process.exit(1)
})
