import { isLoopbackAddress, parseCompanionState } from './CompanionApi'

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
