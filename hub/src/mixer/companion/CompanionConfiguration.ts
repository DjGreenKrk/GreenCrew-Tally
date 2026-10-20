import { Configuration } from '../interfaces'

// Companion uses the Hub's existing HTTP port and needs no mixer settings.
class CompanionConfiguration extends Configuration {
    fromJson(data: object): void {
        // Ignore settings for this stateless mixer, but retain the public API.
        if (data === null || typeof data !== 'object') return
    }
    toJson(): object { return {} }
    clone(): CompanionConfiguration { return new CompanionConfiguration() }
}

export default CompanionConfiguration
