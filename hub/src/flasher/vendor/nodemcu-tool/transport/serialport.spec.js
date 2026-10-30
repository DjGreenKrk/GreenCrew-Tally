// Regression coverage for the one file ported from nodemcu-tool's serialport
// 8 API to serialport 13's (see ../README.md): a class-based `SerialPort`/
// `DelimiterParser` export with an options object ({path, baudRate,
// autoOpen}) instead of a constructor function with a `.parsers` namespace
// and a positional device-path argument. Everything above this file
// (scriptable-serial-terminal.js, connector/*) only talks to the thin
// promise-wrapped API asserted here, so this is what actually changed.
describe('nodemcu-tool serialport transport (serialport 13 port)', () => {
  let FakeSerialPort
  let FakeDelimiterParser
  let lastPort
  let serialport

  beforeEach(() => {
    jest.resetModules()
    lastPort = null

    FakeSerialPort = jest.fn().mockImplementation((options) => {
      const port = {
        options,
        pipe: jest.fn(() => ({ on: jest.fn() })),
        on: jest.fn(),
        open: jest.fn(cb => cb(null)),
        close: jest.fn(cb => cb(null)),
        write: jest.fn((data, cb) => cb(null)),
        set: jest.fn((opt, cb) => cb(null)),
        flush: jest.fn(cb => cb(null)),
        drain: jest.fn(cb => cb(null)),
      }
      lastPort = port
      return port
    })
    FakeSerialPort.list = jest.fn().mockResolvedValue([{ path: '/dev/mock', vendorId: '1A86' }])

    FakeDelimiterParser = jest.fn().mockImplementation(() => ({ on: jest.fn() }))

    jest.doMock('serialport', () => ({ SerialPort: FakeSerialPort, DelimiterParser: FakeDelimiterParser }))
    serialport = require('./serialport.js')
  })

  it('opens with a {path, baudRate, autoOpen} options object, not a positional path (the serialport 8 -> 13 breaking change)', async () => {
    await serialport.connect('/dev/mock', 115200)
    expect(FakeSerialPort).toHaveBeenCalledWith({ path: '/dev/mock', baudRate: 115200, autoOpen: false })
  })

  it('pipes through DelimiterParser with the configured delimiter sequence', async () => {
    serialport.setDelimiterSequence([13, 10, 62])
    await serialport.connect('/dev/mock', 115200)
    expect(FakeDelimiterParser).toHaveBeenCalledWith({ delimiter: Buffer.from([13, 10, 62]) })
    expect(lastPort.pipe).toHaveBeenCalled()
  })

  it('lists ports via the static SerialPort.list(), not a module-level list()', async () => {
    const ports = await serialport.list()
    expect(FakeSerialPort.list).toHaveBeenCalled()
    expect(ports).toEqual([{ path: '/dev/mock', vendorId: '1A86' }])
  })

  it('delegates write/flush/drain/set to the open port instance', async () => {
    await serialport.connect('/dev/mock', 115200)

    await serialport.write('hello')
    expect(lastPort.write).toHaveBeenCalledWith('hello', expect.any(Function))

    await serialport.flush()
    expect(lastPort.flush).toHaveBeenCalled()

    await serialport.drain()
    expect(lastPort.drain).toHaveBeenCalled()

    await serialport.set({ dtr: false, rts: true })
    expect(lastPort.set).toHaveBeenCalledWith({ dtr: false, rts: true }, expect.any(Function))
  })

  it('reports connected only between a successful connect and disconnect', async () => {
    expect(serialport.isConnected()).toBe(false)
    await serialport.connect('/dev/mock', 115200)
    expect(serialport.isConnected()).toBe(true)
    await serialport.disconnect()
    expect(serialport.isConnected()).toBe(false)
  })

  it('rejects write/flush/drain/set before a connection is established', async () => {
    expect(() => serialport.write('x')).toThrow(/not connected/)
    expect(() => serialport.flush()).toThrow(/not connected/)
    expect(() => serialport.drain()).toThrow(/not connected/)
    expect(() => serialport.set({})).toThrow(/not connected/)
  })
})
