import { MixerCommunicator } from '../../lib/MixerCommunicator'
import { Connector } from '../interfaces'
import ManualConfiguration from './ManualConfiguration'
import { ManualChannelState } from './ManualState'
import { channelNamesById } from '../channelNames'

// Kept outside the connector: changing the channel names restarts the mixer,
// and the lights on stage must not change because of that.
const channelStates = new Map<string, ManualChannelState>()

// The operator sets each channel by hand, e.g. from a phone.
class ManualConnector implements Connector {
    static readonly ID = 'manual' as const

    private active = false

    constructor(private configuration: ManualConfiguration, private communicator: MixerCommunicator) {}

    connect(): void {
        this.active = true
        this.applyChannels()
        this.communicator.notifyMixerIsConnected()
        this.notify()
    }

    // renaming channels or switching exclusive Program must not blink the lights
    updateSettings(configuration: ManualConfiguration): void {
        this.configuration = configuration
        this.applyChannels()
        this.notify()
    }

    private applyChannels() {
        const names = this.configuration.getChannelNames()
        this.communicator.notifyChannelNames(names.length, channelNamesById(names))
        // channels that no longer exist must not light a tally later
        for (const id of Array.from(channelStates.keys())) {
            if (Number(id) > names.length) channelStates.delete(id)
        }
    }

    disconnect(): void {
        this.active = false
        this.communicator.notifyMixerIsDisconnected()
    }

    isConnected(): boolean {
        return this.active
    }

    setChannelState(channelId: string, state: ManualChannelState): void {
        const count = this.configuration.getChannelNames().length
        if (!/^\d+$/.test(channelId) || Number(channelId) < 1 || Number(channelId) > count) {
            throw new Error(`Unknown channel ${channelId}`)
        }
        if (state === 'program' && this.configuration.isExclusiveProgram()) {
            for (const [id, s] of Array.from(channelStates.entries())) {
                if (s === 'program' && id !== channelId) channelStates.delete(id)
            }
        }
        if (state === 'off') {
            channelStates.delete(channelId)
        } else {
            channelStates.set(channelId, state)
        }
        this.notify()
    }

    allOff(): void {
        channelStates.clear()
        this.notify()
    }

    private notify() {
        if (!this.active) return
        const withState = (state: ManualChannelState) => Array.from(channelStates.entries())
            .filter(([, s]) => s === state)
            .map(([id]) => id)
            .sort((a, b) => Number(a) - Number(b))
        this.communicator.notifyProgramPreviewChanged(withState('program'), withState('preview'), withState('aux'))
    }

    // for tests
    static resetStates() {
        channelStates.clear()
    }
}

export default ManualConnector
