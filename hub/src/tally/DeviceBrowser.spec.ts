import { EventEmitter } from 'events'
import DeviceBrowser, { BrowserFactory, FoundService } from './DeviceBrowser'
import DeviceRegistry from './DeviceRegistry'

class FakeBrowser extends EventEmitter {
  update = jest.fn()
  expire = jest.fn()
  stop = jest.fn()
}

function setup() {
  const browser = new FakeBrowser()
  const destroy = jest.fn()
  const factory: BrowserFactory = () => ({ find: () => browser, destroy })
  const registry = { mdnsUp: jest.fn(), mdnsDown: jest.fn() } as unknown as DeviceRegistry
  const deviceBrowser = new DeviceBrowser(registry, factory)
  deviceBrowser.start()
  return { browser, destroy, registry, deviceBrowser }
}

const service: FoundService = {
  name: 'Tally-CAM1',
  port: 7411,
  txt: { v: '1', id: 'a1b2c3', fw: '2.0.0', name: 'CAM1', pair: '-' },
  addresses: ['fe80::1', '10.0.0.5'],
}

describe('DeviceBrowser', () => {
  afterEach(() => jest.useRealTimers())

  test('passes found tallies to the registry', () => {
    const { browser, registry, deviceBrowser } = setup()
    browser.emit('up', service)
    expect(registry.mdnsUp).toHaveBeenCalledWith('a1b2c3', 'CAM1', '2.0.0', '10.0.0.5', 7411, '-')
    browser.emit('txt-update', { ...service, txt: { ...service.txt, pair: '1a2b3c4d' } })
    expect(registry.mdnsUp).toHaveBeenLastCalledWith('a1b2c3', 'CAM1', '2.0.0', '10.0.0.5', 7411, '1a2b3c4d')
    browser.emit('down', service)
    expect(registry.mdnsDown).toHaveBeenCalledWith('a1b2c3')
    deviceBrowser.stop()
  })

  test('skips services without a device id and uses the referer without an IPv4 address', () => {
    const { browser, registry, deviceBrowser } = setup()
    browser.emit('up', { name: 'x', port: 7411, txt: {} })
    expect(registry.mdnsUp).not.toHaveBeenCalled()
    browser.emit('up', { ...service, addresses: [], referer: { address: '10.0.0.9' } })
    expect(registry.mdnsUp).toHaveBeenCalledWith('a1b2c3', 'CAM1', '2.0.0', '10.0.0.9', 7411, '-')
    deviceBrowser.stop()
  })

  test('asks again regularly and stops cleanly', () => {
    jest.useFakeTimers()
    const { browser, destroy, deviceBrowser } = setup()
    jest.advanceTimersByTime(15000)
    expect(browser.expire).toHaveBeenCalled()
    expect(browser.update).toHaveBeenCalled()
    deviceBrowser.stop()
    expect(browser.stop).toHaveBeenCalled()
    expect(destroy).toHaveBeenCalled()
  })
})
