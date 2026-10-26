// Firmware v2 against the real Hub: the tally logic of firmware-v2 runs on
// the computer (firmware-v2/sim) and talks UDP to dist/server.js. Checks the
// v2 hello, the colours, highlight, a lost Hub and the reconnect.
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

let hub, sim, client
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
  await new Promise((resolve, reject) => { client.once('connect', resolve); client.once('connect_error', reject) })
  offset = frames.length
  await companion(base, { programs: ['1'], previews: [] })
  await waitFor(() => frames.at(-1)?.text === 'O255/000/000 S255/000/000', 5000, 'Program red after the Hub restart')

  console.log(`PASS firmware v2 ${firmwareVersion} (simulated) with the real Hub: v2 hello, UNKNOWN, Program, Preview, AUX, highlight, lost Hub, reconnect`)
  console.log(`Frames seen: ${frames.length}`)
}

async function cleanup() {
  if (client) client.close()
  if (sim) sim.kill('SIGKILL')
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
