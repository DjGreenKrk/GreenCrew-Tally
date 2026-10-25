// Shared between the Hub and the browser: whether v2 tallies can find this
// Hub on their own (mDNS, #28).

export type HubDiscoveryState = {
    // "active": announced; "off": turned off with GC_TALLY_MDNS=off (or in
    // the test environment); "error": the announcement failed
    status: 'active' | 'off' | 'error'
    hubId: string
    // mDNS service instance, e.g. "GC Tally Hub 1a2b3c4d._gctally._udp.local"
    serviceName: string
    port: number
    error?: string
}
