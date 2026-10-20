import dgram from 'dgram'
import { describeListenError } from './startupFailure'
import { AppConfiguration } from './AppConfiguration'
import ServerEventEmitter from './ServerEventEmitter'
import TallyContainer from '../tally/TallyContainer'
import UdpTallyDriver from '../tally/UdpTallyDriver'

const errorWithCode = (code: string) => Object.assign(new Error(code), { code }) as NodeJS.ErrnoException

describe('startup port errors', () => {
    test('a busy port points at another running Hub', () => {
        const message = describeListenError(errorWithCode('EADDRINUSE'), 'tally (UDP)', 7411)
        expect(message).toContain('tally (UDP) port 7411 is already in use')
        expect(message).toContain('gc-tally.exe')
    })

    test('other errors keep the original reason', () => {
        expect(describeListenError(errorWithCode('EACCES'), 'web (HTTP)', 80)).toContain('not allowed')
        expect(describeListenError(errorWithCode('EOTHER'), 'web (HTTP)', 3000)).toContain('EOTHER')
    })

    test('the tally driver reports a busy UDP port instead of running without it', async () => {
        jest.useFakeTimers()
        const blocker = dgram.createSocket('udp4')
        await new Promise<void>(resolve => blocker.bind(0, resolve))
        try {
            const emitter = new ServerEventEmitter()
            const configuration = new AppConfiguration(emitter)
            configuration.tallyPort = blocker.address().port
            const failed = new Promise<NodeJS.ErrnoException>(resolve => {
                new UdpTallyDriver(configuration, new TallyContainer(configuration, emitter), resolve)
            })
            expect((await failed).code).toBe('EADDRINUSE')
        } finally {
            blocker.close()
            jest.useRealTimers()
        }
    })
})
