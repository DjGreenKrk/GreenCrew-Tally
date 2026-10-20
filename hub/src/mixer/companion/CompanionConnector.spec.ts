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
    expect(connector.isActive()).toBe(true)
    expect(connector.isConnected()).toBe(false)
    expect(configuration.getChannels()).toHaveLength(8)

    connector.setState(['1'], ['2'])
    expect(connector.isConnected()).toBe(true)
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

test('missing HTTP heartbeats cause blackout, disconnect and recovery on next snapshot', () => {
    jest.useFakeTimers()
    try {
        const emitter = new EventEmitter()
        const configuration = new AppConfiguration(emitter)
        const communicator = new MixerCommunicator(configuration, emitter)
        const connector = new CompanionConnector(new CompanionConfiguration(), communicator)
        const disconnected = jest.fn()
        const connected = jest.fn()
        emitter.on('mixer.disconnected', disconnected)
        emitter.on('mixer.connected', connected)
        connector.connect()
        expect(connector.isActive()).toBe(true)
        expect(connector.isConnected()).toBe(false)

        connector.setState(['1'], ['2'])
        expect(connector.isConnected()).toBe(true)
        expect(connected).toHaveBeenCalledTimes(1)
        jest.advanceTimersByTime(2000)
        connector.setState(['1'], ['2']) // heartbeat with unchanged state
        jest.advanceTimersByTime(2500)
        expect(connector.isConnected()).toBe(true)

        jest.advanceTimersByTime(2000)
        expect(connector.isConnected()).toBe(false)
        expect(connector.isActive()).toBe(true)
        expect(disconnected).toHaveBeenCalled()
        expect(communicator.getCurrentPrograms()).toBeNull()
        expect(communicator.getCurrentPreviews()).toBeNull()

        connector.setState(['3'], ['1'])
        expect(connector.isConnected()).toBe(true)
        expect(connected).toHaveBeenCalledTimes(2)
        expect(communicator.getCurrentPrograms()).toEqual(['3'])
        connector.disconnect()
        expect(connector.isActive()).toBe(false)
    } finally {
        jest.useRealTimers()
    }
})
