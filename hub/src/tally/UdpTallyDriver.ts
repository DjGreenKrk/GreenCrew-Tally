import { ConnectionState, TallyDevice, UdpTally } from '../domain/Tally'
import dgram from 'dgram'
import { ChannelList } from '../lib/MixerCommunicator'
import { AppConfiguration } from '../lib/AppConfiguration'
import CommandParser, { InvalidCommandError } from './CommandParser'
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
                    const {tallyName, device} = command
                    this.tallyReported(tallyName, rinfo, { device })
                } else if (command.command === "log") {
                    const {tallyName, log} = command
                    this.tallyReported(tallyName, rinfo)
                    this.container.addLog(tallyName, "udp", log)
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