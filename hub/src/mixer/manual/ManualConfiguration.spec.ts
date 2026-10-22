import ManualConfiguration, { MAX_MANUAL_CHANNELS } from './ManualConfiguration'

test('has 8 channels by default', () => {
    expect(new ManualConfiguration().getChannelNames()).toHaveLength(8)
})

test('names survive a save', () => {
    const conf = new ManualConfiguration().setChannelNames(['Actor 1', 'Actor 2', 'Stage manager'])
    const loaded = new ManualConfiguration()
    loaded.fromJson(conf.toJson())
    expect(loaded.getChannelNames()).toEqual(['Actor 1', 'Actor 2', 'Stage manager'])
})

test('an empty name falls back to the channel number', () => {
    expect(new ManualConfiguration().setChannelNames([' A ', '']).getChannelNames()).toEqual(['A', 'Channel 2'])
})

test('rejects no channels and too many channels', () => {
    expect(() => new ManualConfiguration().setChannelNames([])).toThrow()
    expect(() => new ManualConfiguration().setChannelNames(Array(MAX_MANUAL_CHANNELS + 1).fill('x'))).toThrow()
})

test('keeps the defaults for invalid saved data', () => {
    const conf = new ManualConfiguration()
    jest.spyOn(console, 'error').mockImplementation(() => {})
    conf.fromJson({ channelNames: [] })
    expect(conf.getChannelNames()).toHaveLength(8)
})
