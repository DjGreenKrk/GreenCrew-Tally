import os from 'os'
import { Bonjour, Service } from 'bonjour-service'
import { HubDiscoveryState } from './HubDiscoveryState'

// Announces the Hub over mDNS/DNS-SD so firmware v2 tallies find it without
// an IP address (#28):
//
//   GC Tally Hub <id>._gctally._udp.local   SRV gctally-hub-<id>.local:<tally port>
//                                           TXT v=1 id=<id> name=<computer name>
//
// The host name carries the Hub id too: the ESP8266 mDNS query returns host
// names, IPs and ports, but not TXT records.
export const SERVICE_TYPE = 'gctally'
export const DISCOVERY_VERSION = '1'

type Responder = {
    publish(config: { name: string, type: string, protocol: 'udp', port: number, host: string, txt: Record<string, string>, disableIPv6: boolean }): Pick<Service, 'stop'> & { on(event: 'error', listener: (error: Error) => void): unknown }
    unpublishAll(callback?: () => void): void
    destroy(): void
}
export type ResponderFactory = (onError: (error: Error) => void) => Responder

const defaultFactory: ResponderFactory = (onError) => {
    const bonjour = new Bonjour({}, onError)
    // multicast-dns reports socket errors (e.g. port 5353 not available) as
    // events; without a listener they would stop the Hub.
    const mdns = (bonjour as unknown as { server: { mdns: NodeJS.EventEmitter } }).server.mdns
    mdns.on('error', onError)
    mdns.on('warning', (error: Error) => console.warn(`mDNS: ${error.message}`))
    return bonjour
}

export function hostNameFor(hubId: string) {
    return `gctally-hub-${hubId}.local`
}

export default class HubAnnouncer {
    private responder?: Responder
    private state: HubDiscoveryState
    private readonly factory: ResponderFactory
    private readonly onChange: (state: HubDiscoveryState) => void

    constructor(onChange: (state: HubDiscoveryState) => void = () => {}, factory: ResponderFactory = defaultFactory) {
        this.onChange = onChange
        this.factory = factory
        this.state = { status: 'off', hubId: '', serviceName: '', port: 0 }
    }

    getState(): HubDiscoveryState {
        return { ...this.state }
    }

    start(hubId: string, port: number) {
        this.stop()
        const name = `GC Tally Hub ${hubId}`
        this.state = { status: 'active', hubId, serviceName: `${name}._${SERVICE_TYPE}._udp.local`, port }
        try {
            this.responder = this.factory(error => this.failed(error))
            const service = this.responder.publish({
                name,
                type: SERVICE_TYPE,
                protocol: 'udp',
                port,
                host: hostNameFor(hubId),
                txt: { v: DISCOVERY_VERSION, id: hubId, name: os.hostname().slice(0, 40) },
                disableIPv6: true,
            })
            service.on('error', error => this.failed(error))
            console.info(`Announcing the Hub over mDNS as "${name}" (id ${hubId}, port ${port})`)
        } catch (error) {
            this.failed(error as Error)
            return
        }
        this.onChange(this.getState())
    }

    // Keeps the id so the page can still show it.
    disable(hubId: string, port: number) {
        this.stop()
        this.state = { status: 'off', hubId, serviceName: '', port }
        this.onChange(this.getState())
    }

    // Says goodbye (TTL 0) so tallies drop this Hub at once, then closes.
    stop(done: () => void = () => {}) {
        const responder = this.responder
        this.responder = undefined
        if (!responder) {
            done()
            return
        }
        const close = () => {
            try {
                responder.destroy()
            } catch (error) {
                console.warn(`mDNS: ${(error as Error).message}`)
            }
            done()
        }
        try {
            responder.unpublishAll(close)
        } catch {
            close()
        }
    }

    private failed(error: Error) {
        console.error(`mDNS announcement failed, v2 tallies need hub.ip: ${error.message}`)
        const responder = this.responder
        this.responder = undefined
        try {
            responder?.destroy()
        } catch {
            // already broken
        }
        this.state = { ...this.state, status: 'error', error: error.message }
        this.onChange(this.getState())
    }
}
