import { Configuration } from '../mixer/interfaces'

export type EspNowGatewayConfigurationSaveType = {
    enabled: boolean
    serialPort: string
}

// Where the ESP-NOW gateway (#25) is plugged in. Off by default: most Hubs
// have no gateway, and EspNowGatewayTallyDriver only opens the port when
// this is enabled.
class EspNowGatewayConfiguration extends Configuration {
    enabled: boolean
    serialPort: string

    constructor() {
        super()
        this.enabled = false
        this.serialPort = ""
    }

    fromJson(data: EspNowGatewayConfigurationSaveType): void {
        this.loadString("serialPort", this.setSerialPort.bind(this), data)
        if (typeof data["enabled"] === "boolean") this.setEnabled(data["enabled"])
    }

    toJson(): EspNowGatewayConfigurationSaveType {
        return {
            enabled: this.enabled,
            serialPort: this.serialPort,
        }
    }

    clone(): EspNowGatewayConfiguration {
        const clone = new EspNowGatewayConfiguration()
        clone.fromJson(this.toJson())
        return clone
    }

    setEnabled(enabled: boolean) {
        this.enabled = enabled
        return this
    }
    getEnabled() {
        return this.enabled
    }

    setSerialPort(serialPort: string) {
        this.serialPort = serialPort
        return this
    }
    getSerialPort() {
        return this.serialPort
    }
}

export default EspNowGatewayConfiguration
