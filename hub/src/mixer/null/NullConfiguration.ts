import { Configuration } from "../interfaces";

class NullConfiguration extends Configuration {
    fromJson(data: object): void {
        // Preserve the Configuration.fromJson(payload) contract, even though
        // Null mixer has no recognized settings.
        if (data === null || typeof data !== 'object') return
    }
    toJson(): object {
        return {}
    }
    clone(): NullConfiguration {
        const clone = new NullConfiguration()
        clone.fromJson(this.toJson())
        return clone
    }

}

export default NullConfiguration
