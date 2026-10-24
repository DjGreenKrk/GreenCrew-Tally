import { MixerCommunicator } from '../../lib/MixerCommunicator'
import { Connector } from '../interfaces'
import CompanionConfiguration from './CompanionConfiguration'
import { channelNamesById } from '../channelNames'

// Uses the existing Program/Preview events and the Hub's UDP/Web tally clients.
// A selected mixer is not proof that Companion is still sending live snapshots.
class CompanionConnector implements Connector {
    static readonly ID = 'companion' as const
    static readonly TIMEOUT_MS = 4000

    private active = false
    private receiving = false
    private lastSnapshotTime: number | null = null
    private watchdog: ReturnType<typeof setInterval> | null = null

    constructor(private configuration: CompanionConfiguration, private communicator: MixerCommunicator) {}

    connect(): void {
        this.active = true
        this.receiving = false
        this.lastSnapshotTime = null
        this.applyChannels()
        this.communicator.notifyProgramPreviewChanged(null, null)
        this.communicator.notifyMixerIsDisconnected()
        this.watchdog = setInterval(() => this.checkTimeout(), 250)
    }

    // renaming or adding channels must not make the tallies show UNKNOWN
    updateSettings(configuration: CompanionConfiguration): void {
        this.configuration = configuration
        this.applyChannels()
    }

    private applyChannels() {
        const names = this.configuration.getChannelNames()
        this.communicator.notifyChannelNames(names.length, channelNamesById(names))
    }

    getChannelCount(): number {
        return this.configuration.getChannelNames().length
    }

    disconnect(): void {
        if (this.watchdog !== null) {
            clearInterval(this.watchdog)
            this.watchdog = null
        }
        this.active = false
        this.receiving = false
        this.lastSnapshotTime = null
        this.communicator.notifyProgramPreviewChanged([], [])
        this.communicator.notifyMixerIsDisconnected()
    }

    // 'active' = mixer selected; 'connected' = recently received a snapshot.
    isActive(): boolean { return this.active }
    isConnected(): boolean { return this.active && this.receiving }

    getSnapshotAgeMs(): number | null {
        return this.lastSnapshotTime === null ? null : Math.max(0, Date.now() - this.lastSnapshotTime)
    }

    setState(programs: string[], previews: string[], auxes: string[] = []): void {
        if (!this.active) throw new Error('Companion source is not active')
        this.lastSnapshotTime = Date.now()
        if (!this.receiving) {
            this.receiving = true
            this.communicator.notifyMixerIsConnected()
        }
        this.communicator.notifyProgramPreviewChanged(programs, previews, auxes)
    }

    private checkTimeout(): void {
        if (!this.active || !this.receiving) return
        const age = this.getSnapshotAgeMs()
        if (age !== null && age > CompanionConnector.TIMEOUT_MS) {
            this.receiving = false
            // Propagate UNKNOWN so connected operator-side tallies blink blue.
            // We cannot infer that any camera is physically off-air.
            this.communicator.notifyProgramPreviewChanged(null, null)
            this.communicator.notifyMixerIsDisconnected()
            console.warn('Companion HTTP snapshots timed out; Program/Preview is UNKNOWN')
        }
    }
}

export default CompanionConnector
