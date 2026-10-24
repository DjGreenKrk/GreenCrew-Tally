// Channel lists for sources without their own inputs (Manual, Companion).
// Channel ids are the positions 1..n, so tallies stay patched by number.
export const MAX_CHANNELS = 32
export const DEFAULT_CHANNEL_COUNT = 8

export const defaultChannelNames = () => Array.from({ length: DEFAULT_CHANNEL_COUNT }, (_, i) => `Channel ${i + 1}`)

export function cleanChannelNames(names: unknown[]): string[] {
    const cleaned = names.map(name => typeof name === 'string' ? name.trim() : '')
    if (cleaned.length === 0) {
        throw new Error('At least one channel is needed')
    }
    if (cleaned.length > MAX_CHANNELS) {
        throw new Error(`At most ${MAX_CHANNELS} channels are possible`)
    }
    // an empty name falls back to the channel number
    return cleaned.map((name, i) => name || `Channel ${i + 1}`)
}

// the shape MixerCommunicator.notifyChannelNames() expects
export const channelNamesById = (names: string[]) => Object.fromEntries(names.map((name, i) => [i + 1, name]))
