import { promises as fs } from 'fs'
import os from 'os'
import path from 'path'
import { FIRMWARE_MODULES, findFirmwareFiles } from './FirmwareAssets'

describe('flashable ESP8266 firmware discovery', () => {
    let tempDir: string

    beforeEach(async () => {
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vtally-firmware-'))
    })

    afterEach(async () => {
        await fs.rmdir(tempDir, { recursive: true })
    })

    test('loads init.lua and every module as precompiled .lc', async () => {
        await fs.writeFile(path.join(tempDir, 'init.lua'), '-- init')
        for (const name of FIRMWARE_MODULES) {
            await fs.writeFile(path.join(tempDir, name + '.lua'), '-- source')
            await fs.writeFile(path.join(tempDir, name + '.lc'), 'compiled')
        }
        const files = await findFirmwareFiles([tempDir])
        expect(files).toHaveLength(8)
        expect(files.map(file => file.fileName).sort()).toEqual(
            ['init.lua', ...FIRMWARE_MODULES.map(name => name + '.lc')].sort())
        expect(files.every(file => file.fileSize > 0)).toBe(true)
        expect(files.every(file => file.filePath.startsWith(tempDir))).toBe(true)
    })

    test('never flashes .lua module sources, which can exhaust the ESP8266 heap', async () => {
        await fs.writeFile(path.join(tempDir, 'init.lua'), '-- init')
        for (const name of FIRMWARE_MODULES) {
            await fs.writeFile(path.join(tempDir, name + '.lua'), '-- source')
        }
        await expect(findFirmwareFiles([tempDir])).rejects.toThrow(/missing my-app\.lc/)
    })

    test('the repository ships a complete precompiled bundle in tally/out', async () => {
        const files = await findFirmwareFiles([path.resolve(__dirname, '../../../tally/out')])
        expect(files.filter(file => file.fileName.endsWith('.lc'))).toHaveLength(FIRMWARE_MODULES.length)
    })

    test('skips missing and incomplete bundles instead of flashing partial firmware', async () => {
        await fs.writeFile(path.join(tempDir, 'init.lua'), '-- incomplete')
        const complete = path.join(tempDir, 'complete')
        await fs.mkdir(complete)
        await fs.writeFile(path.join(complete, 'init.lua'), '-- init')
        for (const name of FIRMWARE_MODULES) await fs.writeFile(path.join(complete, name + '.lc'), 'compiled')
        const result = await findFirmwareFiles([
            path.join(tempDir, 'does-not-exist'),
            tempDir,
            complete,
        ])
        expect(result).toHaveLength(8)
        expect(result[0].filePath).toContain('complete')
    })

    test('missing firmware gives an actionable error, not an unhandled pkg crash', async () => {
        await expect(findFirmwareFiles([tempDir])).rejects.toThrow(/Firmware unavailable/)
        await expect(findFirmwareFiles([tempDir])).rejects.toThrow(/missing init.lua/)
    })
})
