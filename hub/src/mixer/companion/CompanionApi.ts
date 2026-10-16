import express from 'express'
import { timingSafeEqual } from 'crypto'
import { MixerDriver } from '../../lib/MixerDriver'
import CompanionConnector from './CompanionConnector'

// Requests must originate from the Hub machine. Never trust X-Forwarded-For.
export function isLoopbackAddress(address?: string): boolean {
    return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1'
}

/**
 * Local calls remain authenticated by loopback address. Remote network calls
 * are opt-in and require the token explicitly configured on the Hub host.
 * Never trust the X-Forwarded-For HTTP header for this decision.
 */
export function isAuthorizedCompanionRequest(address: string | undefined, authorization: string | undefined, token: string | undefined): boolean {
    if (isLoopbackAddress(address)) return true
    if (!token || token.length < 16 || !authorization || !authorization.startsWith('Bearer ')) return false
    const expected = Buffer.from(token, 'utf8')
    const received = Buffer.from(authorization.slice('Bearer '.length), 'utf8')
    return received.length === expected.length && timingSafeEqual(received, expected)
}

export type CompanionTallyState = { programs: string[], previews: string[] }

export function parseCompanionState(value: unknown): CompanionTallyState | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null
    const body = value as { programs?: unknown, previews?: unknown }
    const parseChannels = (items: unknown): string[] | null => {
        if (!Array.isArray(items) || items.length > 8) return null
        const normalized: string[] = []
        for (const item of items) {
            if (typeof item !== 'number' && typeof item !== 'string') return null
            const str = String(item)
            if (!/^[1-8]$/.test(str) || normalized.includes(str)) return null
            normalized.push(str)
        }
        return normalized
    }
    const programs = parseChannels(body.programs)
    const previews = parseChannels(body.previews)
    return programs && previews ? { programs, previews } : null
}

export default function registerCompanionApi(app: express.Express, driver: MixerDriver): void {
    const activeConnector = (): CompanionConnector | null => (
        driver.currentMixerId === CompanionConnector.ID &&
        driver.currentMixerInstance instanceof CompanionConnector &&
        driver.currentMixerInstance.isActive()
    ) ? driver.currentMixerInstance : null

    app.use('/api/companion', (req, res, next) => {
        res.setHeader('Cache-Control', 'no-store')
        if (!isAuthorizedCompanionRequest(
            req.socket.remoteAddress,
            req.get('authorization'),
            process.env.VTALLY_COMPANION_TOKEN,
        )) {
            res.status(403).json({ error: 'Companion API: remote access requires the Hub access token' })
            return
        }
        next()
    })

    app.get('/api/companion/tally', (_req, res) => {
        const connector = activeConnector()
        const active = connector !== null
        res.json({
            active,
            receiving: connector ? connector.isConnected() : false,
            ageMs: connector ? connector.getSnapshotAgeMs() : null,
            timeoutMs: CompanionConnector.TIMEOUT_MS,
            programs: active ? (driver.getCurrentPrograms() || []) : [],
            previews: active ? (driver.getCurrentPreviews() || []) : [],
        })
    })

    app.post('/api/companion/tally', express.json({ limit: '4kb' }), (req, res) => {
        const connector = activeConnector()
        if (!connector) {
            res.status(409).json({ error: 'Select Companion (HTTP) as the mixer in Hub settings first' })
            return
        }
        const state = parseCompanionState(req.body)
        if (!state) {
            res.status(400).json({ error: 'Expected {"programs":[],"previews":[]} with unique channel IDs 1..8' })
            return
        }
        connector.setState(state.programs, state.previews)
        res.json({ active: true, receiving: true, programs: state.programs, previews: state.previews })
    })
}
