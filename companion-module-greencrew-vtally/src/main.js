import { InstanceBase, InstanceStatus } from '@companion-module/base'
import { hubUrl } from './hub-address.js'
import { MAX_CAMERAS, blackout, configuredCameraIds, validateConfiguredState } from './state.js'
import { defineActions } from './actions.js'
import { defineFeedbacks, defineVariables, updateIndicators } from './feedbacks.js'
import { definePresets } from './presets.js'

// Localhost works without a token; remote Hub IPs require the Hub's LAN token.
export default class GreenCrewVTally extends InstanceBase {
    constructor(internal) {
        super(internal)
        this.config = { host: '127.0.0.1', port: 3000, cameraCount: 3, token: '' }
        this.desired = blackout()
        this.confirmed = null
        this.running = false
        this.sending = false
        this.pending = false
        this.sourceValid = true
        this.lastError = ''
        this.heartbeat = null
    }

    async init(config) {
        this.config = this.normalizeConfig(config)
        this.running = true
        this.refreshDefinitions()
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
        this.config = this.normalizeConfig(config)
        this.desired = blackout()
        this.sourceValid = true
        this.confirmed = null
        this.refreshDefinitions()
        this.send()
    }

    normalizeConfig(config) {
        const cameraCount = Number(config?.cameraCount)
        return {
            host: String(config?.host ?? '127.0.0.1').trim(),
            port: config?.port ?? 3000,
            token: String(config?.token ?? '').trim(),
            cameraCount: Number.isInteger(cameraCount) && cameraCount >= 1 && cameraCount <= MAX_CAMERAS ? cameraCount : 3,
        }
    }

    getCameraIds() {
        return configuredCameraIds(this.config.cameraCount)
    }

    refreshDefinitions() {
        defineVariables(this)
        defineActions(this)
        defineFeedbacks(this)
        definePresets(this)
        updateIndicators(this)
    }

    getConfigFields() {
        return [
            {
                type: 'textinput', id: 'host', label: 'Hub IP address or hostname',
                width: 6, default: '127.0.0.1',
            },
            {
                type: 'number', id: 'port', label: 'Local Hub HTTP port',
                width: 6, min: 1, max: 65535, default: 3000,
            },
            {
                type: 'number', id: 'cameraCount', label: 'Number of cameras',
                width: 6, min: 1, max: MAX_CAMERAS, step: 1, default: 3,
            },
            {
                type: 'textinput', id: 'token', label: 'Hub access token (LAN only; Hub → Configuration → Companion (HTTP) on the Hub computer)',
                width: 12, default: '',
            },
        ]
    }

    get url() {
        return hubUrl(this.config)
    }

    markSourceInvalid(message) {
        // Do not send a remembered Program/Preview snapshot forever if the
        // OBS source is unknown. With no heartbeats the Hub transitions to
        // UNKNOWN after its four-second watchdog.
        this.sourceValid = false
        this.pending = false
        this.confirmed = null
        this.lastError = message
        this.updateStatus(InstanceStatus.ConnectionFailure, message)
        updateIndicators(this)
    }

    setDesired(state) {
        try {
            validateConfiguredState(state, this.config.cameraCount)
        } catch (error) {
            const message = String(error.message || error)
            this.log('error', message)
            this.markSourceInvalid(message)
            return
        }
        this.sourceValid = true
        this.desired = { programs: [...state.programs], previews: [...state.previews], auxes: [...(state.auxes ?? [])] }
        this.send()
    }

    // Single in-flight POST ensures rapid button presses cannot reorder snapshots.
    async send() {
        this.pending = true
        if (!this.running || !this.sourceValid || this.sending) return
        this.sending = true
        try {
            while (this.running && this.sourceValid && this.pending) {
                this.pending = false
                const state = { programs: [...this.desired.programs], previews: [...this.desired.previews], auxes: [...this.desired.auxes] }
                try {
                    const response = await fetch(this.url, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            ...(this.config.token ? { Authorization: 'Bearer ' + this.config.token } : {}),
                        },
                        body: JSON.stringify(state),
                        signal: AbortSignal.timeout(1500),
                    })
                    if (!response.ok) throw new Error(`Hub responded HTTP ${response.status}`)
                    const result = await response.json()
                    if (!result.active) throw new Error('Select Companion (HTTP) as the Hub mixer')
                    if (!this.running || !this.sourceValid) return
                    if (!this.pending) {
                        this.confirmed = state
                        this.lastError = ''
                        this.updateStatus(InstanceStatus.Ok)
                        updateIndicators(this)
                    }
                } catch (error) {
                    if (!this.running) return
                    const message = String(error.message || error)
                    if (message !== this.lastError) this.log('warn', `GC Tally HTTP: ${message}`)
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

export const UpgradeScripts = []
