#!/usr/bin/env node
/*
 * A minimal fake OBS Studio (obs-websocket 5 server, JSON encoding) for testing
 * the Hub without OBS. Used by the ObsConnector tests and runnable by hand:
 *
 *   node scripts/obs-simulator.cjs [--port 4455] [--password secret]
 *
 * Commands on stdin:
 *   cut <scene>              switch program without a transition
 *   fade <scene> [ms]        transition to a scene (default 1000 ms)
 *   preview <scene>          change the preview scene (enters studio mode)
 *   studio on|off            studio mode
 *   stream on|off, record on|off|pause|resume
 *   state                    print the current state
 *
 * Scenes are "Scene 1" to "Scene 3"; "Scene 3" contains "Scene 1".
 */
'use strict'
const crypto = require('node:crypto')
const WebSocket = require('ws')

const sha256 = text => crypto.createHash('sha256').update(text).digest('base64')

class FakeObs {
    constructor({ password } = {}) {
        this.password = password
        // top to bottom as in the OBS scene list; children are nested scene sources
        this.scenes = [
            { name: 'Scene 1', children: [] },
            { name: 'Scene 2', children: [] },
            { name: 'Scene 3', children: [{ name: 'Scene 1', enabled: true }] },
        ]
        this.program = 'Scene 1'
        this.preview = null
        this.streaming = false
        this.recording = false
        this.recordPaused = false
        this.clients = new Set()
        this.requests = []
    }

    start(port = 0) {
        return new Promise(resolve => {
            this.server = new WebSocket.Server({ port }, () => {
                this.port = this.server.address().port
                resolve(this.port)
            })
            this.server.on('connection', socket => this.onConnection(socket))
        })
    }

    stop() {
        for (const socket of this.clients) socket.terminate()
        return new Promise(resolve => this.server ? this.server.close(() => resolve()) : resolve())
    }

    // closes every client connection, like OBS quitting
    dropClients() {
        for (const socket of this.clients) socket.close(1001, 'OBS closed')
    }

    onConnection(socket) {
        const challenge = crypto.randomBytes(16).toString('base64')
        const salt = crypto.randomBytes(16).toString('base64')
        const hello = { obsWebSocketVersion: '5.5.0', rpcVersion: 1 }
        if (this.password) hello.authentication = { challenge, salt }
        socket.send(JSON.stringify({ op: 0, d: hello }))
        socket.on('message', raw => {
            const { op, d } = JSON.parse(raw.toString())
            if (op === 1) {
                if (this.password && d.authentication !== sha256(sha256(this.password + salt) + challenge)) {
                    socket.close(4009, 'Authentication failed.')
                    return
                }
                this.clients.add(socket)
                socket.on('close', () => this.clients.delete(socket))
                socket.send(JSON.stringify({ op: 2, d: { negotiatedRpcVersion: 1 } }))
            } else if (op === 6 && this.clients.has(socket)) {
                this.requests.push(d.requestType)
                const [ok, responseData] = this.handle(d.requestType, d.requestData || {})
                socket.send(JSON.stringify({ op: 7, d: {
                    requestType: d.requestType,
                    requestId: d.requestId,
                    requestStatus: ok ? { result: true, code: 100 } : { result: false, code: responseData.code, comment: responseData.comment },
                    responseData: ok ? responseData : undefined,
                } }))
            }
        })
    }

    handle(type, data) {
        switch (type) {
            case 'GetSceneList':
                return [true, {
                    currentProgramSceneName: this.program,
                    currentPreviewSceneName: this.preview,
                    // obs-websocket lists the bottom scene first
                    scenes: this.scenes.map((scene, i) => ({ sceneName: scene.name, sceneIndex: this.scenes.length - 1 - i })).reverse(),
                }]
            case 'GetSceneItemList': {
                const scene = this.scenes.find(s => s.name === data.sceneName)
                if (!scene) return [false, { code: 600, comment: 'No source was found' }]
                return [true, { sceneItems: [
                    { sourceName: 'Camera', sourceType: 'OBS_SOURCE_TYPE_INPUT', sceneItemEnabled: true },
                    ...scene.children.map(child => ({ sourceName: child.name, sourceType: 'OBS_SOURCE_TYPE_SCENE', sceneItemEnabled: child.enabled })),
                ] }]
            }
            case 'GetCurrentPreviewScene':
                if (this.preview === null) return [false, { code: 506, comment: 'Studio mode is not active.' }]
                return [true, { currentPreviewSceneName: this.preview }]
            case 'GetStreamStatus':
                return [true, { outputActive: this.streaming }]
            case 'GetRecordStatus':
                return [true, { outputActive: this.recording, outputPaused: this.recordPaused }]
            default:
                return [false, { code: 204, comment: `${type} is not implemented in the simulator` }]
        }
    }

    event(eventType, eventData = {}) {
        const message = JSON.stringify({ op: 5, d: { eventType, eventIntent: 0, eventData } })
        for (const socket of this.clients) socket.send(message)
    }

    cut(scene) {
        this.program = scene
        this.event('CurrentProgramSceneChanged', { sceneName: scene })
    }

    // OBS announces the new scene and the transition in either order
    transitionStart(scene, sceneFirst = true) {
        if (sceneFirst) this.cut(scene)
        this.event('SceneTransitionStarted', { transitionName: 'Fade' })
        if (!sceneFirst) this.cut(scene)
    }

    transitionEnd() {
        this.event('SceneTransitionEnded', { transitionName: 'Fade' })
        this.event('SceneTransitionVideoEnded', { transitionName: 'Fade' })
    }

    setPreview(scene) {
        if (this.preview === null) this.setStudioMode(true, scene)
        this.preview = scene
        this.event('CurrentPreviewSceneChanged', { sceneName: scene })
    }

    setStudioMode(enabled, preview = this.program) {
        this.preview = enabled ? preview : null
        this.event('StudioModeStateChanged', { studioModeEnabled: enabled })
    }

    setScenes(scenes) {
        this.scenes = scenes
        this.event('SceneListChanged', { scenes: [] })
    }

    setChildEnabled(sceneName, childName, enabled) {
        const scene = this.scenes.find(s => s.name === sceneName)
        scene.children.find(c => c.name === childName).enabled = enabled
        this.event('SceneItemEnableStateChanged', { sceneName, sceneItemId: 1, sceneItemEnabled: enabled })
    }

    // OBS switches the program scene before it reports the new collection
    changeSceneCollection(scenes, program) {
        this.event('CurrentSceneCollectionChanging', { sceneCollectionName: 'Old' })
        this.scenes = scenes
        this.cut(program)
        this.event('CurrentSceneCollectionChanged', { sceneCollectionName: 'New' })
    }

    setStreaming(active) {
        this.streaming = active
        this.event('StreamStateChanged', { outputActive: active, outputState: active ? 'OBS_WEBSOCKET_OUTPUT_STARTED' : 'OBS_WEBSOCKET_OUTPUT_STOPPED' })
    }

    setRecording(state) {
        this.recording = state !== 'stop'
        this.recordPaused = state === 'pause'
        const outputState = { start: 'STARTED', stop: 'STOPPED', pause: 'PAUSED', resume: 'RESUMED' }[state]
        this.event('RecordStateChanged', { outputActive: this.recording, outputState: 'OBS_WEBSOCKET_OUTPUT_' + outputState, outputPath: null })
    }
}

module.exports = { FakeObs }

if (require.main === module) {
    const readline = require('node:readline')
    const args = process.argv.slice(2)
    const option = name => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : undefined }
    const obs = new FakeObs({ password: option('password') })
    const print = () => console.log(`PGM ${obs.program}  PVW ${obs.preview ?? '-'}  stream ${obs.streaming}  record ${obs.recording}${obs.recordPaused ? ' (paused)' : ''}`)
    obs.start(Number(option('port') || 4455)).then(port => {
        console.log(`Fake OBS listening on ws://0.0.0.0:${port}${obs.password ? ' (password set)' : ''}`)
        print()
    })
    readline.createInterface({ input: process.stdin }).on('line', line => {
        const [cmd, ...rest] = line.trim().split(/\s+/)
        const arg = rest.join(' ')
        if (cmd === 'cut') obs.cut(arg)
        else if (cmd === 'fade') {
            const ms = Number(rest[rest.length - 1]) || 1000
            const scene = Number(rest[rest.length - 1]) ? rest.slice(0, -1).join(' ') : arg
            obs.transitionStart(scene)
            setTimeout(() => { obs.transitionEnd(); print() }, ms)
        } else if (cmd === 'preview') obs.setPreview(arg)
        else if (cmd === 'studio') obs.setStudioMode(arg === 'on')
        else if (cmd === 'stream') obs.setStreaming(arg === 'on')
        else if (cmd === 'record') obs.setRecording({ on: 'start', off: 'stop' }[arg] || arg)
        else if (cmd !== 'state') {
            console.log('Commands: cut|fade|preview <scene>, studio on|off, stream on|off, record on|off|pause|resume, state')
            return
        }
        print()
    })
}
