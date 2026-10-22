import RolandV8HDConnector from './RolandV8HDConnector'
import RolandV8HDConfiguration from './RolandV8HDConfiguration'
import { MixerCommunicator } from '../../lib/MixerCommunicator'
import { AppConfiguration } from '../../lib/AppConfiguration'
import ServerEventEmitter from '../../lib/ServerEventEmitter'

test('switching away without the MIDI module does not crash the Hub', () => {
    const emitter = new ServerEventEmitter()
    const communicator = new MixerCommunicator(new AppConfiguration(emitter), emitter)
    jest.spyOn(console, 'error').mockImplementation(() => {})
    jest.spyOn(console, 'log').mockImplementation(() => {})
    const connector = new RolandV8HDConnector(new RolandV8HDConfiguration(), communicator)
    connector.midi = undefined
    connector.connect()
    expect(() => connector.disconnect()).not.toThrow()
    expect(connector.isConnected()).toBe(false)
})
