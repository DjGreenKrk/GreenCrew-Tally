import CompanionConfiguration from './CompanionConfiguration'
import { MAX_CHANNELS } from '../channelNames'

test('a configuration saved before the channel list keeps 8 channels', () => {
    const conf = new CompanionConfiguration()
    conf.fromJson({} as never)
    expect(conf.getChannelNames()).toHaveLength(8)
})

test('channel names survive a save', () => {
    const names = Array.from({ length: 12 }, (_, i) => `Cam ${i + 1}`)
    const loaded = new CompanionConfiguration()
    loaded.fromJson(new CompanionConfiguration().setChannelNames(names).toJson())
    expect(loaded.getChannelNames()).toEqual(names)
})

test(`allows 1 to ${MAX_CHANNELS} channels`, () => {
    expect(new CompanionConfiguration().setChannelNames(['A']).getChannelNames()).toEqual(['A'])
    expect(new CompanionConfiguration().setChannelNames(Array(MAX_CHANNELS).fill('x')).getChannelNames()).toHaveLength(MAX_CHANNELS)
    expect(() => new CompanionConfiguration().setChannelNames([])).toThrow()
    expect(() => new CompanionConfiguration().setChannelNames(Array(MAX_CHANNELS + 1).fill('x'))).toThrow()
})
