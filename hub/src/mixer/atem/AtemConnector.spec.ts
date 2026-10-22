import { spawn, ChildProcessWithoutNullStreams } from 'child_process'
import path from 'path'
import { Atem, AtemState, AtemStateUtil } from 'atem-connection'
import AtemConnector, { listAuxInputs } from './AtemConnector'
import AtemConfiguration from './AtemConfiguration'
import { MixerCommunicator } from '../../lib/MixerCommunicator'
import { AppConfiguration } from '../../lib/AppConfiguration'
import ServerEventEmitter from '../../lib/ServerEventEmitter'

// the state is read-only for library users; the tests set it directly
const setAuxes = (state: AtemState, auxes: Array<number | undefined>) => {
    (state.video as { auxilliaries: Array<number | undefined> }).auxilliaries = auxes
}

describe('listAuxInputs', () => {
    test('lists the inputs on the aux buses', () => {
        const state = AtemStateUtil.Create()
        setAuxes(state, [3, undefined, 5, 3])
        expect(listAuxInputs(state).sort()).toEqual([3, 5])
    })
    test('expands a M/E program output on an aux', () => {
        const state = AtemStateUtil.Create()
        AtemStateUtil.getMixEffect(state, 1).programInput = 7
        setAuxes(state, [10020])
        expect(listAuxInputs(state)).toEqual([7])
    })
    test('ignores a M/E that does not exist', () => {
        const state = AtemStateUtil.Create()
        setAuxes(state, [10030])
        expect(listAuxInputs(state)).toEqual([])
    })
})

class RecordingCommunicator extends MixerCommunicator {
    constructor() {
        const emitter = new ServerEventEmitter()
        super(new AppConfiguration(emitter), emitter)
    }
    state = { programs: [] as string[], previews: [] as string[], auxes: [] as string[] }
    connected = false
    notifyProgramPreviewChanged(programs, previews, auxes = []) {
        this.state = { programs, previews, auxes }
    }
    notifyChannels() {}
    notifyMixerIsConnected() { this.connected = true }
    notifyMixerIsDisconnected() { this.connected = false }
}

const waitFor = async (condition: () => boolean) => {
    const deadline = Date.now() + 5000
    while (!condition()) {
        if (Date.now() > deadline) throw new Error('timed out')
        await new Promise(resolve => setTimeout(resolve, 50))
    }
}

describe('AtemConnector with the ATEM simulator', () => {
    const port = 19911
    let simulator: ChildProcessWithoutNullStreams
    let connector: AtemConnector

    beforeAll(async () => {
        simulator = spawn(process.execPath, [path.join(__dirname, '../../../scripts/atem-simulator.cjs'), '--port', String(port), '--auxes', '2'])
        await new Promise(resolve => simulator.stdout.once('data', resolve))
    })
    afterEach(() => connector?.disconnect())
    afterAll(() => { simulator.kill() })

    test('reports program, preview and aux', async () => {
        const configuration = new AtemConfiguration().setIp('127.0.0.1').setPort(port)
        const communicator = new RecordingCommunicator()
        connector = new AtemConnector(configuration, communicator, () => new Atem({ disableMultithreaded: true }))
        connector.connect()

        await waitFor(() => communicator.connected)
        expect(communicator.state).toEqual({ programs: ['1'], previews: ['2'], auxes: ['1'] })

        simulator.stdin.write('aux 2 4\npgm 3\n')
        await waitFor(() => communicator.state.programs[0] === '3' && communicator.state.auxes.length === 2)
        expect(communicator.state).toEqual({ programs: ['3'], previews: ['2'], auxes: ['1', '4'] })
    })
})
