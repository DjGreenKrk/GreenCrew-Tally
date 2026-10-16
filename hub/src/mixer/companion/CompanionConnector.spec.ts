import { EventEmitter } from 'events'
import { AppConfiguration } from '../../lib/AppConfiguration'
import { MixerCommunicator } from '../../lib/MixerCommunicator'
import CompanionConfiguration from './CompanionConfiguration'
import CompanionConnector from './CompanionConnector'

test('Companion forwards state, deduplicates changes and clears on disconnect', () => {
    const emitter = new EventEmitter()
    const configuration = new AppConfiguration(emitter)
    const communicator = new MixerCommunicator(configuration, emitter)
    const connector = new CompanionConnector(new CompanionConfiguration(), communicator)
    let events = 0
    emitter.on('program.changed', () => events++)
    connector.connect()
    expect(connector.isConnected()).toBe(true)
    expect(configuration.getChannels()).toHaveLength(8)

    connector.setState(['1'], ['2'])
    expect(communicator.getCurrentPrograms()).toEqual(['1'])
    expect(communicator.getCurrentPreviews()).toEqual(['2'])
    const afterFirstUpdate = events
    connector.setState(['1'], ['2'])
    expect(events).toBe(afterFirstUpdate)

    connector.setState(['3'], [])
    expect(communicator.getCurrentPrograms()).toEqual(['3'])
    expect(communicator.getCurrentPreviews()).toEqual([])

    connector.disconnect()
    expect(connector.isConnected()).toBe(false)
    expect(communicator.getCurrentPrograms()).toEqual([])
    expect(() => connector.setState(['1'], [])).toThrow()
})
