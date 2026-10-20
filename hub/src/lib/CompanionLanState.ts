// Shared between the Hub and the browser: what the Configuration page shows
// about remote (LAN) access for the Companion HTTP source.

export const MIN_COMPANION_TOKEN_LENGTH = 16

export type CompanionLanState = {
    // "env": VTALLY_COMPANION_TOKEN, managed outside the Hub;
    // "hub": generated on the Configuration page; "none": localhost only
    source: 'env' | 'hub' | 'none'
    // only sent to a browser running on the Hub computer
    token?: string
    // a token shorter than MIN_COMPANION_TOKEN_LENGTH is never accepted
    tooShort: boolean
    // whether this browser may generate or remove the token (Hub computer only)
    canManage: boolean
    // IPv4 addresses Companion on another computer can use to reach the Hub
    hubAddresses: string[]
    httpPort: number
}
