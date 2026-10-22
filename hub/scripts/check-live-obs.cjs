// Live check against a real OBS Studio 28+ (or scripts/obs-simulator.cjs):
// runs the built Hub with the OBS mixer, drives OBS through a second
// WebSocket connection and checks the frames a UDP tally gets.
// Needs scenes "Scene 1", "Scene 2" and "Scene 3", where "Scene 3" contains
// "Scene 1". The program scene, studio mode and transition are restored.
//
// Usage: OBS_IP=192.168.0.10 OBS_PASSWORD=... node scripts/check-live-obs.cjs
'use strict'
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const dgram = require('node:dgram')
const { spawn } = require('node:child_process')
const io = require('socket.io-client')
const { OBSWebSocket } = require('obs-websocket-js/json')

const obsIp = process.env.OBS_IP
const obsPort = Number(process.env.OBS_PORT || 4455)
const password = process.env.OBS_PASSWORD || ''
if (!obsIp) {
    console.error('Set OBS_IP (and OBS_PASSWORD if authentication is on)')
    process.exit(2)
}
const root = path.resolve(__dirname, '..')
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gc-tally-obs-'))
const configFile = path.join(tmp, 'config.json')
fs.writeFileSync(configFile, JSON.stringify({ mixer: 'obs', obs: { ip: obsIp, port: obsPort, password, liveMode: 'always' } }), { mode: 0o600 })
const tallyPort = 7411 // fixed in the Hub
const httpPort = 13000 + Math.floor(Math.random() * 1000)

const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
const waitFor = async (fn, ms, name) => {
    const end = Date.now() + ms
    while (Date.now() < end) {
        if (fn()) return
        await delay(20)
    }
    throw new Error('Timed out waiting for ' + name)
}

let hub, client, udp, controller, original
let output = ''
const frames = []
const events = []
const programStates = []

const red = 'O255/000/000', green = 'O000/255/000', off = 'O000/000/000'
const frameSince = (offset, frame) => frames.slice(offset).find(f => f.text.startsWith(frame))

async function step(name, change, frame) {
    const offset = frames.length
    const started = Date.now()
    await change()
    await waitFor(() => frameSince(offset, frame), 4000, name)
    console.log(`ok  ${name}: ${frame} after ${frameSince(offset, frame).at - started} ms`)
}

async function run() {
    controller = new OBSWebSocket()
    await controller.connect(`ws://${obsIp}:${obsPort}`, password || undefined)
    for (const type of ['CurrentProgramSceneChanged', 'SceneTransitionStarted', 'SceneTransitionEnded', 'SceneTransitionVideoEnded']) {
        controller.on(type, () => events.push(type))
    }
    const version = await controller.call('GetVersion')
    original = {
        program: (await controller.call('GetCurrentProgramScene')).currentProgramSceneName,
        studio: (await controller.call('GetStudioModeEnabled')).studioModeEnabled,
        transition: (await controller.call('GetCurrentSceneTransition')).transitionName,
        duration: (await controller.call('GetCurrentSceneTransition')).transitionDuration,
    }
    console.log(`OBS ${version.obsVersion}, obs-websocket ${version.obsWebSocketVersion}`)
    await controller.call('SetStudioModeEnabled', { studioModeEnabled: false })
    await controller.call('SetCurrentSceneTransition', { transitionName: 'Cut' })
    await controller.call('SetCurrentProgramScene', { sceneName: 'Scene 2' })

    hub = spawn(process.execPath, [path.join(root, 'dist/server.js'), '--env=production'], {
        cwd: root,
        env: { ...process.env, CONFIG_FILE: configFile, PORT: String(httpPort), NODE_ENV: 'production' },
        stdio: ['ignore', 'pipe', 'pipe'],
    })
    hub.stdout.on('data', data => { output += data })
    hub.stderr.on('data', data => { output += data })
    await waitFor(() => output.includes('Connected to OBS'), 10000, 'Hub connected to OBS')

    client = io('http://127.0.0.1:' + httpPort, { transports: ['websocket'], reconnection: false })
    await new Promise(resolve => client.once('connect', resolve))
    client.on('program.state', state => programStates.push(state))
    client.emit('events.program.subscribe')
    udp = dgram.createSocket('udp4')
    udp.on('message', packet => frames.push({ text: packet.toString(), at: Date.now() }))
    await new Promise(resolve => udp.bind(0, '127.0.0.1', resolve))
    udp.send('tally-ho "ObsCam"', tallyPort, '127.0.0.1')
    await delay(500)
    client.emit('tally.patch', 'ObsCam', 'udp', ['Scene 1'])

    const cut = scene => controller.call('SetCurrentProgramScene', { sceneName: scene })
    await step('Scene 1 not used', async () => {}, off)
    await step('cut to Scene 1', () => cut('Scene 1'), red)
    await step('cut away', () => cut('Scene 2'), off)
    await step('Scene 1 nested in Scene 3', () => cut('Scene 3'), red)
    const scene1Item = (await controller.call('GetSceneItemId', { sceneName: 'Scene 3', sourceName: 'Scene 1' })).sceneItemId
    await step('nested Scene 1 hidden', () => controller.call('SetSceneItemEnabled', { sceneName: 'Scene 3', sceneItemId: scene1Item, sceneItemEnabled: false }), off)
    await controller.call('SetSceneItemEnabled', { sceneName: 'Scene 3', sceneItemId: scene1Item, sceneItemEnabled: true })
    await cut('Scene 1')
    await delay(500)

    // a 1 s fade from Scene 1: it stays on air until the transition ends
    await controller.call('SetCurrentSceneTransition', { transitionName: 'Fade' })
    await controller.call('SetCurrentSceneTransitionDuration', { transitionDuration: 1000 })
    events.length = 0
    const offset = frames.length
    const started = Date.now()
    await cut('Scene 2')
    await waitFor(() => frameSince(offset, off), 4000, 'end of the fade')
    const offAfter = frameSince(offset, off).at - started
    console.log(`    OBS events: ${events.join(' → ')}`)
    if (offAfter < 800) throw new Error(`Scene 1 went off ${offAfter} ms into a 1000 ms fade`)
    console.log(`ok  fade away keeps Scene 1 on air: off after ${offAfter} ms`)
    await delay(500)
    const fadeIn = frames.length
    const fadeInStarted = Date.now()
    await cut('Scene 1')
    await waitFor(() => frameSince(fadeIn, red), 4000, 'start of the fade to Scene 1')
    const redAfter = frameSince(fadeIn, red).at - fadeInStarted
    if (redAfter > 400) throw new Error(`Scene 1 went on air ${redAfter} ms into a 1000 ms fade, expected at its start`)
    console.log(`ok  fade to Scene 1 is on air at its start: red after ${redAfter} ms`)
    await delay(300)
    const during = programStates[programStates.length - 1].programs
    if (!(during.includes('Scene 1') && during.includes('Scene 2'))) throw new Error('During the fade the Hub has programs ' + during)
    console.log(`ok  during the fade both scenes are on air: ${during.join(', ')}`)
    await delay(1300)
    await controller.call('SetCurrentSceneTransition', { transitionName: 'Cut' })
    await cut('Scene 2')
    await delay(300)

    await step('studio mode, Scene 1 on preview', async () => {
        await controller.call('SetStudioModeEnabled', { studioModeEnabled: true })
        await controller.call('SetCurrentPreviewScene', { sceneName: 'Scene 1' })
    }, green)
    await step('studio mode off', () => controller.call('SetStudioModeEnabled', { studioModeEnabled: false }), off)
    console.log('PASS real OBS → Hub → UDP tally (cut, nested scenes, fade, studio mode)')
}

async function cleanup() {
    if (controller && original) {
        await controller.call('SetStudioModeEnabled', { studioModeEnabled: original.studio }).catch(() => {})
        await controller.call('SetCurrentSceneTransition', { transitionName: original.transition }).catch(() => {})
        if (original.duration) await controller.call('SetCurrentSceneTransitionDuration', { transitionDuration: original.duration }).catch(() => {})
        await controller.call('SetCurrentProgramScene', { sceneName: original.program }).catch(() => {})
    }
    if (controller) await controller.disconnect().catch(() => {})
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
