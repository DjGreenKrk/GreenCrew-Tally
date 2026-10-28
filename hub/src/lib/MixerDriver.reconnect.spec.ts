import { MixerDriver } from './MixerDriver'
import { AppConfiguration } from './AppConfiguration'
import ServerEventEmitter from './ServerEventEmitter'
import ManualConnector from '../mixer/manual/ManualConnector'

afterEach(() => {
    ManualConnector.resetStates()
})

test('reconnect() restarts the current mixer and keeps its configured state', async () => {
    const emitter = new ServerEventEmitter()
    const configuration = new AppConfiguration(emitter)
    configuration.setMixerSelection('manual')
    const driver = new MixerDriver(configuration, emitter)
    await new Promise(resolve => setTimeout(resolve, 0))

    const mixerBeforeReconnect = driver.currentMixerInstance as ManualConnector
    mixerBeforeReconnect.setChannelState('1', 'program')
    expect(driver.getCurrentPrograms()).toEqual(['1'])

    await driver.reconnect()

    expect(driver.currentMixerInstance).not.toBe(mixerBeforeReconnect)
    expect(driver.currentMixerInstance).toBeInstanceOf(ManualConnector)
    expect(driver.isConnected()).toBe(true)
    expect(driver.getCurrentPrograms()).toEqual(['1'])
})

test('reconnect() does nothing when no mixer has been selected yet', async () => {
    const emitter = new ServerEventEmitter()
    const configuration = new AppConfiguration(emitter)
    const driver = new MixerDriver(configuration, emitter)
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(driver.currentMixerId).toBeUndefined()
    await expect(driver.reconnect()).resolves.not.toThrow()
    expect(driver.currentMixerInstance).toBeUndefined()
})
