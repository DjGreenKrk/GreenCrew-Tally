import { ConnectionState, TallyDevice, UdpTally } from '../domain/Tally'
import dgram from 'dgram'
import { ChannelList } from '../lib/MixerCommunicator'
import { AppConfiguration } from '../lib/AppConfiguration'
import CommandParser, { InvalidCommandError } from './CommandParser'
import DeviceRegistry from './DeviceRegistry'
import CommandCreator from './CommandCreator'
import TallyContainer from './TallyContainer'
import Log, { Severity } from '../domain/Log'

// - handles connections with Tallies.
// - emits signals when tallies connect, go missing or disconnect
class UdpTallyDriver {
    io: dgram.Socket
    container: TallyContainer
    configuration: AppConfiguration
    lastTallyReport: Map<string, Date> = new Map()
    // firmware v2 tallies by device id (#28); set by the server
    registry?: DeviceRegistry
    private lastDuplicateWarning: Map<string, number> = new Map()

    // onBindError: the tally port could not be opened, so no tally can ever
    // connect. The Hub must not keep running as if it were healthy.
    constructor(configuration: AppConfiguration, container: TallyContainer, onBindError?: (error: NodeJS.ErrnoException) => void) {
        this.configuration = configuration
        this.container = container
        this.container.addUdpTallyDriver(this)

        this.io = dgram.createSocket('udp4')

        let listening = false
        this.io.on('error', (err: NodeJS.ErrnoException) => {
            console.log(`server error: ${err.stack}`);
            this.io.close();
            if (!listening && onBindError) onBindError(err)
        });
        
        this.io.on('message', (msg, rinfo) => {
            try {
                const command = CommandParser.parse(msg.toString().trim())
                if (command.command === "tally-ho") {
                    const {tallyName, device, pairing} = command
                    if (device?.id) this.registry?.helloReceived(device.id, tallyName, device.firmware, rinfo.address, rinfo.port, pairing)
                    if (this.isDuplicate(tallyName, rinfo, device?.id)) return
                    this.tallyReported(tallyName, rinfo, { device })
                } else if (command.command === "log") {
                    const {tallyName, log} = command
                    if (this.isDuplicate(tallyName, rinfo)) return
                    this.tallyReported(tallyName, rinfo)
                    this.container.addLog(tallyName, "udp", log)
                } else if (command.command === "management") {
                    this.registry?.replyReceived(command.reply)
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
        });
        
        this.io.on('listening', () => {
            listening = true
            const address = this.io.address()
            console.log(`Listening for Tallies on ${address.address}:${address.port}`)
        });
        
        this.io.bind(this.configuration.getTallyPort())

        // check that all tallies are still reporting regularily
        setInterval(() => {
            const now = new Date()
            this.container.getUdpTallies().forEach(tally => {
                const lastTallyReportDate = this.lastTallyReport.get(tally.name)
                if(!lastTallyReportDate) {
                    tally.state = ConnectionState.DISCONNECTED
                } else {
                    const diff = now.getTime() - lastTallyReportDate.getTime() // milliseconds
                    if(diff > this.configuration.getTallyTimeoutDisconnected()) {
                        if(tally.state !== ConnectionState.DISCONNECTED) {
                            tally.state = ConnectionState.DISCONNECTED
                            this.container.update(tally)
                            this.container.addLog(tally.name, "udp", new Log(new Date(), Severity.STATUS, `Tally got disconnected after not reporting for ${diff}ms`))
                        }
                    } else if(diff > this.configuration.getTallyTimeoutMissing()) {
                        if(tally.state !== ConnectionState.MISSING) {
                            tally.state = ConnectionState.MISSING
                            this.container.update(tally)
                            this.container.addLog(tally.name, "udp", new Log(new Date(), Severity.STATUS, `Tally got missing. It has not reported for ${diff}ms`))
                        }
                    }
                }
            })
        }, 500)

        // send keep-alive messages
        // - show the tally, we are still here
        // - compensate for lost packages
        setInterval(() => {
            this.container.getUdpTallies().forEach(tally => {
                this.updateTallyState(tally, this.container.lastPrograms, this.container.lastPreviews, this.container.lastAuxes)
            })
        }, 1000 / this.configuration.getTallyKeepAlivesPerSecond())
    }
    // Two v2 tallies with the same name: the one the Hub talks to keeps the
    // name, the other is ignored (and listed with its id on the Configuration
    // page) instead of taking over the lights of the first one.
    private isDuplicate(tallyName: string, rinfo: dgram.RemoteInfo, deviceId?: string) {
        const tally = this.container.get(tallyName, "udp") as UdpTally | undefined
        if (!tally || tally.state === ConnectionState.DISCONNECTED || !tally.device?.id) return false
        if (tally.address === rinfo.address && tally.port === rinfo.port) return false
        // a known device with a new address (DHCP) is the same tally
        if (deviceId === tally.device.id) return false
        const now = Date.now()
        if (deviceId && now - (this.lastDuplicateWarning.get(tallyName) ?? 0) > 10000) {
            this.lastDuplicateWarning.set(tallyName, now)
            this.container.addLog(tallyName, "udp", new Log(new Date(), Severity.WARNING,
                `Another tally (${deviceId} at ${rinfo.address}) uses the name ${tallyName}; it is ignored until it gets its own name`))
        }
        return true
    }

    sendManagement(text: string, address: string, port: number) {
        this.io.send(text, port, address)
    }

    // hello: only "tally-ho" says what the device is (nothing for NodeMCU
    // tallies); a log keeps what is known
    private tallyReported(tallyName: string, rinfo: dgram.RemoteInfo, hello?: { device?: TallyDevice }) {
        this.lastTallyReport.set(tallyName, new Date())
        const tally = this.container.getOrCreate(tallyName, "udp") as UdpTally
        const oldState = tally.state
        const oldAddress = tally.address
        const oldPort = tally.port
        const oldDevice = JSON.stringify(tally.device)

        tally.state = ConnectionState.CONNECTED
        tally.address = rinfo.address
        tally.port = rinfo.port
        if (hello) {
            tally.device = hello.device
        }

        if (oldState !== tally.state || oldAddress !== tally.address || oldPort !== tally.port || oldDevice !== JSON.stringify(tally.device)) {
            this.container.update(tally)
        }
        return tally
    }

    updateTallyState(tally: UdpTally, programs: ChannelList, previews: ChannelList, auxes: string[] = []) {
        if(tally.isActive()) {
            const command = CommandCreator.createStateCommand(tally, programs, previews, this.configuration.getTallyConfiguration(), auxes)
            this.io.send(command, tally.port, tally.address)
        }
    }
}

export default UdpTallyDriver