import { MixerCommunicator } from '../../lib/MixerCommunicator'
import { Connector } from '../interfaces'
import ManualConfiguration from './ManualConfiguration'
import { ManualChannelState } from './ManualState'

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
        const names = this.configuration.getChannelNames()
        this.communicator.notifyChannelNames(names.length, Object.fromEntries(names.map((name, i) => [i + 1, name])))
        // channels that no longer exist must not light a tally later
        for (const id of Array.from(channelStates.keys())) {
            if (Number(id) > names.length) channelStates.delete(id)
        }
        this.communicator.notifyMixerIsConnected()
        this.notify()
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
