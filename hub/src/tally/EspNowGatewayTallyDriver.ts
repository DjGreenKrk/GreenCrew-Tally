import { ConnectionState, EspNowTally, TallyDevice } from '../domain/Tally'
import { ChannelList } from '../lib/MixerCommunicator'
import { AppConfiguration } from '../lib/AppConfiguration'
import CommandParser, { InvalidCommandError } from './CommandParser'
import CommandCreator from './CommandCreator'
import TallyContainer from './TallyContainer'
import Log, { Severity } from '../domain/Log'

// Minimal shape of the parts of the native "serialport" module used here
// (the same package NodeMcuConnector's flasher already depends on, see its
// package.json; not given its own TS types in the version currently used).
export interface SerialPortLike {
    on(event: 'open', listener: () => void): void
    on(event: 'error', listener: (error: Error) => void): void
    on(event: 'close', listener: () => void): void
    on(event: 'data', listener: (data: Buffer) => void): void
    write(data: string, callback?: (error?: Error | null) => void): void
    close(callback?: (error?: Error | null) => void): void
}
interface SerialPortCtor {
    new (path: string, options: { baudRate: number, autoOpen?: boolean }): SerialPortLike
}

let NativeSerialPort: SerialPortCtor | undefined
try {
    NativeSerialPort = eval('require')('serialport')
} catch (error) {
    console.error(`Could not load the native serialport module (needed for the ESP-NOW gateway, #25): ${error}`)
}

const fromLinePattern = /^FROM ([0-9a-fA-F]{12}) (.+)$/

// - talks to a USB ESP-NOW gateway (#25, see firmware-v2/README.md's "ESP-NOW
//   gateway" section and lib/tally_core/src/GatewayLink.h for the line protocol)
// - "TO <mac> <state>" downstream, "FROM <mac> <text>" upstream, reusing the
//   Hub's existing CommandParser/CommandCreator - the wire text is identical
//   to what UdpTallyDriver already sends/receives, only the framing differs
// - off by default: EspNowGatewayConfiguration.enabled and a serial port are
//   both required before this opens anything
class EspNowGatewayTallyDriver {
    container: TallyContainer
    configuration: AppConfiguration
    port?: SerialPortLike
    buffer: string = ""
    lastTallyReport: Map<string, Date> = new Map()

    constructor(configuration: AppConfiguration, container: TallyContainer) {
        this.configuration = configuration
        this.container = container
        this.container.addEspNowGatewayTallyDriver(this)

        const gatewayConfiguration = this.configuration.getEspNowGatewayConfiguration()
        if (gatewayConfiguration.getEnabled() && gatewayConfiguration.getSerialPort()) {
            this.open(gatewayConfiguration.getSerialPort())
        }

        // check that all tallies are still reporting regularly, same timeout
        // logic as UdpTallyDriver, keyed by MAC instead of IP:port
        setInterval(() => {
            const now = new Date()
            this.container.getEspNowTallies().forEach(tally => {
                const lastTallyReportDate = tally.mac ? this.lastTallyReport.get(tally.mac) : undefined
                if (!lastTallyReportDate) {
                    tally.state = ConnectionState.DISCONNECTED
                } else {
                    const diff = now.getTime() - lastTallyReportDate.getTime() // milliseconds
                    if (diff > this.configuration.getTallyTimeoutDisconnected()) {
                        if (tally.state !== ConnectionState.DISCONNECTED) {
                            tally.state = ConnectionState.DISCONNECTED
                            this.container.update(tally)
                            this.container.addLog(tally.name, "espnow", new Log(new Date(), Severity.STATUS, `Tally got disconnected after not reporting for ${diff}ms`))
                        }
                    } else if (diff > this.configuration.getTallyTimeoutMissing()) {
                        if (tally.state !== ConnectionState.MISSING) {
                            tally.state = ConnectionState.MISSING
                            this.container.update(tally)
                            this.container.addLog(tally.name, "espnow", new Log(new Date(), Severity.STATUS, `Tally got missing. It has not reported for ${diff}ms`))
                        }
                    }
                }
            })
        }, 500)

        // send keep-alive messages, same rate as UdpTallyDriver
        setInterval(() => {
            this.container.getEspNowTallies().forEach(tally => {
                this.updateTallyState(tally, this.container.lastPrograms, this.container.lastPreviews, this.container.lastAuxes)
            })
        }, 1000 / this.configuration.getTallyKeepAlivesPerSecond())
    }

    // Whether the serial port to a gateway is open, for the Configuration page.
    isConnected(): boolean {
        return this.port !== undefined
    }

    private open(path: string) {
        if (!NativeSerialPort) {
            console.error("The ESP-NOW gateway is enabled, but the native serialport module is unavailable")
            return
        }
        try {
            const port = new NativeSerialPort(path, { baudRate: 115200, autoOpen: true })
            port.on('open', () => console.log(`ESP-NOW gateway connected on ${path}`))
            port.on('error', (error: Error) => console.error(`ESP-NOW gateway (${path}) serial error: ${error.message}`))
            port.on('close', () => console.warn(`ESP-NOW gateway (${path}) disconnected`))
            port.on('data', (data: Buffer) => this.onData(data))
            this.port = port
        } catch (error) {
            console.error(`Could not open the ESP-NOW gateway serial port "${path}": ${error}`)
        }
    }

    private onData(data: Buffer) {
        this.buffer += data.toString('utf8')
        let newlineIndex: number
        while ((newlineIndex = this.buffer.indexOf('\n')) !== -1) {
            const line = this.buffer.slice(0, newlineIndex).replace(/\r$/, "")
            this.buffer = this.buffer.slice(newlineIndex + 1)
            if (line.length > 0) this.handleLine(line)
        }
    }

    // One line received from the gateway over serial ("GATEWAY-HO ..." or
    // "FROM <mac> <text>"). Exposed (not private) so it can be unit tested
    // without a real serial port; onData() is the only caller in production.
    handleLine(line: string) {
        if (line.startsWith("GATEWAY-HO ")) {
            console.log(`ESP-NOW gateway online: ${line.slice("GATEWAY-HO ".length)}`)
            return
        }
        const match = line.match(fromLinePattern)
        if (!match) {
            console.warn(`ESP-NOW gateway: unrecognized line "${line}"`)
            return
        }
        const [, macUpper, text] = match
        const mac = macUpper.toLowerCase()
        try {
            const command = CommandParser.parse(text.trim())
            if (command.command === "tally-ho") {
                const { tallyName, device } = command
                this.tallyReported(tallyName, mac, { device })
            } else if (command.command === "log") {
                const { tallyName, log } = command
                this.tallyReported(tallyName, mac)
                this.container.addLog(tallyName, "espnow", log)
            } else {
                // typescript should complain if we missed a command
                const unreachable: never = command
                throw new Error(`Unsupported tally command: ${String(unreachable)}`)
            }
        } catch (e) {
            if (e instanceof InvalidCommandError) {
                console.warn(e.message)
            } else {
                throw e
            }
        }
    }

    // hello: only "tally-ho" says what the device is; a log keeps what is known
    private tallyReported(tallyName: string, mac: string, hello?: { device?: TallyDevice }) {
        this.lastTallyReport.set(mac, new Date())
        const tally = this.container.getOrCreate(tallyName, "espnow") as EspNowTally
        const oldState = tally.state
        const oldMac = tally.mac
        const oldDevice = JSON.stringify(tally.device)

        tally.state = ConnectionState.CONNECTED
        tally.mac = mac
        if (hello) {
            tally.device = hello.device
        }

        if (oldState !== tally.state || oldMac !== tally.mac || oldDevice !== JSON.stringify(tally.device)) {
            this.container.update(tally)
        }
        return tally
    }

    updateTallyState(tally: EspNowTally, programs: ChannelList, previews: ChannelList, auxes: string[] = []) {
        if (!this.port || !tally.mac || !tally.isActive()) return
        const command = CommandCreator.createStateCommand(tally, programs, previews, this.configuration.getTallyConfiguration(), auxes)
        this.port.write(`TO ${tally.mac} ${command}\n`)
    }
}

export default EspNowGatewayTallyDriver
