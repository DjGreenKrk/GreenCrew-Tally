import { MixerDriver } from './MixerDriver'
import { AppConfiguration } from './AppConfiguration'
import ServerEventEmitter from './ServerEventEmitter'
import ManualConfiguration from '../mixer/manual/ManualConfiguration'
import ManualConnector from '../mixer/manual/ManualConnector'

test('changing the manual settings keeps the mixer connected and the lights as they are', async () => {
    const emitter = new ServerEventEmitter()
    const configuration = new AppConfiguration(emitter)
    configuration.setMixerSelection('manual')
    const driver = new MixerDriver(configuration, emitter)
    await new Promise(resolve => setTimeout(resolve, 0))
    const mixer = driver.currentMixerInstance as ManualConnector
    expect(mixer).toBeInstanceOf(ManualConnector)
    mixer.setChannelState('1', 'program')

    const states: unknown[] = []
    emitter.on('program.changed', state => states.push(state))
    configuration.setManualConfiguration(new ManualConfiguration().setChannelNames(['Actor', 'Singer']).setExclusiveProgram(true))

    expect(driver.currentMixerInstance).toBe(mixer)
    expect(driver.isConnected()).toBe(true)
    expect(states.some(state => (state as { programs: unknown }).programs === null)).toBe(false)
    expect(driver.getCurrentPrograms()).toEqual(['1'])
    expect(configuration.getChannels().map(channel => channel.name)).toEqual(['Actor', 'Singer'])
    ManualConnector.resetStates()
})
