import { isLoopbackAddress, isAuthorizedCompanionRequest, parseCompanionState } from './CompanionApi'

describe('local-only Companion API', () => {
    test('allows loopback', () => {
        expect(isLoopbackAddress('127.0.0.1')).toBe(true)
        expect(isLoopbackAddress('::1')).toBe(true)
        expect(isLoopbackAddress('::ffff:127.0.0.1')).toBe(true)
    })
    test('rejects LAN addresses', () => {
        expect(isLoopbackAddress('192.168.1.10')).toBe(false)
        expect(isLoopbackAddress('::ffff:192.168.1.10')).toBe(false)
        expect(isLoopbackAddress(undefined)).toBe(false)
    })
})
describe('full Program/Preview state', () => {
    test('normalizes numbers and accepts blackout', () => {
        expect(parseCompanionState({ programs: [1], previews: ['2'] }))
            .toEqual({ programs: ['1'], previews: ['2'] })
        expect(parseCompanionState({ programs: [], previews: [] }))
            .toEqual({ programs: [], previews: [] })
    })
    test.each([
        null, [], {}, { programs: [1] }, { programs: null, previews: [] },
        { programs: ['0'], previews: [] }, { programs: [9], previews: [] },
        { programs: ['01'], previews: [] }, { programs: ['1', 1], previews: [] },
        { programs: ['2.5'], previews: [] }, { programs: [{}], previews: [] },
        { programs: Array(9).fill('1'), previews: [] }
    ])('rejects malformed payload %p', data => {
        expect(parseCompanionState(data)).toBeNull()
    })
})

describe('Companion HTTP LAN token authentication', () => {
    const token = '0e7bc3db623cf1473584d46e46b951f2'

    test('localhost still works without any token', () => {
        expect(isAuthorizedCompanionRequest('127.0.0.1', undefined, undefined)).toBe(true)
        expect(isAuthorizedCompanionRequest('::1', undefined, undefined)).toBe(true)
    })

    test('remote is rejected unless a strong configured token matches', () => {
        expect(isAuthorizedCompanionRequest('192.168.88.20', undefined, undefined)).toBe(false)
        expect(isAuthorizedCompanionRequest('192.168.88.20', undefined, token)).toBe(false)
        expect(isAuthorizedCompanionRequest('192.168.88.20', 'Bearer incorrect', token)).toBe(false)
        expect(isAuthorizedCompanionRequest('192.168.88.20', 'Bearer ' + token, undefined)).toBe(false)
        expect(isAuthorizedCompanionRequest('192.168.88.20', 'Bearer short', 'short')).toBe(false)
        expect(isAuthorizedCompanionRequest('192.168.88.20', 'Bearer ' + token, token)).toBe(true)
        expect(isAuthorizedCompanionRequest('::ffff:192.168.88.20', 'Bearer ' + token, token)).toBe(true)
    })

    test('cannot spoof loopback via forwarded-for', () => {
        expect(isAuthorizedCompanionRequest('192.168.88.20', 'Bearer ', token)).toBe(false)
        expect(isAuthorizedCompanionRequest(undefined, 'Bearer ' + token, token)).toBe(true)
        expect(isAuthorizedCompanionRequest(undefined, undefined, token)).toBe(false)
    })
})
