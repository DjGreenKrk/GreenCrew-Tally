// Shared between the Hub and the browser: the state an operator sets for a
// channel on the manual control page.
export const MANUAL_CHANNEL_STATES = ['off', 'preview', 'aux', 'program'] as const
export type ManualChannelState = typeof MANUAL_CHANNEL_STATES[number]

export function isManualChannelState(value: unknown): value is ManualChannelState {
    return typeof value === 'string' && (MANUAL_CHANNEL_STATES as readonly string[]).includes(value)
}
