import NodeMcuConnector, { isSupportedSerialPort, TallyProgramProgressType, TallySettingsIniProgressType } from './NodeMcuConnector'
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
      write: jest.fn().mockResolvedValue(undefined),
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
    // reset settle 1 s + open settle 0.2 s + drain 0.3 s + boot wait 3 s
    await jest.advanceTimersByTimeAsync(4400)
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
    expect(device.write).toHaveBeenCalledWith('\n')
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
      write: jest.fn().mockResolvedValue(undefined),
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
    await jest.advanceTimersByTimeAsync(900)
    const recovered = await second
    expect(recovered.errorMessage).toBeUndefined()
    expect(device.connect).toHaveBeenCalledTimes(2)
    expect(device.disconnect).toHaveBeenCalledTimes(2)
    expect(open).toBe(false)
    expect(maxActive).toBe(1)

    const third = connector.getDevice()
    await jest.advanceTimersByTimeAsync(800)
    expect((await third).errorMessage).toBeUndefined()
    expect(open).toBe(false)
  })

  test('retry after a rejected connect releases mutex after cleanup', async () => {
    let open = false
    const device = {
      purge: jest.fn().mockResolvedValue(undefined),
      write: jest.fn().mockResolvedValue(undefined),
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
    await jest.advanceTimersByTimeAsync(800)
    expect((await second).errorMessage).toBeUndefined()
    expect(device.connect).toHaveBeenCalledTimes(2)
    expect(device.disconnect).toHaveBeenCalledTimes(1)
    expect(open).toBe(false)
  })
})

// Serial transport mock only. This is NOT physical ESP8266 acceptance.
describe('NodeMCU device detection races with the tally app (#16)', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.spyOn(FirmwareAssets, 'findFirmwareFiles').mockResolvedValue([
      { fileName: 'init.lua', filePath: '/tmp/init.lua', fileSize: 42 },
    ])
  })
  afterEach(() => {
    jest.restoreAllMocks()
    jest.useRealTimers()
  })

  const connectedDevice = (overrides: Record<string, unknown> = {}) => ({
    onError: jest.fn(),
    isConnected: jest.fn().mockReturnValue(false),
    listDevices: jest.fn().mockResolvedValue([{ path: 'COM1', vendorId: '0403' }]),
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    purge: jest.fn().mockResolvedValue(undefined),
    write: jest.fn().mockResolvedValue(undefined),
    checkConnection: jest.fn().mockResolvedValue(true),
    deviceInfo: jest.fn().mockResolvedValue({ chipID: 'X', flashID: 'Y', version: '1', modules: [] }),
    ...overrides,
  })

  const settle = async <T>(operation: Promise<T>) => {
    let done = false
    void operation.finally(() => { done = true })
    for (let i = 0; i < 200 && !done; i++) await jest.advanceTimersByTimeAsync(1000)
    return operation
  }

  test('a file list reply stalled by app logs fails with a deadline instead of hanging forever', async () => {
    // A native call that eventually settles, just too late: withMutex must
    // report the deadline to the caller now and only release the transport
    // once this very late reply actually arrives (quarantine, see #16).
    let resolveLate: ((value: { files: { name: string, size: number }[] }) => void) | undefined
    const stalled = new Promise<{ files: { name: string, size: number }[] }>(resolve => { resolveLate = resolve })
    const device = connectedDevice({
      fsinfo: jest.fn().mockReturnValue(stalled),
    })
    const connector = new NodeMcuConnector(device)
    const result = await settle(connector.getDevice())
    expect(result.errorMessage).toContain('timed out')

    // Let the stalled reply settle so the mutex it still holds is released;
    // otherwise every later test in this file would wait on it forever.
    resolveLate!({ files: [] })
    await jest.advanceTimersByTimeAsync(1000)
  })

  test('a file listing missing a file right after a reboot is confirmed, not reported, before a settled re-read', async () => {
    const goodFiles = { files: [{ name: 'init.lua', size: 42 }] }
    const noisyFiles = { files: [] } // a boot log line dropped a file from this one reply
    const fsinfo = jest.fn()
      .mockResolvedValueOnce(noisyFiles)
      .mockResolvedValueOnce(goodFiles)
    const device = connectedDevice({ fsinfo })
    const connector = new NodeMcuConnector(device)
    const result = await settle(connector.getDevice())
    expect(result.errorMessage).toBeUndefined()
    expect(result.update).toBe('up-to-date')
    expect(fsinfo).toHaveBeenCalledTimes(2)
  })

  test('a genuinely outdated tally is still reported as updateable after the confirming re-read', async () => {
    const outdatedFiles = { files: [] }
    const fsinfo = jest.fn().mockResolvedValue(outdatedFiles)
    const device = connectedDevice({ fsinfo })
    const connector = new NodeMcuConnector(device)
    const result = await settle(connector.getDevice())
    expect(result.errorMessage).toBeUndefined()
    expect(result.update).toBe('updateable')
    expect(fsinfo).toHaveBeenCalledTimes(2)
  })

  test('a single up-to-date reply is trusted without a second read', async () => {
    const fsinfo = jest.fn().mockResolvedValue({ files: [{ name: 'init.lua', size: 42 }] })
    const device = connectedDevice({ fsinfo })
    const connector = new NodeMcuConnector(device)
    const result = await settle(connector.getDevice())
    expect(result.update).toBe('up-to-date')
    expect(fsinfo).toHaveBeenCalledTimes(1)
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
      write: jest.fn().mockResolvedValue(undefined),
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
      write: jest.fn().mockResolvedValue(undefined),
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

// Serial transport mock only. This is NOT physical ESP8266 acceptance.
describe('NodeMCU uploads with the tally app paused (simulated device)', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(() => jest.useRealTimers())

  const simulatedDevice = (corruptDownloads = false) => {
    const log: string[] = []
    const stored = new Map<string, Buffer>()
    let open = false
    return {
      log,
      onError: jest.fn(),
      isConnected: jest.fn(() => open),
      connect: jest.fn(async () => { open = true; log.push('connect') }),
      disconnect: jest.fn(async () => { open = false }),
      purge: jest.fn().mockResolvedValue(undefined),
      write: jest.fn().mockResolvedValue(undefined),
      checkConnection: jest.fn().mockResolvedValue(true),
      hardreset: jest.fn(async () => { log.push('reset') }),
      execute: jest.fn(async (command: string) => { log.push('exec ' + command); return { echo: command, response: 'ok' } }),
      upload: jest.fn(async (localName: string, remoteName: string) => {
        log.push('upload ' + remoteName)
        stored.set(remoteName, await jest.requireActual('fs').promises.readFile(localName))
      }),
      download: jest.fn(async (remoteName: string) => corruptDownloads ? Buffer.from('') : stored.get(remoteName)),
    }
  }

  const settle = async <T>(operation: Promise<T>) => {
    let done = false
    void operation.finally(() => { done = true })
    for (let i = 0; i < 200 && !done; i++) await jest.advanceTimersByTimeAsync(1000)
    return operation
  }

  test('program pauses the app, writes init.lua last and only then reboots into it', async () => {
    const device = simulatedDevice()
    const progress: TallyProgramProgressType[] = []
    await settle(new NodeMcuConnector(device).program('COM1', p => progress.push({ ...p })))
    expect(progress[progress.length - 1]).toMatchObject({ allDone: true, error: false, filesUploaded: 8 })

    const pause = device.log.findIndex(line => line.includes('file.rename("init.lua", "init.paused")'))
    const firstUpload = device.log.findIndex(line => line.startsWith('upload'))
    const uploads = device.log.filter(line => line.startsWith('upload'))
    expect(pause).toBeGreaterThan(-1)
    expect(device.log.slice(pause, firstUpload)).toContain('reset')
    expect(uploads[uploads.length - 1]).toBe('upload init.lua.swp')
    expect(device.log.slice(device.log.lastIndexOf('upload init.lua.swp'))).toEqual(expect.arrayContaining([
      'exec if file.exists("init.paused") then file.remove("init.paused") end; print("ok")',
      'reset',
    ]))
  })

  test('a failed settings upload restores autostart so the tally keeps its old settings', async () => {
    const device = simulatedDevice(true)
    const progress: TallySettingsIniProgressType[] = []
    const ini = 'station.ssid=Net\nstation.password=secret\nhub.ip=10.0.0.1\ntally.name=CAM9\n'
    await settle(new NodeMcuConnector(device).writeTallySettingsIni('COM1', ini, p => progress.push({ ...p })))
    expect(progress[progress.length - 1]).toMatchObject({ error: true, allDone: false })
    const pause = device.log.findIndex(line => line.includes('file.rename("init.lua", "init.paused")'))
    const resume = device.log.findIndex(line => line.includes('file.rename("init.paused", "init.lua")'))
    expect(pause).toBeGreaterThan(-1)
    expect(resume).toBeGreaterThan(pause)
  })
})

describe('NodeMCU serial port choice', () => {
  const windowsPorts = [
    { path: 'COM1' },
    { path: 'COM3' },
    { path: 'COM11', vendorId: '0403', productId: '6001' },
  ]
  const deviceOn = () => ({
    onError: jest.fn(),
    isConnected: jest.fn(() => false),
    listDevices: jest.fn().mockResolvedValue(windowsPorts),
    connect: jest.fn().mockRejectedValue(new Error('stop after port choice')),
    disconnect: jest.fn(),
  })

  test('picks the ESP adapter even when Windows lists it third (COM11)', async () => {
    const device = deviceOn()
    const result = await new NodeMcuConnector(device).getDevice()
    expect(result.path).toBe('COM11')
    expect(result.ports).toEqual([
      { path: 'COM1', vendorId: undefined, productId: undefined, supported: false },
      { path: 'COM3', vendorId: undefined, productId: undefined, supported: false },
      { path: 'COM11', vendorId: '0403', productId: '6001', supported: true },
    ])
  })

  test('uses the port the user chose, including an unidentified one', async () => {
    const device = deviceOn()
    const result = await new NodeMcuConnector(device).getDevice('COM3')
    expect(device.connect).toHaveBeenCalledWith('COM3', 115200, false)
    expect(result.path).toBe('COM3')
  })

  test('ignores a chosen port that is no longer connected', async () => {
    const result = await new NodeMcuConnector(deviceOn()).getDevice('COM7')
    expect(result.path).toBe('COM11')
  })
})

// Serial transport mock only. This is NOT physical ESP8266 acceptance.
describe('NodeMCU recovery from a check that gave up (simulated nodemcu-tool)', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.spyOn(FirmwareAssets, 'findFirmwareFiles').mockResolvedValue([])
  })
  afterEach(() => {
    jest.restoreAllMocks()
    jest.useRealTimers()
  })

  // Mirrors nodemcu-tool: its checkConnection() watchdog rejects after 1.5 s
  // but leaves the receive listener queued; until the ESP sends a line every
  // further command throws "concurreny error". Seen on Windows with FTDI.
  const slowFirstAnswer = () => {
    let listenerQueued = false
    let firstCheck = true
    return {
      onError: jest.fn(),
      isConnected: jest.fn(() => false),
      listDevices: jest.fn().mockResolvedValue([{ path: 'COM11', vendorId: '0403' }]),
      connect: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn().mockResolvedValue(undefined),
      purge: jest.fn().mockResolvedValue(undefined),
      write: jest.fn(async (data: string) => { if (data === '\n') listenerQueued = false }),
      checkConnection: jest.fn(async () => {
        if (listenerQueued) throw new Error('concurreny error - receive listener already in-queue')
        if (firstCheck) {
          firstCheck = false
          listenerQueued = true
          await new Promise(resolve => setTimeout(resolve, 1500))
          throw new Error('Timeout, no response detected - is NodeMCU online and the Lua interpreter ready ?')
        }
        return true
      }),
      deviceInfo: jest.fn().mockResolvedValue({ chipID: 'c31ee5', flashID: '16405e', version: '3.0.0', modules: 'file' }),
      fsinfo: jest.fn().mockResolvedValue({ files: [] }),
    }
  }

  test('the next check succeeds instead of failing with a concurrency error', async () => {
    const device = slowFirstAnswer()
    const result = new NodeMcuConnector(device).getDevice()
    await jest.advanceTimersByTimeAsync(5000)
    const tallyDevice = await result
    expect(tallyDevice.errorMessage).toBeUndefined()
    expect(tallyDevice.chipId).toBe('c31ee5')
    expect(device.checkConnection).toHaveBeenCalledTimes(2)
  })
})

// Serial transport mock only. This is NOT physical ESP8266 acceptance.
//
// MUST stay the LAST describe block in this file: the native fsinfo() call
// below is built to never settle, at all, for the rest of the process. By
// design (see withMutex's quarantine) that means the transport mutex it
// takes out is never released once this block runs, which would otherwise
// make every later test in this file wait on it forever too.
describe('NodeMCU mutex acquisition is bounded, not indefinite (#16)', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.spyOn(FirmwareAssets, 'findFirmwareFiles').mockResolvedValue([])
  })
  afterEach(() => {
    jest.restoreAllMocks()
    jest.useRealTimers()
  })

  // advanceTimersByTimeAsync() has a fixed real-time cost per call, so this
  // uses few, large (1 s) ticks rather than one matching the exact deadline
  // — same reasoning as settle() elsewhere in this file.
  const settle = async <T>(operation: Promise<T>) => {
    let done = false
    void operation.finally(() => { done = true })
    for (let i = 0; i < 200 && !done; i++) await jest.advanceTimersByTimeAsync(1000)
    return operation
  }

  test('a later job fails with a clear error instead of queuing behind a stuck one forever', async () => {
    const stuckDevice = {
      onError: jest.fn(),
      isConnected: jest.fn().mockReturnValue(false),
      listDevices: jest.fn().mockResolvedValue([{ path: 'COM1', vendorId: '0403' }]),
      connect: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn().mockResolvedValue(undefined),
      purge: jest.fn().mockResolvedValue(undefined),
      write: jest.fn().mockResolvedValue(undefined),
      checkConnection: jest.fn().mockResolvedValue(true),
      deviceInfo: jest.fn().mockResolvedValue({ chipID: 'X', flashID: 'Y', version: '1', modules: [] }),
      // A native call that never settles, not even late: unlike the timeout
      // quarantine tests elsewhere in this file, nothing ever resolves this.
      fsinfo: jest.fn().mockImplementation(() => new Promise(() => {})),
    }
    const connector = new NodeMcuConnector(stuckDevice)

    const first = await settle(connector.getDevice()) // fsinfo()'s own 5 s withTimeout deadline
    expect(first.errorMessage).toContain('timed out')

    // The stuck native call is still pending, so the mutex it holds is
    // never released (by design). A second job must still give up on its
    // own bounded wait instead of waiting on it forever.
    const second = await settle(connector.getDevice()) // mutexAcquireTimeoutMs (90 s) < 200 s of ticks
    expect(second.errorMessage).toContain('busy')
  })
})
