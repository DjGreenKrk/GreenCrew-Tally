import { MixerCommunicator } from '../../lib/MixerCommunicator'
import { Connector } from '../interfaces'
import CompanionConfiguration from './CompanionConfiguration'

// Uses the same Program/Preview events and UDP tally clients as other mixers.
class CompanionConnector implements Connector {
    static readonly ID: 'companion' = 'companion'
    private connected = false

    constructor(_config: CompanionConfiguration, private communicator: MixerCommunicator) {}

    connect(): void {
        this.connected = true
        this.communicator.notifyChannelNames(8)
        this.communicator.notifyProgramPreviewChanged([], [])
        this.communicator.notifyMixerIsConnected()
    }

    disconnect(): void {
        this.connected = false
        this.communicator.notifyProgramPreviewChanged([], [])
        this.communicator.notifyMixerIsDisconnected()
    }

    isConnected(): boolean { return this.connected }

    setState(programs: string[], previews: string[]): void {
        if (!this.connected) throw new Error('Companion source is not active')
        this.communicator.notifyProgramPreviewChanged(programs, previews)
    }
}

export default CompanionConnector
