import net from 'net'
import xml2js from 'xml2js'
import Channel from '../../domain/Channel'
import { MixerCommunicator } from '../../lib/MixerCommunicator'
import { Connector } from '../interfaces'
import VmixConfiguration from './VmixConfiguration'

// @see https://www.vmix.com/help20/index.htm?TCPAPI.html
class VmixConnector implements Connector {
    configuration: VmixConfiguration
    communicator: MixerCommunicator
    client?: net.Socket
    wasHelloReceived: boolean
    wasSubcribeOkReceived: boolean
    intervalHandle: any
    xmlQueryInterval: number
    waitForHelloPeriod: number
    reconnectTimeout?: NodeJS.Timeout
    waitForHelloTimeout?: NodeJS.Timeout
    disconnectRequested: boolean
    reconnectStartedAt?: number
    dataBuffer: Buffer
    expectedXmlLength?: number

    constructor(configuration: VmixConfiguration, communicator: MixerCommunicator) {
        this.configuration = configuration
        this.communicator = communicator
        this.wasHelloReceived = false
        this.wasSubcribeOkReceived = false
        this.xmlQueryInterval = 5000
        this.waitForHelloPeriod = 5000
        this.disconnectRequested = false
        this.dataBuffer = Buffer.alloc(0)
    }
    connect(isReconnect = false) {
        if (!isReconnect) {
            this.reconnectStartedAt = undefined
        }
        this.disconnectRequested = false
        const client = new net.Socket()
        this.client = client

        const connectClient = () => {
            this.wasHelloReceived = false
            this.wasSubcribeOkReceived = false
            console.log(`Connecting to Vmix at ${this.configuration.getIp().toString()}:${this.configuration.getPort().toNumber()}`)
            client.connect(this.configuration.getPort().toNumber(), this.configuration.getIp().toString())
        }

        const reconnectClient = () => {
            if (this.reconnectStartedAt === undefined) {
                this.reconnectStartedAt = Date.now()
            }
            if (VmixConnector.hasReachedReconnectLimit(this.reconnectStartedAt)) {
                console.error("Could not reconnect to vMix within 10 minutes. Reconnect attempts stopped.")
                process.exit(1)
                return
            }
            this.disconnect().then(() =>
                this.reconnectTimeout = setTimeout(() => {
                    if (this.reconnectTimeout) {
                        clearTimeout(this.reconnectTimeout)
                        this.reconnectTimeout = undefined
                    }
                    this.disconnectRequested = false
                    this.connect(true)
                }, VmixConnector.reconnectInterval)
            )
        }

        const queryXml = () => {
            if(!client.connecting && !client.destroyed) {
                client.write("XML\r\n")
            }
        }

        connectClient()

        client.on("connect", () => {
            console.debug(`TCP connection to ${this.configuration.getIp().toString()}:${this.configuration.getPort().toNumber()} established`)
            this.waitForHelloTimeout = setTimeout(() => {
                if (this.waitForHelloTimeout) {
                    clearTimeout(this.waitForHelloTimeout)
                }
                
                if (!this.wasHelloReceived || !this.wasSubcribeOkReceived) {
                    reconnectClient()
                    console.error(`The remote at ${this.configuration.getIp().toString()}:${this.configuration.getPort().toNumber()} did not identify as vMix TCPAPI. Is this the correct port for the TCPAPI? (default ${VmixConfiguration.defaultPort})`)
                }
            }, this.waitForHelloPeriod)
        })

        client.on("ready", () => {
            client.write("SUBSCRIBE TALLY\r\n")
            // @TODO: we need to poll for new channels or renames. Is there a way to subscribe to those?
            this.intervalHandle = setInterval(queryXml, this.xmlQueryInterval)
            queryXml()
        })

        client.on("timeout", () => {
            console.error("Connection to vMix timed out")
        })

        client.on("error", error => {
            console.error(`${error.name}: ${error.message}`)
        })

        client.on('data', this.onData.bind(this))

        client.on('close', (hadError) => {
            if (this.client !== client && !this.disconnectRequested) {
                return
            }
            this.communicator.notifyMixerIsDisconnected()
            if (!this.disconnectRequested) {
                console.log("Connection to vMix closed")
            }

            if(this.intervalHandle) {
                clearInterval(this.intervalHandle);
                this.intervalHandle = undefined;
            }

            if (!this.disconnectRequested) {
                console.debug(`Connection to vMix is reconnecting${hadError ? " after an error" : ""}`)
                reconnectClient()
            }
        })

    }
    private onConnectionComplete() {
        this.reconnectStartedAt = undefined
        console.log("Connection to vMix complete")
        this.communicator.notifyMixerIsConnected()
    }
    private onData(data: Buffer) {
        this.dataBuffer = Buffer.concat([this.dataBuffer, data])

        while (this.dataBuffer.length > 0) {
            if (this.expectedXmlLength !== undefined) {
                if (this.dataBuffer.length < this.expectedXmlLength) {
                    return
                }
                const xml = this.dataBuffer.subarray(0, this.expectedXmlLength).toString()
                this.dataBuffer = this.dataBuffer.subarray(this.expectedXmlLength)
                this.expectedXmlLength = undefined
                if (this.dataBuffer.subarray(0, 2).toString() === "\r\n") {
                    this.dataBuffer = this.dataBuffer.subarray(2)
                }
                this.handleXmlCommand(xml)
                continue
            }

            const endOfCommand = this.dataBuffer.indexOf("\r\n")
            if (endOfCommand === -1) {
                return
            }
            const command = this.dataBuffer.subarray(0, endOfCommand).toString()
            this.dataBuffer = this.dataBuffer.subarray(endOfCommand + 2)
            const xmlHeader = command.match(/^'?XML (\d+)$/)
            if (xmlHeader) {
                this.expectedXmlLength = Number(xmlHeader[1])
                continue
            }

            console.debug(`> ${command}`)
            if (command.startsWith("VERSION OK")) {
                this.wasHelloReceived = true
                console.debug("Connection to vMix established")
                if (this.wasHelloReceived && this.wasSubcribeOkReceived) { this.onConnectionComplete() }
            } else if (command.startsWith("SUBSCRIBE OK TALLY")) {
                this.wasSubcribeOkReceived = true
                console.debug("Successfully subscribed to tally updates from vMix")
                if (this.wasHelloReceived && this.wasSubcribeOkReceived) { this.onConnectionComplete() }
            } else if (command.startsWith("TALLY OK")) {
                this.handleTallyCommand(command)
            } else if (command.startsWith("<vmix>")) {
                this.handleXmlCommand(command)
            } else {
                console.debug("Ignoring unkown command from vmix")
            }
        }
    }
    private handleTallyCommand(command: string) {
        const result = command.match(/^TALLY OK (\d*)$/)

        if (result === null) {
            console.error("Tally OK command was ill formed")
        } else {
            const state = result[1]
            let programs: string[] = []
            let previews: string[] = []
            // vMix encodes tally states as numbers:
            // @see https://www.vmix.com/help20/index.htm?TCPAPI.html
            // 0 = off
            // 1 = program
            // 2 = preview
            state.split('').forEach((val, idx) => {
                if (val === "1") {
                    programs.push(`${idx + 1}`)
                } else if (val === "2") {
                    previews.push(`${idx + 1}`)
                }
            })

            this.communicator.notifyProgramPreviewChanged(programs, previews)
        }
    }
    private handleXmlCommand(command: string) {
        xml2js.parseString(command, (error, result) => {
            if (error) {
                console.error(`Error parsing XML response from vMix: ${error}`)
            } else {
                const vmix = result.vmix || {}
                const inputs = vmix.inputs
                if(inputs === undefined) {
                    console.log("XML from vMix looks faulty. Could not find inputs.")
                } else {
                    const channels = inputs[0].input.map(input => new Channel(input.$.number, input.$.shortTitle))
                    this.communicator.notifyChannels(channels)
                    this.communicator.notifyVmixProject(vmix.preset && vmix.preset[0])
                }
            }
        })
    }
    disconnect() {
        this.disconnectRequested = true
        this.wasHelloReceived = false
        this.wasSubcribeOkReceived = false
        const promise = new Promise(resolve => {
            if(this.intervalHandle) {
                clearInterval(this.intervalHandle);
                this.intervalHandle = undefined;
            }
            if (this.reconnectTimeout) {
                clearTimeout(this.reconnectTimeout)
                this.reconnectTimeout = undefined;
            }
            if (this.waitForHelloTimeout) {
                clearTimeout(this.waitForHelloTimeout)
                this.waitForHelloTimeout = undefined;
            }
            const client = this.client
            this.client = undefined
            if (client && !client.destroyed) {
                client.end(() => resolve(null))
            } else {
                resolve(null)
            }
        })
        return promise
    }
    isConnected() {
        return this.client !== undefined && !this.client.destroyed && this.wasHelloReceived && this.wasSubcribeOkReceived
    }
    
    static readonly ID: "vmix" = "vmix"
    static readonly reconnectInterval = 3000
    static readonly reconnectLimit = 10 * 60 * 1000

    static hasReachedReconnectLimit(startedAt: number) {
        return Date.now() - startedAt >= VmixConnector.reconnectLimit
    }
}

export default VmixConnector
