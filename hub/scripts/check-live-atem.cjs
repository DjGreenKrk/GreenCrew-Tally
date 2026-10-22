// Live check against a real ATEM (or scripts/atem-simulator.cjs): runs the
// built Hub with the ATEM mixer, switches program, preview and aux through a
// second ATEM connection and checks the frames a UDP tally on input 2 gets.
// The switcher state is restored at the end.
//
// Usage: ATEM_IP=192.168.10.240 node scripts/check-live-atem.cjs
'use strict'
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const dgram = require('node:dgram')
const { spawn } = require('node:child_process')
const io = require('socket.io-client')
const { Atem } = require('atem-connection')

const atemIp = process.env.ATEM_IP
const atemPort = Number(process.env.ATEM_PORT || 9910)
if (!atemIp) {
    console.error('Set ATEM_IP')
    process.exit(2)
}
const root = path.resolve(__dirname, '..')
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gc-tally-atem-'))
const configFile = path.join(tmp, 'config.json')
fs.writeFileSync(configFile, JSON.stringify({ mixer: 'atem', atem: { ip: atemIp, port: atemPort } }))
const tallyPort = 7411 // fixed in the Hub
const httpPort = 13000 + Math.floor(Math.random() * 1000)

const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
const waitFor = async (fn, ms, name) => {
    const end = Date.now() + ms
    while (Date.now() < end) {
        if (fn()) return
        await delay(50)
    }
    throw new Error('Timed out waiting for ' + name)
}

let hub, client, udp, controller, original
let output = ''
const frames = []
const program = []

async function step(name, change, frame) {
    const offset = frames.length
    await change()
    await waitFor(() => frames.slice(offset).some(f => f.startsWith(frame)), 3000, name)
    await delay(200)
    const expected = program[program.length - 1] || {}
    console.log(`ok  ${name}: ${frame}  (Hub: PGM ${expected.programs} PVW ${expected.previews} AUX ${expected.auxes})`)
}

async function run() {
    controller = new Atem({ disableMultithreaded: true })
    controller.on('error', () => {})
    await new Promise((resolve, reject) => {
        controller.once('connected', resolve)
        setTimeout(() => reject(new Error('ATEM not reachable at ' + atemIp)), 8000)
        controller.connect(atemIp, atemPort)
    })
    const me = controller.state.video.mixEffects[0]
    original = { program: me.programInput, preview: me.previewInput, auxes: [...controller.state.video.auxilliaries] }
    console.log(`ATEM ${controller.state.info.productIdentifier}, protocol ${controller.state.info.apiVersion}, aux buses: ${original.auxes.length}`)
    if (!original.auxes.length) throw new Error('This switcher has no aux output')

    hub = spawn(process.execPath, [path.join(root, 'dist/server.js'), '--env=production'], {
        cwd: root,
        env: { ...process.env, CONFIG_FILE: configFile, PORT: String(httpPort), NODE_ENV: 'production' },
        stdio: ['ignore', 'pipe', 'pipe'],
    })
    hub.stdout.on('data', data => { output += data })
    hub.stderr.on('data', data => { output += data })
    await waitFor(() => output.includes('Connected to ATEM'), 10000, 'Hub connected to ATEM')

    client = io('http://127.0.0.1:' + httpPort, { transports: ['websocket'], reconnection: false })
    client.on('program.state', state => program.push(state))
    await new Promise(resolve => client.once('connect', resolve))
    client.emit('events.program.subscribe')

    udp = dgram.createSocket('udp4')
    udp.on('message', packet => frames.push(packet.toString()))
    await new Promise(resolve => udp.bind(0, '127.0.0.1', resolve))
    udp.send('tally-ho "AtemCam"', tallyPort, '127.0.0.1')
    await delay(500)
    client.emit('tally.patch', 'AtemCam', 'udp', ['2'])

    const set = async (pgm, pvw, aux) => {
        await controller.changeProgramInput(pgm)
        await controller.changePreviewInput(pvw)
        await controller.setAuxSource(aux, 0)
    }
    await step('camera 2 off', () => set(1, 3, 3), 'O000/000/000')
    await step('camera 2 on aux 1', () => set(1, 3, 2), 'O255/080/000')
    await step('aux beats preview', () => set(1, 2, 2), 'O255/080/000')
    await step('preview only', () => set(1, 2, 3), 'O000/255/000')
    await step('program beats aux', () => set(2, 1, 2), 'O255/000/000')
    await step('aux shows M/E program', () => set(1, 3, 10010), 'O000/000/000')
    await step('aux shows M/E preview', () => set(1, 2, 10011), 'O255/080/000')
    console.log('PASS real ATEM → Hub → UDP tally (program, preview, aux)')
}

async function cleanup() {
    if (controller && original) {
        await controller.changeProgramInput(original.program).catch(() => {})
        await controller.changePreviewInput(original.preview).catch(() => {})
        for (const [bus, source] of original.auxes.entries()) {
            if (source !== undefined) await controller.setAuxSource(source, bus).catch(() => {})
        }
        await delay(300)
    }
    if (controller) await controller.destroy().catch(() => {})
    if (client) client.close()
    if (udp) udp.close()
    if (hub) hub.kill('SIGKILL')
    fs.rmSync(tmp, { recursive: true, force: true })
}

run()
    .catch(error => {
        console.error(error.message)
        console.error('Hub log:\n' + output.slice(-4000))
        process.exitCode = 1
    })
    .finally(() => cleanup().then(() => process.exit()))
