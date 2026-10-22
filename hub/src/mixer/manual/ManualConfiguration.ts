import { Configuration } from '../interfaces'

export type ManualConfigurationSaveType = {
    channelNames: string[]
    exclusiveProgram?: boolean
}

export const MAX_MANUAL_CHANNELS = 32

// Channels the operator switches by hand, e.g. from a phone (no vision mixer).
class ManualConfiguration extends Configuration {
    channelNames: string[]
    // setting a channel to Program turns off the channel that was on Program
    exclusiveProgram: boolean

    constructor() {
        super()
        this.channelNames = ManualConfiguration.defaultChannelNames
        this.exclusiveProgram = false
    }

    fromJson(data: ManualConfigurationSaveType): void {
        if (data && Array.isArray(data.channelNames)) {
            try {
                this.setChannelNames(data.channelNames)
            } catch (err) {
                console.error(`error loading property "channelNames" of configuration: ${err}`)
            }
        }
        if (data && typeof data.exclusiveProgram === 'boolean') {
            this.exclusiveProgram = data.exclusiveProgram
        }
    }
    toJson(): ManualConfigurationSaveType {
        return {
            channelNames: this.channelNames,
            exclusiveProgram: this.exclusiveProgram,
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

    setExclusiveProgram(exclusive: boolean) {
        this.exclusiveProgram = exclusive
        return this
    }
    isExclusiveProgram() {
        return this.exclusiveProgram
    }

    private static readonly defaultChannelNames = Array.from({ length: 8 }, (_, i) => `Channel ${i + 1}`)
}

export default ManualConfiguration
