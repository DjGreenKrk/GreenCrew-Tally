import { EventEmitter } from 'events'
import HubAnnouncer, { ResponderFactory, hostNameFor } from './HubAnnouncer'
import { HubDiscoveryState } from './HubDiscoveryState'

type Published = { name: string, type: string, protocol: string, port: number, host: string, txt: Record<string, string> }

function fakeResponder() {
    const published: Published[] = []
    const services: EventEmitter[] = []
    let destroyed = 0
    let reportError: (error: Error) => void = () => {}
    const factory: ResponderFactory = (onError) => {
        reportError = onError
        return {
            publish(config) {
                published.push(config)
                const service = Object.assign(new EventEmitter(), { stop: () => {} })
                services.push(service)
                return service
            },
            unpublishAll(callback) { callback?.() },
            destroy() { destroyed++ },
        }
    }
    return { factory, published, services, destroyed: () => destroyed, error: (error: Error) => reportError(error) }
}

describe('HubAnnouncer', () => {
    beforeEach(() => {
        jest.spyOn(console, 'info').mockImplementation(() => {})
        jest.spyOn(console, 'error').mockImplementation(() => {})
    })
    afterEach(() => jest.restoreAllMocks())

    test('it announces the Hub id in the host name and the TXT record', () => {
        const fake = fakeResponder()
        const states: HubDiscoveryState[] = []
        const announcer = new HubAnnouncer(state => states.push(state), fake.factory)
        announcer.start('1a2b3c4d', 7411)

        expect(fake.published).toHaveLength(1)
        expect(fake.published[0]).toMatchObject({
            name: 'GC Tally Hub 1a2b3c4d',
            type: 'gctally',
            protocol: 'udp',
            port: 7411,
            host: 'gctally-hub-1a2b3c4d.local',
        })
        expect(fake.published[0].txt).toMatchObject({ v: '1', id: '1a2b3c4d' })
        expect(states[states.length - 1]).toEqual({
            status: 'active', hubId: '1a2b3c4d', port: 7411,
            serviceName: 'GC Tally Hub 1a2b3c4d._gctally._udp.local',
        })
        expect(hostNameFor('00ff00ff')).toEqual('gctally-hub-00ff00ff.local')
    })

    test('a socket error is reported, not thrown', () => {
        const fake = fakeResponder()
        const announcer = new HubAnnouncer(() => {}, fake.factory)
        announcer.start('1a2b3c4d', 7411)
        fake.error(new Error('bind EADDRINUSE 0.0.0.0:5353'))

        expect(announcer.getState()).toMatchObject({ status: 'error', hubId: '1a2b3c4d', error: 'bind EADDRINUSE 0.0.0.0:5353' })
        expect(fake.destroyed()).toEqual(1)
    })

    test('a service error is reported too', () => {
        const fake = fakeResponder()
        const announcer = new HubAnnouncer(() => {}, fake.factory)
        announcer.start('1a2b3c4d', 7411)
        fake.services[0].emit('error', new Error('Service name is already in use on the network'))
        expect(announcer.getState().status).toEqual('error')
    })

    test('a failing responder does not stop the Hub', () => {
        const announcer = new HubAnnouncer(() => {}, () => { throw new Error('no network') })
        expect(() => announcer.start('1a2b3c4d', 7411)).not.toThrow()
        expect(announcer.getState()).toMatchObject({ status: 'error', error: 'no network' })
    })

    test('starting again replaces the announcement', () => {
        const fake = fakeResponder()
        const announcer = new HubAnnouncer(() => {}, fake.factory)
        announcer.start('1a2b3c4d', 7411)
        announcer.start('1a2b3c4d', 7412)
        expect(fake.destroyed()).toEqual(1)
        expect(fake.published[1].port).toEqual(7412)
        expect(announcer.getState()).toMatchObject({ status: 'active', port: 7412 })
    })

    test('it can be turned off and keeps showing the id', () => {
        const announcer = new HubAnnouncer(() => {}, fakeResponder().factory)
        announcer.disable('1a2b3c4d', 7411)
        expect(announcer.getState()).toEqual({ status: 'off', hubId: '1a2b3c4d', serviceName: '', port: 7411 })
    })
})
