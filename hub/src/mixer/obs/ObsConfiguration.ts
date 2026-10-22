import ipAddress, {IpAddress} from '../../domain/IpAddress'
import ipPort, {IpPort} from '../../domain/IpPort'
import {Configuration} from '../interfaces'

export type ObsConfigurationSaveType = {
    ip: string
    port: number
    password?: string
    liveMode?: ObsConfigurationLiveMode
}

export type ObsConfigurationLiveMode = "always" | "stream" | "record" | "streamOrRecord"

class ObsConfiguration extends Configuration {
    ip: IpAddress
    port: IpPort
    // obs-websocket server password; empty when authentication is off in OBS
    password: string
    liveMode: ObsConfigurationLiveMode


    constructor() {
        super()
        this.ip = ObsConfiguration.defaultIp
        this.port = ObsConfiguration.defaultPort
        this.password = ""
        this.liveMode = ObsConfiguration.defaultLiveMode
    }

    fromJson(data: ObsConfigurationSaveType): void {
        this.loadIpAddress("ip", this.setIp.bind(this), data)
        this.loadIpPort("port", this.setPort.bind(this), data)
        // Settings saved before obs-websocket 5 support (no password field) still
        // carry the old default 4444; OBS 28+ listens on 4455. A port chosen
        // later is kept, including 4444.
        if (data.password === undefined && data.port === ObsConfiguration.legacyPort) this.setPort(ObsConfiguration.defaultPort)
        this.loadString("password", this.setPassword.bind(this), data)
        if (data.liveMode) this.setLiveMode(data.liveMode)
    }
    toJson(): ObsConfigurationSaveType {
        return {
            ip: this.ip.toString(),
            port: this.port.toNumber(),
            password: this.password,
            liveMode: this.liveMode,
        }
    }
    clone(): ObsConfiguration {
        const clone = new ObsConfiguration()
        clone.fromJson(this.toJson())
        return clone
    }

    setIp(ip: IpAddress | string | null) {
        if (typeof ip === "string") {
            ip = ipAddress(ip)
        } else if (ip === null) {
            ip = ObsConfiguration.defaultIp
        }
        this.ip = ip
        
        return this
    }
    getIp() {
        return this.ip
    }

    setPort(port: IpPort | string | number | null) {
        if (typeof port === "number" || typeof port === "string") {
            port = ipPort(port)
        } else if (port === null) {
            port = ObsConfiguration.defaultPort
        }
        this.port = port
        
        return this
    }
    getPort() {
        return this.port
    }

    setPassword(password: string | null) {
        this.password = password || ""
        return this
    }
    getPassword() {
        return this.password
    }

    setLiveMode(mode: ObsConfigurationLiveMode) {
        this.liveMode = mode
    }
    getLiveMode() {
        return this.liveMode
    }

    private static readonly defaultIp = ipAddress("127.0.0.1")
    private static readonly defaultPort = ipPort(4455)
    private static readonly legacyPort = 4444
    private static readonly defaultLiveMode = "always"

    static isValidLiveMode(theString: string): theString is ObsConfigurationLiveMode {
        return theString === "always" || theString === "streamOrRecord" || theString === "stream" || theString === "record"
    }

}

export default ObsConfiguration
