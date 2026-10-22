import { Configuration } from '../interfaces'

export type ManualConfigurationSaveType = {
    channelNames: string[]
}

export const MAX_MANUAL_CHANNELS = 32

// Channels the operator switches by hand, e.g. from a phone (no vision mixer).
class ManualConfiguration extends Configuration {
    channelNames: string[]

    constructor() {
        super()
        this.channelNames = ManualConfiguration.defaultChannelNames
    }

    fromJson(data: ManualConfigurationSaveType): void {
        if (data && Array.isArray(data.channelNames)) {
            try {
                this.setChannelNames(data.channelNames)
            } catch (err) {
                console.error(`error loading property "channelNames" of configuration: ${err}`)
            }
        }
    }
    toJson(): ManualConfigurationSaveType {
        return {
            channelNames: this.channelNames,
        }
    }
    clone(): ManualConfiguration {
        const clone = new ManualConfiguration()
        clone.fromJson(this.toJson())
        return clone
    }

    setChannelNames(names: unknown[] | null) {
        if (names === null) {
            this.channelNames = ManualConfiguration.defaultChannelNames
            return this
        }
        const cleaned = names.map(name => typeof name === 'string' ? name.trim() : '')
        if (cleaned.length === 0) {
            throw new Error('At least one channel is needed')
        }
        if (cleaned.length > MAX_MANUAL_CHANNELS) {
            throw new Error(`At most ${MAX_MANUAL_CHANNELS} channels are possible`)
        }
        // an empty name falls back to the channel number
        this.channelNames = cleaned.map((name, i) => name || `Channel ${i + 1}`)
        return this
    }
    getChannelNames() {
        return this.channelNames
    }

    private static readonly defaultChannelNames = Array.from({ length: 8 }, (_, i) => `Channel ${i + 1}`)
}

export default ManualConfiguration
