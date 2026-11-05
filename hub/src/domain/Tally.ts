import { TallyConfiguration, TallyConfigurationObjectType } from '../tally/TallyConfiguration'
import Log from './Log'

export enum ConnectionState {
    DISCONNECTED = 0,
    CONNECTED = 1,
    MISSING = 2,
}

type ClientAddress = {
    address: string
}

export type TallySaveObjectType = {
    name: string
    type?: TallyType
    channelId?: string
    channelIds?: string[]
} & TallyConfigurationObjectType

export type TallyObjectType = {
    name: string
    type: TallyType
    channelId?: string
    channelIds?: string[]
} & TallyConfigurationObjectType

export interface UdpTallyObjectType extends TallyObjectType {
    address?: string
    port?: number
    device?: TallyDevice
    state: ConnectionState
}

export interface WebTallyObjectType extends TallyObjectType {
    connectedClients: ClientAddress[]
}

// An ESP-NOW tally (#25): no IP address, addressed by its MAC (12 lowercase
// hex digits, no separators) through the Hub's EspNowGatewayTallyDriver.
export interface EspNowTallyObjectType extends TallyObjectType {
    mac?: string
    device?: TallyDevice
    state: ConnectionState
}

// Sent by firmware v2 after the name: 'gc/1 id=a1b2c3 fw=2.0.0 hw=esp8266 caps=ws2812,pwm'.
// The NodeMCU firmware sends only the name; older Hubs ignore the rest.
export type TallyDevice = {
  protocol: number
  id?: string
  firmware?: string
  hardware?: string
  capabilities: string[]
}

export type TallyType = "udp" | "web" | "espnow"

export abstract class Tally {
    name: string
    channelIds: string[]
    highlight: boolean = false
    logs: Log[] = []
    readonly type: TallyType
    configuration: TallyConfiguration
    hasStageLight: boolean = true

    constructor(name: string, channelIds: string|string[] = []) {
        this.name = name
        this.channelIds = typeof channelIds === "string" ? [channelIds] : channelIds
        this.configuration = new TallyConfiguration()
    }
    get channelId() : string|undefined {
        return this.channelIds[0]
    }
    set channelId(channelId: string|undefined) {
        this.channelIds = channelId === undefined ? [] : [channelId]
    }
    isPatched() : boolean {
        return this.channelIds.length > 0
    }
    abstract isConnected() : boolean
    abstract isDisconnected() : boolean
    abstract isActive() : boolean
    abstract isMissing() : boolean
    setHighlight(highlight: boolean) : void {
        this.highlight = highlight
    }
    isHighlighted() : boolean {
        return this.highlight
    }

    isWebTally() : this is WebTally {
        return this.type === "web"
    }

    isUdpTally() : this is UdpTally {
        return this.type === "udp"
    }

    isEspNowTally() : this is EspNowTally {
        return this.type === "espnow"
    }

    addLog(log: Log) {
        this.logs.push(log)
        return log
    }
    getLogs() {
        return this.logs
    }

    getId() {
        return `${this.type}-${this.name}`
    }

    isIn(channelNames: string[] = []) : boolean {
        if (channelNames === null) return false

        return this.channelIds.some(channelId => channelNames.indexOf(channelId) !== -1)
    }

    setConfiguration(conf: TallyConfiguration) {
        this.configuration = conf
    }

    toJsonForSave(): TallySaveObjectType {
        return {
            name: this.name,
            type: this.type,
            channelIds: this.channelIds,
            ...this.configuration.toJson(),
        }
    }

    static fromJsonForSave(valueObject: TallySaveObjectType) : UdpTally | WebTally | EspNowTally {
        const channelIds = valueObject.channelIds || (valueObject.channelId ? [valueObject.channelId] : [])
        const tally = valueObject.type === "web" ? new WebTally(valueObject.name, channelIds) :
            valueObject.type === "espnow" ? new EspNowTally(valueObject.name, channelIds) :
            // UdpTally was the previous default. So if no type is set we also expect an Udp Tally
            new UdpTally(valueObject.name, channelIds)

        const configuration = new TallyConfiguration()
        configuration.fromJson(valueObject)
        tally.setConfiguration(configuration)

        return tally
    }

    toJson(): TallyObjectType {
        return {
            name: this.name,
            type: this.type,
            channelIds: this.channelIds,
            ...this.configuration.toJson(),
        }
    }
    static fromJson(valueObject: TallyObjectType) {
        if (valueObject.type === "web") {
            return WebTally.fromJson(valueObject as WebTallyObjectType)
        } else if (valueObject.type === "espnow") {
            return EspNowTally.fromJson(valueObject as EspNowTallyObjectType)
        } else {
            return UdpTally.fromJson(valueObject as UdpTallyObjectType)
        }
    }
}

export class UdpTally extends Tally {
    address?: string
    port?: number
    state: ConnectionState
    // what the tally said about itself; known only while it reports, never saved
    device?: TallyDevice
    readonly type = "udp"

    constructor(name: string, channelIds: string|string[] = [], address?: string, port?: number, state: ConnectionState = ConnectionState.DISCONNECTED) {
        super(name, channelIds)
        this.address = address
        this.port = port
        this.state = state
    }

    isConnected() : boolean {
        return this.address !== undefined && this.port !== undefined && this.state === ConnectionState.CONNECTED
    }
    isDisconnected(): boolean {
        return !this.isActive()
    }
    isActive() : boolean {
        return this.address !== undefined && this.port !== undefined && this.state !== ConnectionState.DISCONNECTED
    }
    isMissing() : boolean {
        return this.address !== undefined && this.port !== undefined && this.state === ConnectionState.MISSING
    }

    toJson(): UdpTallyObjectType {
        return {
            ...super.toJson(),
            address: this.address,
            port: this.port,
            state: this.state,
            device: this.device,
        }
    }
    static fromJson(valueObject: UdpTallyObjectType) {
        const tally = new UdpTally(
            valueObject.name,
            valueObject.channelIds || (valueObject.channelId ? [valueObject.channelId] : []),
            valueObject.address,
            valueObject.port,
            valueObject.state
        )
        tally.device = valueObject.device
        tally.configuration.fromJson(valueObject)
        return tally
    }

}

export class EspNowTally extends Tally {
    // 12 lowercase hex digits, no separators (same as the tally's "id" in
    // tally-ho); undefined until the gateway relays its first message.
    mac?: string
    state: ConnectionState
    device?: TallyDevice
    readonly type = "espnow"

    constructor(name: string, channelIds: string|string[] = [], mac?: string, state: ConnectionState = ConnectionState.DISCONNECTED) {
        super(name, channelIds)
        this.mac = mac
        this.state = state
    }

    isConnected() : boolean {
        return this.mac !== undefined && this.state === ConnectionState.CONNECTED
    }
    isDisconnected(): boolean {
        return !this.isActive()
    }
    isActive() : boolean {
        return this.mac !== undefined && this.state !== ConnectionState.DISCONNECTED
    }
    isMissing() : boolean {
        return this.mac !== undefined && this.state === ConnectionState.MISSING
    }

    toJson(): EspNowTallyObjectType {
        return {
            ...super.toJson(),
            mac: this.mac,
            state: this.state,
            device: this.device,
        }
    }
    static fromJson(valueObject: EspNowTallyObjectType) {
        const tally = new EspNowTally(
            valueObject.name,
            valueObject.channelIds || (valueObject.channelId ? [valueObject.channelId] : []),
            valueObject.mac,
            valueObject.state
        )
        tally.device = valueObject.device
        tally.configuration.fromJson(valueObject)
        return tally
    }
}

export class WebTally extends Tally {
    readonly type = "web"
    connectedClients: ClientAddress[]

    constructor(name: string, channelIds: string|string[] = [], connectedClients?: ClientAddress[]) {
        super(name, channelIds)

        this.connectedClients = connectedClients || []
        this.hasStageLight = false
    }

    isConnected() : boolean {
        return this.connectedClients.length > 0
    }
    isDisconnected(): boolean {
        return !this.isConnected()
    }
    isActive(): boolean {
        return this.isConnected()
    }
    isMissing(): boolean {
        return false
    }

    toJson(): WebTallyObjectType {
        return {
            ...super.toJson(),
            connectedClients: this.connectedClients
        }
    }

    static fromJson(valueObject: WebTallyObjectType) {
        const tally = new WebTally(
            valueObject.name,
            valueObject.channelIds || (valueObject.channelId ? [valueObject.channelId] : []),
            valueObject.connectedClients
        )
        tally.configuration.fromJson(valueObject)
        return tally
    }
}

export default Tally
