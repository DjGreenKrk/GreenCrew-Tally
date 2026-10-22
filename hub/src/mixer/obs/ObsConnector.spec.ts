import ObsConnector from './ObsConnector'
import { MixerCommunicator } from '../../lib/MixerCommunicator'
import { AppConfiguration } from '../../lib/AppConfiguration'
import ServerEventEmitter from '../../lib/ServerEventEmitter'
import ObsConfiguration, { ObsConfigurationLiveMode } from './ObsConfiguration'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { FakeObs } = require('../../../scripts/obs-simulator.cjs')

class MockCommunicator extends MixerCommunicator {
    constructor() {
        const emitter = new ServerEventEmitter()
        super(new AppConfiguration(emitter), emitter)
    }
    programs: string[] | null = null
    previews: string[] | null = null
    channels: string[] | null = null
    isConnected = false
    notifyProgramPreviewChanged(programs, previews) {
        this.programs = programs
        this.previews = previews
    }
    notifyChannels(channels) {
        this.channels = channels.map(channel => channel.name)
    }
    notifyMixerIsConnected() { this.isConnected = true }
    notifyMixerIsDisconnected() { this.isConnected = false }
}

const waitUntil = async (fn: () => boolean, what = 'condition') => {
    const deadline = Date.now() + 3000
    while (!fn()) {
        if (Date.now() > deadline) throw new Error(`Timed out waiting for ${what}`)
        await new Promise(resolve => setTimeout(resolve, 10))
    }
}
const same = (actual: string[] | null, expected: string[]) => JSON.stringify(actual) === JSON.stringify(expected)

describe('ObsConnector', () => {
    let fakeObs
    let connector: ObsConnector
    let communicator: MockCommunicator

    async function connect(options: { password?: string, liveMode?: ObsConfigurationLiveMode } = {}) {
        const configuration = new ObsConfiguration()
        configuration.setIp('127.0.0.1')
        configuration.setPort(fakeObs.port)
        configuration.setPassword(options.password ?? null)
        if (options.liveMode) configuration.setLiveMode(options.liveMode)
        communicator = new MockCommunicator()
        connector = new ObsConnector(configuration, communicator)
        connector.connect()
    }
    const waitFor = (programs: string[], previews: string[]) =>
        waitUntil(() => same(communicator.programs, programs) && same(communicator.previews, previews),
            `PGM ${programs} PVW ${previews}, got PGM ${communicator.programs} PVW ${communicator.previews}`)

    beforeEach(async () => {
        fakeObs = new FakeObs()
        await fakeObs.start()
    })
    afterEach(async () => {
        connector?.disconnect()
        await fakeObs.stop()
    })

    test('reads the scenes and the initial state without studio mode', async () => {
        await connect()
        await waitUntil(() => communicator.isConnected, 'connection')
        await waitUntil(() => same(communicator.channels, ['Scene 1', 'Scene 2', 'Scene 3']), 'channels in OBS order')
        await waitFor(['Scene 1'], [])
    })

    test('reads the initial state with studio mode', async () => {
        fakeObs.preview = 'Scene 2'
        await connect()
        await waitFor(['Scene 1'], ['Scene 2'])
    })

    test('reports unknown state until connected', async () => {
        await fakeObs.stop()
        await connect()
        expect(communicator.programs).toBeNull()
        expect(communicator.previews).toBeNull()
        expect(communicator.isConnected).toBe(false)
    })

    test('it cuts', async () => {
        await connect()
        await waitFor(['Scene 1'], [])
        fakeObs.cut('Scene 2')
        await waitFor(['Scene 2'], [])
    })

    test('scenes inside scenes are on air too, also nested deeper', async () => {
        fakeObs.setScenes([
            { name: 'Cam', children: [] },
            { name: 'Lower third', children: [{ name: 'Cam', enabled: true }] },
            { name: 'Show', children: [{ name: 'Lower third', enabled: true }] },
        ])
        fakeObs.program = 'Show'
        await connect()
        await waitFor(['Show', 'Lower third', 'Cam'], [])
        fakeObs.setPreview('Lower third')
        await waitFor(['Show', 'Lower third', 'Cam'], ['Lower third', 'Cam'])
    })

    test('a hidden nested scene is not on air', async () => {
        fakeObs.program = 'Scene 3'
        await connect()
        await waitFor(['Scene 3', 'Scene 1'], [])
        fakeObs.setChildEnabled('Scene 3', 'Scene 1', false)
        await waitFor(['Scene 3'], [])
    })

    test('both scenes are on air during a transition', async () => {
        await connect()
        await waitFor(['Scene 1'], [])
        fakeObs.transitionStart('Scene 2')
        await waitFor(['Scene 1', 'Scene 2'], [])
        fakeObs.transitionEnd()
        await waitFor(['Scene 2'], [])
    })

    test('a cut during a transition ends with the new scene', async () => {
        await connect()
        await waitFor(['Scene 1'], [])
        fakeObs.transitionStart('Scene 2')
        await waitFor(['Scene 1', 'Scene 2'], [])
        fakeObs.cut('Scene 3')
        await waitFor(['Scene 1', 'Scene 3'], [])
        fakeObs.transitionEnd()
        await waitFor(['Scene 3', 'Scene 1'], [])
    })

    test('it follows changes of the scenes', async () => {
        await connect()
        await waitUntil(() => same(communicator.channels, ['Scene 1', 'Scene 2', 'Scene 3']))
        fakeObs.setScenes([{ name: 'Scene 1', children: [] }, { name: 'New', children: [] }])
        await waitUntil(() => same(communicator.channels, ['Scene 1', 'New']), 'new channels')
    })

    test('it follows a change of the scene collection', async () => {
        await connect()
        await waitFor(['Scene 1'], [])
        fakeObs.changeSceneCollection([{ name: 'A', children: [] }, { name: 'B', children: [] }], 'B')
        await waitUntil(() => same(communicator.channels, ['A', 'B']), 'collection channels')
        await waitFor(['B'], [])
    })

    test('it switches preview with studio mode', async () => {
        await connect()
        await waitFor(['Scene 1'], [])
        fakeObs.setStudioMode(true, 'Scene 2')
        await waitFor(['Scene 1'], ['Scene 2'])
        fakeObs.setPreview('Scene 3')
        await waitFor(['Scene 1'], ['Scene 3', 'Scene 1'])
        fakeObs.setStudioMode(false)
        await waitFor(['Scene 1'], [])
    })

    test('it authenticates with a password', async () => {
        await fakeObs.stop()
        fakeObs = new FakeObs({ password: 'secret' })
        await fakeObs.start()
        await connect({ password: 'secret' })
        await waitFor(['Scene 1'], [])
        expect(communicator.isConnected).toBe(true)
    })

    test('a wrong password does not connect', async () => {
        await fakeObs.stop()
        fakeObs = new FakeObs({ password: 'secret' })
        await fakeObs.start()
        const error = jest.spyOn(console, 'error').mockImplementation(() => {})
        await connect({ password: 'wrong' })
        await waitUntil(() => error.mock.calls.some(call => String(call[1]).includes('4009')), 'authentication error')
        expect(communicator.isConnected).toBe(false)
        error.mockRestore()
    })

    test('it reconnects when OBS comes back', async () => {
        const error = jest.spyOn(console, 'error').mockImplementation(() => {})
        await connect()
        await waitFor(['Scene 1'], [])
        fakeObs.dropClients()
        await waitUntil(() => !communicator.isConnected, 'disconnect')
        fakeObs.cut('Scene 2')
        await waitUntil(() => communicator.isConnected, 'reconnect')
        await waitFor(['Scene 2'], [])
        error.mockRestore()
    })

    describe('live mode', () => {
        test('"stream" only shows a program status when streaming', async () => {
            await connect({ liveMode: 'stream' })
            await waitFor([], ['Scene 1'])
            fakeObs.setStreaming(true)
            await waitFor(['Scene 1'], [])
            fakeObs.setRecording('start')
            fakeObs.setStreaming(false)
            await waitFor([], ['Scene 1'])
        })

        test('"record" only shows a program status when recording, not while paused', async () => {
            await connect({ liveMode: 'record' })
            await waitFor([], ['Scene 1'])
            fakeObs.setRecording('start')
            await waitFor(['Scene 1'], [])
            fakeObs.setRecording('pause')
            await waitFor([], ['Scene 1'])
            fakeObs.setRecording('resume')
            await waitFor(['Scene 1'], [])
            fakeObs.setRecording('stop')
            await waitFor([], ['Scene 1'])
        })

        test('"streamOrRecord" shows a program status when streaming or recording', async () => {
            await connect({ liveMode: 'streamOrRecord' })
            await waitFor([], ['Scene 1'])
            fakeObs.setStreaming(true)
            await waitFor(['Scene 1'], [])
            fakeObs.setRecording('start')
            fakeObs.setStreaming(false)
            await waitFor(['Scene 1'], [])
            fakeObs.setRecording('stop')
            await waitFor([], ['Scene 1'])
        })

        test('the initial stream state is read on connect', async () => {
            fakeObs.streaming = true
            await connect({ liveMode: 'stream' })
            await waitFor(['Scene 1'], [])
        })
    })
})

describe('resolveEmbeddedScenes', () => {
    test('follows nesting and survives cycles', () => {
        expect(ObsConnector.resolveEmbeddedScenes({ A: ['B'], B: ['C'], C: ['A'], D: [] })).toEqual({
            A: ['B', 'C'], B: ['C', 'A'], C: ['A', 'B'], D: [],
        })
    })
})
