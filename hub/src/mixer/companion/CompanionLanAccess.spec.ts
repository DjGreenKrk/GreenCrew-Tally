import { companionLanState, effectiveCompanionToken, generateCompanionToken, hubLanAddresses } from './CompanionLanAccess'

describe('Companion LAN access', () => {
    const hubToken = 'a'.repeat(48)

    test('generates long random tokens', () => {
        const token = generateCompanionToken()
        expect(token).toMatch(/^[0-9a-f]{48}$/)
        expect(generateCompanionToken()).not.toEqual(token)
    })

    test('the environment variable wins over the token generated in the Hub', () => {
        expect(effectiveCompanionToken('e'.repeat(20), hubToken)).toEqual({ token: 'e'.repeat(20), source: 'env' })
        expect(effectiveCompanionToken(undefined, hubToken)).toEqual({ token: hubToken, source: 'hub' })
        expect(effectiveCompanionToken('', undefined)).toEqual({ source: 'none' })
    })

    test('shows the token and management only on the Hub computer', () => {
        const local = companionLanState(undefined, hubToken, true, 3000, ['192.168.1.10'])
        expect(local).toEqual({ source: 'hub', token: hubToken, tooShort: false, canManage: true, hubAddresses: ['192.168.1.10'], httpPort: 3000 })

        const remote = companionLanState(undefined, hubToken, false, 3000, ['192.168.1.10'])
        expect(remote.token).toBeUndefined()
        expect(remote.canManage).toBe(false)
        expect(remote.source).toEqual('hub')
    })

    test('a token from the environment is not managed in the Hub and short ones are flagged', () => {
        const state = companionLanState('short', undefined, true, 3000, [])
        expect(state).toMatchObject({ source: 'env', token: 'short', tooShort: true, canManage: false })
    })

    test('lists only external IPv4 addresses', () => {
        const addresses = hubLanAddresses({
            lo: [{ address: '127.0.0.1', family: 'IPv4', internal: true, netmask: '255.0.0.0', mac: '00:00:00:00:00:00', cidr: '127.0.0.1/8' }],
            eth0: [
                { address: '192.168.1.10', family: 'IPv4', internal: false, netmask: '255.255.255.0', mac: '00:11:22:33:44:55', cidr: '192.168.1.10/24' },
                { address: 'fe80::1', family: 'IPv6', internal: false, netmask: 'ffff:ffff:ffff:ffff::', mac: '00:11:22:33:44:55', cidr: 'fe80::1/64', scopeid: 2 },
            ],
        })
        expect(addresses).toEqual(['192.168.1.10'])
    })
})
