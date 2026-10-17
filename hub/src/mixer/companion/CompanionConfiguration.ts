import { Configuration } from '../interfaces'

// Companion uses the Hub's existing HTTP port and needs no mixer settings.
class CompanionConfiguration extends Configuration {
    fromJson(): void {}
    toJson(): object { return {} }
    clone(): CompanionConfiguration { return new CompanionConfiguration() }
}

export default CompanionConfiguration
