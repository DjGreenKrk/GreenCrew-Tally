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
