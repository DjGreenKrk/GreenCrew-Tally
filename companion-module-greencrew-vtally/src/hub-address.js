import { isIP } from 'node:net'

/** Accept an IP address or local DNS host, not a URL or embedded port/path. */
export function hubUrl(config) {
    const host = String(config?.host ?? '127.0.0.1').trim()
    const port = Number(config?.port ?? 3000)
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid Hub port')
    const version = isIP(host)
    if (!version && !/^[a-z0-9-]+(?:\.[a-z0-9-]+)*$/i.test(host)) {
        throw new Error('Hub address must be an IP address or hostname, without http:// or a port')
    }
    if (!host) throw new Error('Hub IP/hostname cannot be empty')
    const hostname = version === 6 ? `[${host}]` : host
    return `http://${hostname}:${port}/api/companion/tally`
}
