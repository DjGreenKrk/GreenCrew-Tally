/**
 * Collapse near-simultaneous Program/Preview variable-change events into the
 * latest complete snapshot. No minimum interval is imposed between stable
 * operator changes. Manual actions bypass this buffer.
 */
export class SnapshotCoalescer {
    constructor(publish, delayMs = 60, timers = { setTimeout, clearTimeout }) {
        this.publish = publish
        this.delayMs = delayMs
        this.timers = timers
        this.timer = null
        this.staged = null
    }

    schedule(state) {
        this.cancel()
        this.staged = {
            programs: [...state.programs],
            previews: [...state.previews],
        }
        this.timer = this.timers.setTimeout(() => {
            this.timer = null
            const latest = this.staged
            this.staged = null
            if (latest !== null) this.publish(latest)
        }, this.delayMs)
    }

    cancel() {
        if (this.timer !== null) this.timers.clearTimeout(this.timer)
        this.timer = null
        this.staged = null
    }
}
