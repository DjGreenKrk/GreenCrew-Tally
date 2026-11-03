import { EventEmitter } from 'events'
import { spawn } from 'child_process'
import * as EsptoolAssets from './EsptoolAssets'
import { flashBaseFirmware, BaseFirmwareProgressType } from './EsptoolFlasher'
import { releaseSerialPortMutex, tryToAcquireSerialPortMutex } from './NodeMcuConnector'

jest.mock('child_process')
const mockedSpawn = spawn as unknown as jest.Mock

// Esptool subprocess mock only. This is NOT physical ESP8266 acceptance.
describe('flashing the base NodeMCU firmware with the bundled esptool.exe', () => {
    const assets = { esptoolPath: 'C:\\gc-tally\\tools\\esptool\\esptool.exe', firmwarePath: 'C:\\gc-tally\\firmware\\nodemcu.bin' }

    beforeEach(() => {
        jest.spyOn(EsptoolAssets, 'findEsptoolAssets').mockResolvedValue(assets)
        mockedSpawn.mockReset()
    })
    afterEach(() => {
        jest.restoreAllMocks()
        jest.useRealTimers()
    })

    type FakeChild = EventEmitter & { stdout: EventEmitter, stderr: EventEmitter, kill: jest.Mock }
    function fakeChild(): FakeChild {
        const child = new EventEmitter() as FakeChild
        child.stdout = new EventEmitter()
        child.stderr = new EventEmitter()
        child.kill = jest.fn()
        return child
    }

    /** Resolves each spawned call in order, after a tick, so listeners attach first. */
    function queueSpawnResults(results: Array<{exitCode: number, stdoutLines?: string[]}>) {
        let call = 0
        mockedSpawn.mockImplementation(() => {
            const { exitCode, stdoutLines } = results[call]
            call++
            const child = fakeChild()
            setTimeout(() => {
                for (const line of stdoutLines || []) child.stdout.emit('data', Buffer.from(line + '\n'))
                child.emit('close', exitCode)
            }, 1)
            return child
        })
    }

    test('fails fast with no subprocess when the esptool bundle is unavailable', async () => {
        jest.spyOn(EsptoolAssets, 'findEsptoolAssets').mockRejectedValue(new Error('no bundle'))
        const states: BaseFirmwareProgressType[] = []
        const ok = await flashBaseFirmware('COM3', state => states.push({ ...state }))
        expect(ok).toBe(false)
        expect(mockedSpawn).not.toHaveBeenCalled()
        expect(states.at(-1)?.error).toBe(true)
        expect(states.at(-1)?.errorMessage).toContain('no bundle')
    })

    test('checks the board, erases, writes the image and reports progress', async () => {
        queueSpawnResults([
            { exitCode: 0 }, // flash_id
            { exitCode: 0 }, // erase_flash
            { exitCode: 0, stdoutLines: ['Writing at 0x00001000... (11 %)', 'Writing at 0x00010000... (100 %)'] }, // write_flash
        ])
        const states: BaseFirmwareProgressType[] = []
        const ok = await flashBaseFirmware('COM3', state => states.push({ ...state }))

        expect(ok).toBe(true)
        expect(mockedSpawn).toHaveBeenCalledTimes(3)
        expect(mockedSpawn.mock.calls[0][1]).toEqual(['--chip', 'esp8266', '--port', 'COM3', 'flash_id'])
        expect(mockedSpawn.mock.calls[1][1]).toEqual(['--chip', 'esp8266', '--port', 'COM3', 'erase_flash'])
        expect(mockedSpawn.mock.calls[2][1]).toEqual(
            ['--chip', 'esp8266', '--port', 'COM3', '--baud', '460800', 'write_flash', '-fm', 'dio', '0x00000', assets.firmwarePath])

        const last = states.at(-1)
        expect(last?.connectionDone).toBe(true)
        expect(last?.eraseDone).toBe(true)
        expect(last?.writeDone).toBe(true)
        expect(last?.allDone).toBe(true)
        expect(last?.error).toBe(false)
        expect(states.some(s => s.writePercent === 11)).toBe(true)
        expect(last?.writePercent).toBe(100)
    })

    test('retries write_flash at the slower baud rate if the fast one fails, like flash-nodemcu.cmd', async () => {
        queueSpawnResults([
            { exitCode: 0 }, // flash_id
            { exitCode: 0 }, // erase_flash
            { exitCode: 2 }, // write_flash @ 460800 fails
            { exitCode: 0 }, // write_flash @ 115200 succeeds
        ])
        const ok = await flashBaseFirmware('COM3', () => {})

        expect(ok).toBe(true)
        expect(mockedSpawn).toHaveBeenCalledTimes(4)
        expect(mockedSpawn.mock.calls[2][1]).toContain('460800')
        expect(mockedSpawn.mock.calls[3][1]).toContain('115200')
    })

    test('reports a clean failure, not a hang, when the board never answers', async () => {
        queueSpawnResults([{ exitCode: 1 }]) // flash_id fails: no board on this port
        const states: BaseFirmwareProgressType[] = []
        const ok = await flashBaseFirmware('COM3', state => states.push(state))

        expect(ok).toBe(false)
        expect(mockedSpawn).toHaveBeenCalledTimes(1)
        expect(states.at(-1)?.connectionDone).toBe(false)
        expect(states.at(-1)?.error).toBe(true)
    })

    test('kills a stuck esptool step instead of hanging forever', async () => {
        jest.useFakeTimers()
        const child = fakeChild()
        mockedSpawn.mockImplementation(() => child) // never closes on its own

        const promise = flashBaseFirmware('COM3', () => {})
        await jest.advanceTimersByTimeAsync(15000)
        expect(child.kill).toHaveBeenCalled()
        child.emit('close', null) // simulate the OS actually killing it
        expect(await promise).toBe(false)
    })

    test('never runs esptool while NodeMcuConnector holds the serial port, and vice versa', async () => {
        queueSpawnResults([{ exitCode: 0 }, { exitCode: 0 }, { exitCode: 0 }])
        expect(tryToAcquireSerialPortMutex()).toBe(true) // simulates an in-flight NodeMcuConnector job
        try {
            const promise = flashBaseFirmware('COM3', () => {})
            await new Promise(resolve => setTimeout(resolve, 50))
            expect(mockedSpawn).not.toHaveBeenCalled()

            releaseSerialPortMutex()
            expect(await promise).toBe(true)
        } finally {
            releaseSerialPortMutex()
        }
    })
})
