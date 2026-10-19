import NodeMcuConnector, { isSupportedSerialPort } from './NodeMcuConnector'
import * as FirmwareAssets from './FirmwareAssets'

// Serial transport mock only. This is NOT physical ESP8266 acceptance.
describe('NodeMCU reset recovery', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(() => jest.useRealTimers())

  const fakeDevice = () => ({
    onError: jest.fn(),
    isConnected: jest.fn().mockReturnValue(false),
    hardreset: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    connect: jest.fn().mockResolvedValue(undefined),
    purge: jest.fn().mockResolvedValue(undefined),
    checkConnection: jest.fn(),
  })

  test('rejects a hung check within a deadline, not from an uncaught timer', async () => {
    const device = fakeDevice()
    device.checkConnection.mockImplementation(() => new Promise(() => {}))
    const connector = new NodeMcuConnector(device)
    const operation = (connector as unknown as {hardReset(path: string): Promise<void>}).hardReset('COM1')
    const rejected = expect(operation).rejects.toThrow('Could not connect to NodeMCU after hardreset')
    await jest.advanceTimersByTimeAsync(20000)
    await rejected
  })

  test('does not query the ESP before it had time to boot after the reset', async () => {
    const device = fakeDevice()
    device.checkConnection.mockResolvedValue(true)
    const connector = new NodeMcuConnector(device)
    const operation = (connector as unknown as {hardReset(path: string): Promise<void>}).hardReset('COM1')
    // reset settle 1 s + purge settle 0.2 s + boot wait 3 s
    await jest.advanceTimersByTimeAsync(4100)
    expect(device.connect).toHaveBeenCalledWith('COM1', 115200, false)
    expect(device.checkConnection).not.toHaveBeenCalled()
    await jest.advanceTimersByTimeAsync(200)
    await expect(operation).resolves.toBeUndefined()
    expect(device.checkConnection).toHaveBeenCalledTimes(1)
  })

  test('discards stale serial input after opening the port, before any command', async () => {
    const device = fakeDevice()
    const order: string[] = []
    device.connect.mockImplementation(async () => { order.push('connect') })
    device.purge.mockImplementation(async () => { order.push('purge') })
    device.checkConnection.mockImplementation(async () => { order.push('check'); return true })
    const connector = new NodeMcuConnector(device)
    const operation = (connector as unknown as {hardReset(path: string): Promise<void>}).hardReset('COM1')
    await jest.advanceTimersByTimeAsync(5000)
    await operation
    expect(order).toEqual(['connect', 'purge', 'check'])
  })

  test('retries transient reset failures and completes', async () => {
    const device = fakeDevice()
    device.checkConnection.mockRejectedValueOnce(new Error('booting'))
      .mockResolvedValueOnce(true)
    const connector = new NodeMcuConnector(device)
    const operation = (connector as unknown as {hardReset(path: string): Promise<void>}).hardReset('COM1')
    await jest.advanceTimersByTimeAsync(5000)
    await expect(operation).resolves.toBeUndefined()
    expect(device.hardreset).toHaveBeenCalledTimes(1)
    expect(device.connect).toHaveBeenCalledTimes(1)
  })
})

describe('NodeMCU timeout quarantine and transport cleanup (simulated device)', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    // No real filesystem I/O while advancing a simulated serial transport clock.
    jest.spyOn(FirmwareAssets, 'findFirmwareFiles').mockResolvedValue([])
  })
  afterEach(() => {
    jest.restoreAllMocks()
    jest.useRealTimers()
  })

  test('late connect after timeout is closed before another job starts and mutex is released', async () => {
    let open = false
    let active = 0
    let maxActive = 0
    let resolveLate: (() => void) | undefined
    const stalled = new Promise<void>(resolve => { resolveLate = resolve })
    const device = {
      purge: jest.fn().mockResolvedValue(undefined),
      onError: jest.fn(),
      isConnected: jest.fn(() => open),
      listDevices: jest.fn().mockResolvedValue([{ path: 'COM1', vendorId: '1a86' }]),
      connect: jest.fn()
        .mockImplementationOnce(async () => {
          active++
          maxActive = Math.max(maxActive, active)
          await stalled
          open = true
          active--
        })
        .mockImplementationOnce(async () => {
          active++
          maxActive = Math.max(maxActive, active)
          open = true
          active--
        }),
      disconnect: jest.fn(async () => { open = false }),
      checkConnection: jest.fn().mockResolvedValue(true),
      deviceInfo: jest.fn().mockResolvedValue({ chipID: 'X', flashID: 'Y', version: '1', modules: [] }),
      fsinfo: jest.fn().mockResolvedValue({ files: [] }),
    }
    const connector = new NodeMcuConnector(device)
    const first = connector.getDevice()
    await jest.advanceTimersByTimeAsync(5500)
    const failed = await first
    expect(String(failed.errorMessage)).toContain('timed out')
    expect(device.connect).toHaveBeenCalledTimes(1)

    const second = connector.getDevice()
    await jest.advanceTimersByTimeAsync(500)
    expect(device.connect).toHaveBeenCalledTimes(1)
    expect(maxActive).toBe(1)

    resolveLate!()
    await jest.advanceTimersByTimeAsync(500)
    const recovered = await second
    expect(recovered.errorMessage).toBeUndefined()
    expect(device.connect).toHaveBeenCalledTimes(2)
    expect(device.disconnect).toHaveBeenCalledTimes(2)
    expect(open).toBe(false)
    expect(maxActive).toBe(1)

    const third = connector.getDevice()
    await jest.advanceTimersByTimeAsync(400)
    expect((await third).errorMessage).toBeUndefined()
    expect(open).toBe(false)
  })

  test('retry after a rejected connect releases mutex after cleanup', async () => {
    let open = false
    const device = {
      purge: jest.fn().mockResolvedValue(undefined),
      onError: jest.fn(), isConnected: jest.fn(() => open),
      listDevices: jest.fn().mockResolvedValue([{path:'COM3', vendorId: '10C4'}]),
      connect: jest.fn().mockRejectedValueOnce(new Error('temporary serial failure'))
        .mockImplementationOnce(async () => {open=true}),
      checkConnection: jest.fn().mockResolvedValue(true),
      deviceInfo: jest.fn().mockResolvedValue({chipID:'X',flashID:'Y',version:'1',modules:[]}),
      fsinfo: jest.fn().mockResolvedValue({files:[]}),
      disconnect: jest.fn(async () => {open=false}),
    }
    const connector = new NodeMcuConnector(device)
    const first=connector.getDevice()
    await jest.advanceTimersByTimeAsync(400)
    expect(String((await first).errorMessage)).toContain('temporary serial failure')
    const second=connector.getDevice()
    await jest.advanceTimersByTimeAsync(400)
    expect((await second).errorMessage).toBeUndefined()
    expect(device.connect).toHaveBeenCalledTimes(2)
    expect(device.disconnect).toHaveBeenCalledTimes(1)
    expect(open).toBe(false)
  })
})

describe('NodeMCU serial port detection', () => {
  test('accepts CH340, CP2102 and FTDI bridges regardless of case', () => {
    expect(isSupportedSerialPort({ vendorId: '1a86' })).toBe(true)
    expect(isSupportedSerialPort({ vendorId: '10C4' })).toBe(true)
    expect(isSupportedSerialPort({ vendorId: '0403' })).toBe(true)
  })

  test('ignores unknown or unidentified ports', () => {
    expect(isSupportedSerialPort({ vendorId: '1234' })).toBe(false)
    expect(isSupportedSerialPort({})).toBe(false)
  })

  test('selects an FTDI board from the unfiltered port list', async () => {
    const device = {
      purge: jest.fn().mockResolvedValue(undefined),
      onError: jest.fn(),
      isConnected: jest.fn(() => false),
      listDevices: jest.fn().mockResolvedValue([
        { path: '/dev/ttyS0' },
        { path: '/dev/ttyUSB0', vendorId: '0403', productId: '6001' },
      ]),
      connect: jest.fn().mockRejectedValue(new Error('port busy')),
      disconnect: jest.fn(),
    }
    const result = await new NodeMcuConnector(device).getDevice()
    expect(device.listDevices).toHaveBeenCalledWith(true)
    expect(device.connect).toHaveBeenCalledWith('/dev/ttyUSB0', 115200, false)
    expect(result.path).toBe('/dev/ttyUSB0')
    expect(result.vendorId).toBe('0403')
  })

  test('reports connection errors as text that survives JSON serialization', async () => {
    const device = {
      purge: jest.fn().mockResolvedValue(undefined),
      onError: jest.fn(),
      isConnected: jest.fn(() => false),
      listDevices: jest.fn().mockResolvedValue([{ path: 'COM5', vendorId: '0403' }]),
      connect: jest.fn().mockRejectedValue(new Error('port busy')),
      disconnect: jest.fn(),
    }
    const result = await new NodeMcuConnector(device).getDevice()
    expect(JSON.parse(JSON.stringify(result.toJson())).errorMessage).toBe('port busy')
  })
})
