import ManualConnector from './ManualConnector'
import ManualConfiguration from './ManualConfiguration'
import { MixerCommunicator } from '../../lib/MixerCommunicator'
import { AppConfiguration } from '../../lib/AppConfiguration'
import ServerEventEmitter from '../../lib/ServerEventEmitter'

class RecordingCommunicator extends MixerCommunicator {
    constructor() {
        const emitter = new ServerEventEmitter()
        super(new AppConfiguration(emitter), emitter)
    }
    state: { programs: string[] | null, previews: string[] | null, auxes: string[] } = { programs: null, previews: null, auxes: [] }
    channelNames: (string | undefined)[] = []
    connected = false
    notifyProgramPreviewChanged(programs, previews, auxes = []) { this.state = { programs, previews, auxes } }
    notifyChannels(channels) { this.channelNames = channels.map(c => c.name) }
    notifyMixerIsConnected() { this.connected = true }
    notifyMixerIsDisconnected() { this.connected = false }
}

const create = (names = ['A', 'B', 'C']) => {
    const communicator = new RecordingCommunicator()
    const connector = new ManualConnector(new ManualConfiguration().setChannelNames(names), communicator)
    connector.connect()
    return { communicator, connector }
}

beforeEach(() => ManualConnector.resetStates())

test('is connected with the configured channels and everything off', () => {
    const { communicator } = create()
    expect(communicator.connected).toBe(true)
    expect(communicator.channelNames).toEqual(['A', 'B', 'C'])
    expect(communicator.state).toEqual({ programs: [], previews: [], auxes: [] })
})

test('sets the state of each channel', () => {
    const { communicator, connector } = create()
    connector.setChannelState('3', 'program')
    connector.setChannelState('1', 'preview')
    connector.setChannelState('2', 'aux')
    expect(communicator.state).toEqual({ programs: ['3'], previews: ['1'], auxes: ['2'] })
    connector.setChannelState('3', 'off')
    expect(communicator.state).toEqual({ programs: [], previews: ['1'], auxes: ['2'] })
    connector.allOff()
    expect(communicator.state).toEqual({ programs: [], previews: [], auxes: [] })
})

test('a channel has one state at a time', () => {
    const { communicator, connector } = create()
    connector.setChannelState('1', 'program')
    connector.setChannelState('1', 'aux')
    expect(communicator.state).toEqual({ programs: [], previews: [], auxes: ['1'] })
})

test('rejects unknown channels', () => {
    const { connector } = create()
    expect(() => connector.setChannelState('4', 'program')).toThrow()
    expect(() => connector.setChannelState('x', 'program')).toThrow()
})

test('states survive renaming the channels, removed channels go off', () => {
    const first = create()
    first.connector.setChannelState('1', 'program')
    first.connector.setChannelState('3', 'preview')
    first.connector.disconnect()
    const second = create(['Actor', 'Singer'])
    expect(second.communicator.state).toEqual({ programs: ['1'], previews: [], auxes: [] })
})
