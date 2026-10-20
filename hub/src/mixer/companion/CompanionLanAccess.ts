import { randomBytes } from 'crypto'
import os from 'os'
import { CompanionLanState, MIN_COMPANION_TOKEN_LENGTH } from '../../lib/CompanionLanState'

export function generateCompanionToken(): string {
    return randomBytes(24).toString('hex')
}

/**
 * The environment variable wins so that existing setups keep working and an
 * administrator can pin the token outside the Hub.
 */
export function effectiveCompanionToken(envToken: string | undefined, hubToken: string | undefined): { token?: string, source: CompanionLanState['source'] } {
    if (envToken) return { token: envToken, source: 'env' }
    if (hubToken) return { token: hubToken, source: 'hub' }
    return { source: 'none' }
}

export function hubLanAddresses(interfaces = os.networkInterfaces()): string[] {
    return Object.values(interfaces)
        .flatMap(addresses => addresses || [])
        .filter(address => address.family === 'IPv4' && !address.internal)
        .map(address => address.address)
}

export function companionLanState(envToken: string | undefined, hubToken: string | undefined, isHubComputer: boolean, httpPort: number, addresses: string[]): CompanionLanState {
    const { token, source } = effectiveCompanionToken(envToken, hubToken)
    return {
        source,
        // the token grants control over the tallies, so only show it where the Hub runs
        token: isHubComputer ? token : undefined,
        tooShort: token !== undefined && token.length < MIN_COMPANION_TOKEN_LENGTH,
        canManage: isHubComputer && source !== 'env',
        hubAddresses: addresses,
        httpPort,
    }
}
