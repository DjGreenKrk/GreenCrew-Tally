import NodeMcuConnector from './NodeMcuConnector'

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
    checkConnection: jest.fn(),
  })

  test('rejects a hung check within a deadline, not from an uncaught timer', async () => {
    const device = fakeDevice()
    device.checkConnection.mockResolvedValueOnce(true)
      .mockImplementation(() => new Promise(() => {}))
    const connector = new NodeMcuConnector(device)
    const operation = (connector as any).hardReset('COM1')
    const rejected = expect(operation).rejects.toThrow('Could not connect to NodeMCU after hardreset')
    await jest.advanceTimersByTimeAsync(20000)
    await rejected
  })

  test('retries transient reset failures and completes', async () => {
    const device = fakeDevice()
    device.checkConnection.mockResolvedValueOnce(true)
      .mockRejectedValueOnce(new Error('booting'))
      .mockResolvedValueOnce(true)
    const connector = new NodeMcuConnector(device)
    const operation = (connector as any).hardReset('COM1')
    await jest.advanceTimersByTimeAsync(5000)
    await expect(operation).resolves.toBeUndefined()
    expect(device.hardreset).toHaveBeenCalledTimes(1)
    expect(device.connect).toHaveBeenCalledTimes(1)
  })
})

describe('NodeMCU timeout quarantine and transport cleanup (simulated device)', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(() => jest.useRealTimers())

  test('late connect after timeout is closed before another job starts and mutex is released', async () => {
    let open = false
    let active = 0
    let maxActive = 0
    let resolveLate: (() => void) | undefined
    const stalled = new Promise<void>(resolve => { resolveLate = resolve })
    const device = {
      onError: jest.fn(),
      isConnected: jest.fn(() => open),
      listDevices: jest.fn().mockResolvedValue([{ path: 'COM1', vendorId: '1234' }]),
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
    await jest.advanceTimersByTimeAsync(150)
    expect((await third).errorMessage).toBeUndefined()
    expect(open).toBe(false)
  })

  test('retry after a rejected connect releases mutex after cleanup', async () => {
    let open = false
    const device = {
      onError: jest.fn(), isConnected: jest.fn(() => open),
      listDevices: jest.fn().mockResolvedValue([{path:'COM3'}]),
      connect: jest.fn().mockRejectedValueOnce(new Error('temporary serial failure'))
        .mockImplementationOnce(async () => {open=true}),
      checkConnection: jest.fn().mockResolvedValue(true),
      deviceInfo: jest.fn().mockResolvedValue({chipID:'X',flashID:'Y',version:'1',modules:[]}),
      fsinfo: jest.fn().mockResolvedValue({files:[]}),
      disconnect: jest.fn(async () => {open=false}),
    }
    const connector = new NodeMcuConnector(device)
    const first=connector.getDevice()
    await jest.advanceTimersByTimeAsync(200)
    expect(String((await first).errorMessage)).toContain('temporary serial failure')
    const second=connector.getDevice()
    await jest.advanceTimersByTimeAsync(200)
    expect((await second).errorMessage).toBeUndefined()
    expect(device.connect).toHaveBeenCalledTimes(2)
    expect(device.disconnect).toHaveBeenCalledTimes(1)
    expect(open).toBe(false)
  })
})
