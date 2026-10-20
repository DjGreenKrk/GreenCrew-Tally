import {MixerDriver} from './MixerDriver'
import Channel from '../domain/Channel'
import ServerEventEmitter from './ServerEventEmitter'
import AtemConfiguration from '../mixer/atem/AtemConfiguration'
import MockConfiguration from '../mixer/mock/MockConfiguration'
import ObsConfiguration from '../mixer/obs/ObsConfiguration'
import RolandV8HDConfiguration from '../mixer/rolandV8HD/RolandV8HDConfiguration'
import RolandV60HDConfiguration from '../mixer/rolandV60HD/RolandV60HDConfiguration'
import VmixConfiguration from '../mixer/vmix/VmixConfiguration'
import NullConfiguration from '../mixer/null/NullConfiguration'
import CompanionConfiguration from '../mixer/companion/CompanionConfiguration'
import { Configuration } from '../mixer/interfaces'
import Tally, { TallySaveObjectType } from '../domain/Tally'
import TestConfiguration from '../mixer/test/TestConfiguration'
import { DefaultTallyConfiguration } from '../tally/TallyConfiguration'

type ConfigPayload<C extends { fromJson(data: never): void }> = Parameters<C['fromJson']>[0]

// Persisted configuration payload. Every section is optional and the remaining
// keys (mixer, channels, tallies, ...) are validated by the individual loaders.
type AppConfigurationPayload = {
    atem?: ConfigPayload<AtemConfiguration>
    mock?: ConfigPayload<MockConfiguration>
    null?: ConfigPayload<NullConfiguration>
    companion?: ConfigPayload<CompanionConfiguration>
    obs?: ConfigPayload<ObsConfiguration>
    rolandV8HD?: ConfigPayload<RolandV8HDConfiguration>
    rolandV60HD?: ConfigPayload<RolandV60HDConfiguration>
    test?: ConfigPayload<TestConfiguration>
    vmix?: ConfigPayload<VmixConfiguration>
    tallyDefaults?: ConfigPayload<DefaultTallyConfiguration>
    [key: string]: unknown
}

export class AppConfiguration extends Configuration {
    emitter: ServerEventEmitter
    atemConfiguration: AtemConfiguration
    mockConfiguration: MockConfiguration
    nullConfiguration: NullConfiguration
    companionConfiguration: CompanionConfiguration
    obsConfiguration: ObsConfiguration
    rolandV8HDConfiguration: RolandV8HDConfiguration
    rolandV60HDConfiguration: RolandV60HDConfiguration
    testConfiguration: TestConfiguration
    vmixConfiguration: VmixConfiguration
    tallyConfiguration: DefaultTallyConfiguration
    vmixProjectProfiles: Record<string, { presetPath: string, savedAt: string, tallies: TallySaveObjectType[] }>
    tallies: Tally[]
    channels: Channel[]
    mixerSelection?: string
    // kept apart from the Companion mixer settings: changing those restarts the mixer
    companionLanToken?: string
    tallyPort: number
    tallyHighlightTime: number
    tallyKeepAlivesPerSecond: number
    tallyTimeoutDisconnected: number
    tallyTimeoutMissing: number

    constructor(emitter: ServerEventEmitter) {
        super()
        this.emitter = emitter
        this.atemConfiguration = new AtemConfiguration()
        this.mockConfiguration = new MockConfiguration()
        this.nullConfiguration = new NullConfiguration()
        this.companionConfiguration = new CompanionConfiguration()
        this.obsConfiguration = new ObsConfiguration()
        this.rolandV8HDConfiguration = new RolandV8HDConfiguration()
        this.rolandV60HDConfiguration = new RolandV60HDConfiguration()
        this.testConfiguration = new TestConfiguration()
        this.vmixConfiguration = new VmixConfiguration()
        this.tallyConfiguration = new DefaultTallyConfiguration()
        this.vmixProjectProfiles = {}
        this.tallies = []
        this.channels = MixerDriver.defaultChannels

        this.tallyPort = 7411
        this.tallyHighlightTime = 1000 // ms
        this.tallyKeepAlivesPerSecond = 10
        this.tallyTimeoutDisconnected = 30000 // ms
        this.tallyTimeoutMissing = 3000 //ms
    }

    protected loadChannelArray(fieldName: string, setter: (value:Channel[]) => void, data: object) {
        const value = data[fieldName]
        if (value === undefined || value === null) {
            // value is not set
            return
        } else if (Array.isArray(value)) {
            try {
                setter(value.map(c => Channel.fromJson(c)))
            } catch (err) {
                console.error(`error loading property "${fieldName}" of configuration: ${err}`)
                return
            }
        } else {
            console.error(`error loading property "${fieldName}": invalid type ${typeof value}`)
        }
    }

    protected loadTallyArray(fieldName: string, setter: (value:Tally[]) => void, data: object) {
        const value = data[fieldName]
        if (value === undefined || value === null) {
            // value is not set
            return
        } else if (Array.isArray(value)) {
            try {
                setter(value.map(t => Tally.fromJsonForSave(t)))
            } catch (err) {
                console.error(`error loading property "${fieldName}" of configuration: ${err}`)
                return
            }
        } else {
            console.error(`error loading property "${fieldName}": invalid type ${typeof value}`)
        }
    }

    protected loadVmixProjectProfiles(data: object) {
        const profiles = data['vmixProjects']
        if (typeof profiles === 'object' && profiles !== null && !Array.isArray(profiles)) {
            this.vmixProjectProfiles = profiles as Record<string, { presetPath: string, savedAt: string, tallies: TallySaveObjectType[] }>
        }
    }

    fromJson(payload: object): void {
        const data = payload as AppConfigurationPayload
        if (data.atem) {
            this.atemConfiguration.fromJson(data.atem)
        }
        if (data.mock) {
            this.mockConfiguration.fromJson(data.mock)
        }
        if (data.null) {
            this.nullConfiguration.fromJson(data.null)
        }
        if (data.companion) {
            this.companionConfiguration.fromJson(data.companion)
        }
        if (data.obs) {
            this.obsConfiguration.fromJson(data.obs)
        }
        if (data.rolandV8HD) {
            this.rolandV8HDConfiguration.fromJson(data.rolandV8HD)
        }
        if (data.rolandV60HD) {
            this.rolandV60HDConfiguration.fromJson(data.rolandV60HD)
        }
        if (data.test) {
            this.testConfiguration.fromJson(data.test)
        }
        if (data.vmix) {
            this.vmixConfiguration.fromJson(data.vmix)
        }
        if (data.tallyDefaults) {
            this.tallyConfiguration.fromJson(data.tallyDefaults)
        }
        this.loadString("mixer", this.setMixerSelection.bind(this), data)
        this.loadChannelArray("channels", this.setChannels.bind(this), data)
        this.loadTallyArray("tallies", this.setTallies.bind(this), data)
        this.loadVmixProjectProfiles(data)
        if (typeof data.companionLanToken === 'string' && data.companionLanToken) {
            this.companionLanToken = data.companionLanToken
        }
    }
    toJson(): object {
        return {
            mixer: this.mixerSelection,
            atem: this.atemConfiguration.toJson(),
            mock: this.mockConfiguration.toJson(),
            "null": this.nullConfiguration.toJson(),
            companion: this.companionConfiguration.toJson(),
            obs: this.obsConfiguration.toJson(),
            rolandV8HD: this.rolandV8HDConfiguration.toJson(),
            rolandV60HD: this.rolandV60HDConfiguration.toJson(),
            test: this.testConfiguration.toJson(),
            vmix: this.vmixConfiguration.toJson(),
            tallyDefaults: this.tallyConfiguration.toJson(),
            tallies: this.tallies.map(tally => tally.toJsonForSave()),
            channels: this.channels.map(channel => channel.toJson()),
            vmixProjects: this.vmixProjectProfiles,
            companionLanToken: this.companionLanToken,
        }
    }
    clone(): AppConfiguration {
        const clone = new AppConfiguration(this.emitter)
        clone.fromJson(this.toJson())
        return clone
    }

    getAtemConfiguration() {
        return this.atemConfiguration.clone()
    }

    setAtemConfiguration(atemConfiguration: AtemConfiguration) {
        this.atemConfiguration = atemConfiguration.clone()
        this.emitter.emit("config.changed", this)
        this.emitter.emit("config.changed.atem", this.atemConfiguration)
    }

    getMockConfiguration() {
        return this.mockConfiguration.clone()
    }

    setMockConfiguration(mockConfiguration: MockConfiguration) {
        this.mockConfiguration = mockConfiguration.clone()
        this.emitter.emit("config.changed", this)
        this.emitter.emit("config.changed.mock", this.mockConfiguration)
    }

    getNullConfiguration() {
        return this.nullConfiguration.clone()
    }

    getCompanionConfiguration() {
        return this.companionConfiguration.clone()
    }

    getCompanionLanToken() {
        return this.companionLanToken
    }

    setCompanionLanToken(token: string | undefined) {
        this.companionLanToken = token || undefined
        this.emitter.emit("config.changed", this)
        this.emitter.emit("config.changed.companionLan")
    }

    setNullConfiguration(nullConfiguration: NullConfiguration) {
        this.nullConfiguration = nullConfiguration.clone()
        this.emitter.emit("config.changed", this)
        this.emitter.emit("config.changed.null", this.nullConfiguration)
    }

    getObsConfiguration() {
        return this.obsConfiguration.clone()
    }

    setObsConfiguration(obsConfiguration: ObsConfiguration) {
        this.obsConfiguration = obsConfiguration.clone()
        this.emitter.emit("config.changed", this)
        this.emitter.emit("config.changed.obs", this.obsConfiguration)
    }

    getRolandV8HDConfiguration() {
        return this.rolandV8HDConfiguration.clone()
    }

    setRolandV8HDConfiguration(rolandV8HDConfiguration: RolandV8HDConfiguration) {
        this.rolandV8HDConfiguration = rolandV8HDConfiguration.clone()
        this.emitter.emit("config.changed", this)
        this.emitter.emit("config.changed.rolandV8HD", this.rolandV8HDConfiguration)
    }

    getRolandV60HDConfiguration() {
        return this.rolandV60HDConfiguration.clone()
    }

    setRolandV60HDConfiguration(rolandV60HDConfiguration: RolandV60HDConfiguration) {
        this.rolandV60HDConfiguration = rolandV60HDConfiguration.clone()
        this.emitter.emit("config.changed", this)
        this.emitter.emit("config.changed.rolandV60HD", this.rolandV60HDConfiguration)
    }

    getTestConfiguration() {
        return this.testConfiguration.clone()
    }

    setTestConfiguration(testConfiguration: TestConfiguration) {
        this.testConfiguration = testConfiguration.clone()
        this.emitter.emit("config.changed", this)
        this.emitter.emit("config.changed.test", this.testConfiguration)
    }

    getVmixConfiguration() {
        return this.vmixConfiguration.clone()
    }

    setVmixConfiguration(vmixConfiguration: VmixConfiguration) {
        this.vmixConfiguration = vmixConfiguration.clone()
        this.emitter.emit("config.changed", this)
        this.emitter.emit("config.changed.vmix", this.vmixConfiguration)
    }

    getTallyConfiguration() {
        return this.tallyConfiguration.clone()
    }

    setTallyConfiguration(configuration: DefaultTallyConfiguration) {
        this.tallyConfiguration = configuration.clone()
        this.emitter.emit("config.changed", this)
        this.emitter.emit("config.changed.tallyconfig", this.tallyConfiguration)
    }

    setChannels(channels: Channel[]) {
        this.channels = channels
        this.emitter.emit('config.changed', this)
        this.emitter.emit('config.changed.channels', this.channels)
    }

    getChannels() {
        return this.channels
    }
    getChannelsAsJson() {
        return this.channels.map(channel => channel.toJson())
    }

    setTallies(tallies: Tally[]) {
        this.tallies = tallies
        this.emitter.emit('config.changed', this)
        this.emitter.emit('config.changed.tallies', this.tallies)
    }
    getTallies() {
        return this.tallies
    }

    getVmixProjectProfile(presetPath: string) {
        return this.vmixProjectProfiles[presetPath.toLowerCase()]
    }

    hasVmixProjectProfile(presetPath: string) {
        return this.getVmixProjectProfile(presetPath) !== undefined
    }

    setVmixProjectProfile(presetPath: string, tallies: TallySaveObjectType[]) {
        this.vmixProjectProfiles[presetPath.toLowerCase()] = {
            presetPath,
            savedAt: new Date().toISOString(),
            tallies,
        }
        this.emitter.emit('config.changed', this)
    }

    setMixerSelection(mixerSelection: string) {
        this.mixerSelection = mixerSelection
        this.emitter.emit("config.changed", this)
        this.emitter.emit("config.changed.mixer", mixerSelection)
    }
    getMixerSelection() {
        return this.mixerSelection
    }

    isDev() {
        return process.env.NODE_ENV !== 'production'
    }

    isTest() {
        return process.env.HUB_WITH_TEST === 'true'
    }

    getHttpPort() {
        return (typeof process.env.PORT === "string" && parseInt(process.env.PORT, 10)) || 3000
    }

    getTallyPort() {
        return this.tallyPort
    }

    getTallyHighlightTime() {
        return this.tallyHighlightTime
    }

    // the more keep alives you send the less likely it is that
    // the tally shows a wrong state, but you send more packages
    // over the network.
    getTallyKeepAlivesPerSecond() {
        return this.tallyKeepAlivesPerSecond
    }

    setTallyTimeoutDisconnected(timeout: number) {
        if (timeout < 1000) { throw new Error(`timeout too small: ${timeout}ms`) }
        this.tallyTimeoutDisconnected = timeout
    }

    getTallyTimeoutDisconnected() {
        return this.tallyTimeoutDisconnected
    }

    setTallyTimeoutMissing(timeout: number) {
        if (timeout < 1000) { throw new Error(`timeout too small: ${timeout}ms`) }
        this.tallyTimeoutMissing = timeout
    }

    getTallyTimeoutMissing() {
        return this.tallyTimeoutMissing
    }
}
