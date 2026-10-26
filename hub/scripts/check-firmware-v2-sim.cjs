// Firmware v2 against the real Hub: the tally logic of firmware-v2 runs on
// the computer (firmware-v2/sim) and talks UDP to dist/server.js. Checks the
// v2 hello, the colours, highlight, a lost Hub and the reconnect, then the
// device list, pairing, the crew password, a duplicate name and unpairing (#28).
// Build first: npm run build:backend && make -C ../firmware-v2/sim
'use strict'
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const net = require('node:net')
const { spawn } = require('node:child_process')
const io = require('socket.io-client')

const root = path.resolve(__dirname, '..')
const simBinary = path.resolve(root, '../firmware-v2/sim/.build/gc-tally-sim')
const firmwareVersion = fs.readFileSync(path.resolve(root, '../firmware-v2/platformio.ini'), 'utf8').match(/^firmware_version = (.+)$/m)[1]
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gc-tally-v2-'))
const configFile = path.join(tmp, 'config.json')
const settingsFile = path.join(tmp, 'tally-settings.ini')
fs.writeFileSync(configFile, JSON.stringify({ mixer: 'companion' }))
fs.writeFileSync(settingsFile, 'station.ssid=Simulated\nhub.ip=127.0.0.1\nhub.port=7411\ntally.name=SimCam\noperator.ws2812=16 grb\n')

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

let hub, sim, client, twin
let hubOutput = ''
const frames = [] // {at, text}
const simOutput = []

async function getFreePort() {
  const server = net.createServer()
  await new Promise((resolve, reject) => server.once('error', reject).listen(0, '127.0.0.1', resolve))
  const port = server.address().port
  await new Promise(resolve => server.close(resolve))
  return port
}

async function startHub(port) {
  hubOutput = ''
  hub = spawn(process.execPath, [path.join(root, 'dist/server.js'), '--env=production'], {
    cwd: root,
    env: { ...process.env, CONFIG_FILE: configFile, PORT: String(port), NODE_ENV: 'production' },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  hub.stdout.on('data', data => { hubOutput += data.toString() })
  hub.stderr.on('data', data => { hubOutput += data.toString() })
  await waitFor(() => hubOutput.includes('Web Server available') && hubOutput.includes('Listening for Tallies'), 8000, 'Hub startup: ' + hubOutput)
}

async function stopHub() {
  const exited = new Promise(resolve => hub.once('exit', resolve))
  hub.kill('SIGKILL')
  await exited
}

const framesSince = offset => frames.slice(offset).map(frame => frame.text)
const sawFrame = (offset, text) => framesSince(offset).includes(text)

async function companion(base, state) {
  const response = await fetch(base + '/api/companion/tally', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(state) })
  assert.equal(response.status, 200, 'Companion POST: ' + (await response.text()))
}

async function run() {
  assert.ok(fs.existsSync(path.join(root, 'dist/server.js')), 'Run npm run build:backend first')
  assert.ok(fs.existsSync(simBinary), 'Run make -C firmware-v2/sim first')
  const port = await getFreePort()
  const base = 'http://127.0.0.1:' + port
  await startHub(port)

  sim = spawn(simBinary, [settingsFile, 'c0ffee'], { stdio: ['ignore', 'pipe', 'pipe'] })
  let partial = ''
  sim.stdout.on('data', data => {
    const lines = (partial + data.toString()).split('\n')
    partial = lines.pop()
    for (const line of lines) {
      simOutput.push(line)
      if (line.startsWith('frame ')) frames.push({ at: Date.now(), text: line.slice(6) })
    }
  })
  sim.stderr.on('data', data => simOutput.push('stderr ' + data.toString()))

  let tallies = []
  client = io(base, { transports: ['websocket'], reconnection: false })
  client.on('tally.state', state => { tallies = state.tallies })
  await new Promise((resolve, reject) => { client.once('connect', resolve); client.once('connect_error', reject) })
  client.emit('events.tally.subscribe')

  // 1. the Hub knows it is a v2 tally
  const tally = await waitFor(() => tallies.find(t => t.name === 'SimCam' && t.type === 'udp' && t.state === 1 && t.device), 4000, 'SimCam with device info')
  assert.deepEqual(tally.device, { protocol: 1, id: 'c0ffee', firmware: firmwareVersion, hardware: 'esp8266', capabilities: ['ws2812', 'pwm'] })

  // 2. not patched: the operator light is dark (idle hidden by default)
  await waitFor(() => sawFrame(0, 'O000/000/000 S000/000/000'), 3000, 'unpatched release frame')

  // 3. patched while the mixer is silent: UNKNOWN blinks blue
  let offset = frames.length
  client.emit('tally.patch', 'SimCam', 'udp', ['1'])
  await waitFor(() => sawFrame(offset, 'O000/000/255 S000/000/000') && sawFrame(offset, 'O000/000/077 S000/000/000'), 4000, 'UNKNOWN blue blink')

  // 4. Program, Preview, AUX from Companion
  offset = frames.length
  await companion(base, { programs: ['1'], previews: ['2'] })
  await waitFor(() => frames.at(-1)?.text === 'O255/000/000 S255/000/000', 3000, 'Program red')
  offset = frames.length
  await companion(base, { programs: ['2'], previews: ['1'] })
  await waitFor(() => frames.at(-1)?.text === 'O000/255/000 S000/255/000', 3000, 'Preview green')
  await companion(base, { programs: ['2'], previews: ['1'], auxes: ['1'] })
  await waitFor(() => frames.at(-1)?.text === 'O255/080/000 S000/000/000', 3000, 'AUX orange beats preview')

  // 5. keep-alives do not restart or flicker a static colour
  offset = frames.length
  await delay(1500)
  assert.deepEqual(framesSince(offset), [], 'a static colour must not be redrawn by keep-alives')

  // 6. highlight blinks white and dim white
  offset = frames.length
  client.emit('tally.highlight', 'SimCam', 'udp')
  await waitFor(() => sawFrame(offset, 'O255/255/255 S255/255/255') && sawFrame(offset, 'O077/077/077 S077/077/077'), 3000, 'highlight')
  await waitFor(() => frames.at(-1)?.text === 'O255/080/000 S000/000/000', 6000, 'back to AUX after highlight')

  // 7. the Hub disappears: after 3 s the tally blinks blue every 150 ms
  offset = frames.length
  const stoppedAt = Date.now()
  await stopHub()
  await waitFor(() => framesSince(offset).filter(text => text.startsWith('O000/000/')).length >= 6, 6000, 'waiting-for-Hub blink')
  const blink = frames.slice(offset)
  assert.ok(blink[0].at - stoppedAt >= 2500, `the lost Hub must be shown after about 3 s, not after ${blink[0].at - stoppedAt} ms`)
  const steps = blink.slice(1, 6).map((frame, i) => frame.at - blink[i].at)
  assert.ok(steps.some(step => step >= 100 && step <= 200), 'waiting-for-Hub steps are 150 ms: ' + steps)

  // 8. the Hub comes back with the saved patch: the tally follows it again
  await startHub(port)
  client.close()
  client = io(base, { transports: ['websocket'], reconnection: false })
  client.on('tally.state', state => { tallies = state.tallies })
  await new Promise((resolve, reject) => { client.once('connect', resolve); client.once('connect_error', reject) })
  client.emit('events.tally.subscribe')
  offset = frames.length
  await companion(base, { programs: ['1'], previews: [] })
  await waitFor(() => frames.at(-1)?.text === 'O255/000/000 S255/000/000', 5000, 'Program red after the Hub restart')

  // 9. the device list shows the tally, not paired
  let devices
  client.on('devices.state', state => { devices = state })
  client.emit('devices.get')
  await waitFor(() => devices?.devices.find(d => d.id === 'c0ffee' && d.status === 'unpaired' && d.online), 4000, 'unpaired tally in the device list')
  const hubId = devices.hubId

  // 10. identify: white on the operator light only
  offset = frames.length
  client.emit('device.identify', 'c0ffee')
  await waitFor(() => sawFrame(offset, 'O255/255/255 S000/000/000'), 3000, 'identify blink')

  // 11. pairing: the tally keeps the Hub, the Hub keeps the token
  client.emit('device.pair', 'c0ffee')
  await waitFor(() => simOutput.includes(`pairing paired hub=${hubId} crew=`), 4000, 'tally paired')
  await waitFor(() => devices.devices.find(d => d.id === 'c0ffee')?.status === 'paired', 4000, 'paired in the device list')
  await waitFor(() => (JSON.parse(fs.readFileSync(configFile, 'utf8')).pairedDevices || []).some(d => d.id === 'c0ffee'), 4000, 'pairing saved by the Hub')

  // 12. the crew password reaches the paired tally, signed and hidden
  client.emit('crewPassword.set', 'crew pass 1!')
  await waitFor(() => simOutput.includes(`pairing paired hub=${hubId} crew=crew pass 1!`), 6000, 'crew password on the tally')
  await waitFor(() => devices.devices.find(d => d.id === 'c0ffee')?.crewPassword === 'synced', 4000, 'crew password confirmed')
  assert.ok(!simOutput.some(line => line.startsWith('reply') && line.includes('refused')), 'no refusals: ' + simOutput.filter(l => l.startsWith('reply')))

  // 13. a second tally with the same name does not take the lights over
  const twinFrames = []
  twin = spawn(simBinary, [settingsFile, 'bad123'], { stdio: ['ignore', 'pipe', 'pipe'] })
  twin.stdout.on('data', data => twinFrames.push(...data.toString().split('\n').filter(l => l.startsWith('frame '))))
  await waitFor(() => devices.devices.filter(d => d.name === 'SimCam' && d.duplicateName).length === 2, 5000, 'duplicate name in the device list')
  await delay(1500)
  const bound = tallies.find(t => t.name === 'SimCam' && t.type === 'udp')
  assert.equal(bound.device.id, 'c0ffee', 'the first tally keeps its name')
  assert.ok(!twinFrames.includes('frame O255/000/000 S255/000/000'), 'the twin must not get the program colour')
  twin.kill('SIGKILL')
  twin = undefined

  // 14. unpairing, signed with the current challenge
  client.emit('device.unpair', 'c0ffee')
  await waitFor(() => simOutput.includes('pairing unpaired hub= crew='), 4000, 'tally unpaired')
  await waitFor(() => devices.devices.find(d => d.id === 'c0ffee')?.status === 'unpaired', 4000, 'unpaired in the device list')
  await waitFor(() => !(JSON.parse(fs.readFileSync(configFile, 'utf8')).pairedDevices || []).length, 4000, 'pairing removed by the Hub')

  console.log(`PASS firmware v2 ${firmwareVersion} (simulated) with the real Hub: v2 hello, UNKNOWN, Program, Preview, AUX, highlight, lost Hub, reconnect, device list, identify, pairing, crew password, duplicate name, unpairing`)
  console.log(`Frames seen: ${frames.length}`)
}

async function cleanup() {
  if (client) client.close()
  if (sim) sim.kill('SIGKILL')
  if (twin) twin.kill('SIGKILL')
  if (hub && hub.exitCode === null) hub.kill('SIGKILL')
  fs.rmSync(tmp, { recursive: true, force: true })
}

run().then(cleanup, async error => {
  console.error(error)
  console.error('--- simulator ---\n' + simOutput.slice(-30).join('\n'))
  console.error('--- Hub ---\n' + hubOutput.slice(-3000))
  await cleanup()
  process.exit(1)
})
