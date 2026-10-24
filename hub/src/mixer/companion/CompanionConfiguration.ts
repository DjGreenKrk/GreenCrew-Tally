import { Configuration } from '../interfaces'
import { cleanChannelNames, defaultChannelNames } from '../channelNames'

export type CompanionConfigurationSaveType = {
    channelNames: string[]
}

// Companion uses the Hub's existing HTTP port; only the channel list is set here.
class CompanionConfiguration extends Configuration {
    channelNames: string[]

    constructor() {
        super()
        this.channelNames = defaultChannelNames()
    }

    fromJson(data: CompanionConfigurationSaveType): void {
        // a configuration saved before the channel list keeps 8 channels
        if (data && Array.isArray(data.channelNames)) {
            try {
                this.setChannelNames(data.channelNames)
            } catch (err) {
                console.error(`error loading property "channelNames" of configuration: ${err}`)
            }
        }
    }
    toJson(): CompanionConfigurationSaveType {
        return {
            channelNames: this.channelNames,
        }
    }
    clone(): CompanionConfiguration {
        const clone = new CompanionConfiguration()
        clone.fromJson(this.toJson())
        return clone
    }

    setChannelNames(names: unknown[] | null) {
        this.channelNames = names === null ? defaultChannelNames() : cleanChannelNames(names)
        return this
    }
    getChannelNames() {
        return this.channelNames
    }
}

export default CompanionConfiguration
