import { Configuration } from '../interfaces'
import { cleanChannelNames, defaultChannelNames } from '../channelNames'

export type ManualConfigurationSaveType = {
    channelNames: string[]
    exclusiveProgram?: boolean
}

// Channels the operator switches by hand, e.g. from a phone (no vision mixer).
class ManualConfiguration extends Configuration {
    channelNames: string[]
    // setting a channel to Program turns off the channel that was on Program
    exclusiveProgram: boolean

    constructor() {
        super()
        this.channelNames = defaultChannelNames()
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
            this.channelNames = defaultChannelNames()
            return this
        }
        this.channelNames = cleanChannelNames(names)
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
}

export default ManualConfiguration
