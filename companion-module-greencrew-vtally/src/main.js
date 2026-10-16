import { InstanceBase, InstanceStatus, runEntrypoint } from '@companion-module/base'
import { blackout } from './state.js'
import { defineActions } from './actions.js'
import { defineFeedbacks, defineVariables, updateIndicators } from './feedbacks.js'
import { definePresets } from './presets.js'

// Loopback only: the vTally HTTP endpoint intentionally rejects remote hosts.
class GreenCrewVTally extends InstanceBase {
    constructor(internal) {
        super(internal)
        this.config = { port: 3000 }
        this.desired = blackout()
        this.confirmed = null
        this.running = false
        this.sending = false
        this.pending = false
        this.lastError = ''
        this.heartbeat = null
    }

    async init(config) {
        this.config = config || { port: 3000 }
        this.running = true
        defineVariables(this)
        defineActions(this)
        defineFeedbacks(this)
        definePresets(this)
        updateIndicators(this)
        this.updateStatus(InstanceStatus.Connecting)
        this.heartbeat = setInterval(() => this.send(), 1000)
        this.send() // Never restore an old on-air state on module startup.
    }

    async destroy() {
        this.running = false
        if (this.heartbeat) clearInterval(this.heartbeat)
        this.heartbeat = null
    }

    async configUpdated(config) {
        this.config = config
        this.desired = blackout()
        this.confirmed = null
        updateIndicators(this)
        this.send()
    }

    getConfigFields() {
        return [{
            type: 'number', id: 'port', label: 'Local Hub HTTP port',
            width: 6, min: 1, max: 65535, default: 3000,
        }]
    }

    get url() {
        const port = Number(this.config.port || 3000)
        if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid Hub port')
        return `http://127.0.0.1:${port}/api/companion/tally`
    }

    setDesired(state) {
        this.desired = { programs: [...state.programs], previews: [...state.previews] }
        this.send()
    }

    // Single in-flight POST ensures rapid button presses cannot reorder snapshots.
    async send() {
        this.pending = true
        if (!this.running || this.sending) return
        this.sending = true
        try {
            while (this.running && this.pending) {
                this.pending = false
                const state = { programs: [...this.desired.programs], previews: [...this.desired.previews] }
                try {
                    const response = await fetch(this.url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(state),
                        signal: AbortSignal.timeout(1500),
                    })
                    if (!response.ok) throw new Error(`Hub responded HTTP ${response.status}`)
                    const result = await response.json()
                    if (!result.active) throw new Error('Select Companion (HTTP) as the Hub mixer')
                    if (!this.running) return
                    if (!this.pending) {
                        this.confirmed = state
                        this.lastError = ''
                        this.updateStatus(InstanceStatus.Ok)
                        updateIndicators(this)
                    }
                } catch (error) {
                    if (!this.running) return
                    const message = String(error.message || error)
                    if (message !== this.lastError) this.log('warn', `vTally HTTP: ${message}`)
                    this.lastError = message
                    this.confirmed = null
                    this.updateStatus(InstanceStatus.ConnectionFailure, message)
                    updateIndicators(this)
                }
            }
        } finally {
            this.sending = false
        }
    }
}

runEntrypoint(GreenCrewVTally, [])
