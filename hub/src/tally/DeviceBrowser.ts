import { Bonjour } from 'bonjour-service'
import DeviceRegistry from './DeviceRegistry'

// Finds firmware v2 tallies over mDNS (_gctally-device._udp, TXT v id fw name
// pair) for the device list, also those not talking to this Hub yet (#28).
export const DEVICE_SERVICE_TYPE = 'gctally-device'

export type FoundService = {
  name: string
  port: number
  txt?: Record<string, unknown>
  addresses?: string[]
  referer?: { address: string }
}

type ServiceBrowser = {
  on(event: 'up' | 'down', listener: (service: FoundService) => void): unknown
  on(event: 'txt-update' | 'srv-update', listener: (service: FoundService) => void): unknown
  update(): void
  expire(): void
  stop(): void
}

export type BrowserFactory = (onError: (error: Error) => void) => { find(): ServiceBrowser, destroy(): void }

const defaultFactory: BrowserFactory = (onError) => {
  const bonjour = new Bonjour({}, onError)
  const mdns = (bonjour as unknown as { server: { mdns: NodeJS.EventEmitter } }).server.mdns
  mdns.on('error', onError)
  mdns.on('warning', (error: Error) => console.warn(`mDNS: ${error.message}`))
  return {
    find: () => bonjour.find({ type: DEVICE_SERVICE_TYPE, protocol: 'udp' }) as unknown as ServiceBrowser,
    destroy: () => bonjour.destroy(),
  }
}

const REFRESH_MS = 15000

function text(value: unknown) {
  if (typeof value === 'string') return value
  if (Buffer.isBuffer(value)) return value.toString('utf8')
  return undefined
}

export default class DeviceBrowser {
  private browser?: ServiceBrowser
  private destroy?: () => void
  private timer?: NodeJS.Timeout

  constructor(private readonly registry: DeviceRegistry, private readonly factory: BrowserFactory = defaultFactory) {}

  start() {
    try {
      const bonjour = this.factory(error => this.failed(error))
      this.destroy = bonjour.destroy
      this.browser = bonjour.find()
      this.browser.on('up', service => this.up(service))
      this.browser.on('txt-update', service => this.up(service))
      this.browser.on('srv-update', service => this.up(service))
      this.browser.on('down', service => this.down(service))
      // ask again, and drop tallies that went away without a goodbye
      this.timer = setInterval(() => {
        this.browser?.expire()
        this.browser?.update()
      }, REFRESH_MS)
      this.timer.unref?.()
    } catch (error) {
      this.failed(error as Error)
    }
  }

  stop() {
    if (this.timer) clearInterval(this.timer)
    this.timer = undefined
    try {
      this.browser?.stop()
      this.destroy?.()
    } catch (error) {
      console.warn(`mDNS: ${(error as Error).message}`)
    }
    this.browser = undefined
    this.destroy = undefined
  }

  private up(service: FoundService) {
    const id = text(service.txt?.id)
    if (!id || !/^[0-9a-f]{1,16}$/.test(id)) return
    const address = service.addresses?.find(a => /^\d+\.\d+\.\d+\.\d+$/.test(a)) ?? service.referer?.address
    this.registry.mdnsUp(id, text(service.txt?.name) || service.name, text(service.txt?.fw), address, service.port, text(service.txt?.pair))
  }

  private down(service: FoundService) {
    const id = text(service.txt?.id)
    if (id) this.registry.mdnsDown(id)
  }

  private failed(error: Error) {
    console.error(`mDNS search for tallies failed, the device list shows only tallies that talk to this Hub: ${error.message}`)
    this.stop()
  }
}
