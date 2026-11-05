import EspNowGatewayTallyDriver, { SerialPortLike } from './EspNowGatewayTallyDriver'
import TallyContainer from './TallyContainer'
import ServerEventEmitter from '../lib/ServerEventEmitter'
import { AppConfiguration } from '../lib/AppConfiguration'
import { ConnectionState, EspNowTally } from '../domain/Tally'

function setup() {
    const emitter = new ServerEventEmitter()
    const configuration = new AppConfiguration(emitter)
    const container = new TallyContainer(configuration, emitter)
    // Disabled in the default configuration, so the constructor never tries
    // to open a real (or missing) serial port - handleLine() is exercised
    // directly instead, the same way the firmware's GatewayLink is unit
    // tested without a real ESP-NOW radio.
    const driver = new EspNowGatewayTallyDriver(configuration, container)
    return { configuration, container, driver }
}

function fakePort() {
    const written: string[] = []
    const port: SerialPortLike = {
        on: () => {},
        write: (data: string) => { written.push(data) },
        close: () => {},
    }
    return { port, written }
}

test('a relayed tally-ho line creates a connected tally, keyed by its mac', () => {
    const { container, driver } = setup()
    driver.handleLine('FROM aabbccddeeff tally-ho "CAM1" gc/1 id=aabbccddeeff fw=2.0.0-dev hw=esp8266 caps=ws2812')

    const tally = container.get("CAM1", "espnow") as EspNowTally
    expect(tally).toBeDefined()
    expect(tally.mac).toEqual("aabbccddeeff")
    expect(tally.state).toEqual(ConnectionState.CONNECTED)
    expect(tally.device?.firmware).toEqual("2.0.0-dev")
    expect(tally.device?.hardware).toEqual("esp8266")
})

test('the mac is lowercased and a gateway hello line creates no tally', () => {
    const { container, driver } = setup()
    driver.handleLine('GATEWAY-HO gc-gateway/1')
    expect(container.getEspNowTallies()).toHaveLength(0)

    driver.handleLine('FROM AABBCCDDEEFF tally-ho "CAM2"')
    const tally = container.get("CAM2", "espnow") as EspNowTally
    expect(tally.mac).toEqual("aabbccddeeff")
})

test('a relayed log line is attached to the tally', () => {
    const { container, driver } = setup()
    driver.handleLine('FROM aabbccddeeff tally-ho "CAM1"')
    driver.handleLine('FROM aabbccddeeff log "CAM1" INFO "Got IP 10.0.0.5"')

    const tally = container.get("CAM1", "espnow") as EspNowTally
    expect(tally.getLogs()).toHaveLength(1)
    expect(tally.getLogs()[0].message).toEqual("Got IP 10.0.0.5")
})

test('malformed or unrecognized lines are ignored, not thrown', () => {
    const { container, driver } = setup()
    expect(() => driver.handleLine('NOT A VALID LINE')).not.toThrow()
    expect(() => driver.handleLine('FROM short hi')).not.toThrow()
    expect(container.getEspNowTallies()).toHaveLength(0)
})

test('updateTallyState writes a TO line once a gateway is connected', () => {
    const { container, driver } = setup()
    driver.handleLine('FROM aabbccddeeff tally-ho "CAM1"')
    const tally = container.get("CAM1", "espnow") as EspNowTally
    const { port, written } = fakePort()
    driver.port = port

    driver.updateTallyState(tally, ["CAM1"], null, [])

    expect(written).toHaveLength(1)
    expect(written[0]).toMatch(/^TO aabbccddeeff O\d{3}\/\d{3}\/\d{3} S\d{3}\/\d{3}\/\d{3}.*\n$/)
})

test('updateTallyState writes nothing without a connected gateway', () => {
    const { container, driver } = setup()
    driver.handleLine('FROM aabbccddeeff tally-ho "CAM1"')
    const tally = container.get("CAM1", "espnow") as EspNowTally

    expect(driver.port).toBeUndefined()
    expect(() => driver.updateTallyState(tally, ["CAM1"], null, [])).not.toThrow()
})

test('updateTallyState writes nothing for a tally with no mac yet', () => {
    const { driver } = setup()
    const tally = new EspNowTally("CAM3")
    const { port, written } = fakePort()
    driver.port = port

    driver.updateTallyState(tally, ["CAM3"], null, [])

    expect(written).toHaveLength(0)
})
