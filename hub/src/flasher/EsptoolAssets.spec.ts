import { promises as fs } from 'fs'
import os from 'os'
import path from 'path'
import { findEsptoolAssets } from './EsptoolAssets'

describe('bundled esptool/base-firmware discovery', () => {
    let tempDir: string

    beforeEach(async () => {
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vtally-esptool-'))
    })

    afterEach(async () => {
        await fs.rmdir(tempDir, { recursive: true })
    })

    async function makeBundle() {
        await fs.mkdir(path.join(tempDir, 'tools', 'esptool'), { recursive: true })
        await fs.writeFile(path.join(tempDir, 'tools', 'esptool', 'esptool.exe'), 'fake exe')
        await fs.mkdir(path.join(tempDir, 'firmware'))
        await fs.writeFile(path.join(tempDir, 'firmware', 'nodemcu-3.0-float.bin'), 'fake image')
    }

    test('rejects when not running from the packaged bundle (root is undefined)', async () => {
        await expect(findEsptoolAssets(undefined)).rejects.toThrow('packaged gc-tally.exe')
    })

    test('finds esptool.exe and the one base firmware image beside gc-tally.exe', async () => {
        await makeBundle()
        const assets = await findEsptoolAssets(tempDir)
        expect(assets.esptoolPath).toBe(path.join(tempDir, 'tools', 'esptool', 'esptool.exe'))
        expect(assets.firmwarePath).toBe(path.join(tempDir, 'firmware', 'nodemcu-3.0-float.bin'))
    })

    test('fails with an actionable error when esptool.exe is missing', async () => {
        await fs.mkdir(path.join(tempDir, 'firmware'))
        await fs.writeFile(path.join(tempDir, 'firmware', 'nodemcu.bin'), 'fake image')
        await expect(findEsptoolAssets(tempDir)).rejects.toThrow(/esptool not found/)
    })

    test('fails when the firmware folder is missing', async () => {
        await fs.mkdir(path.join(tempDir, 'tools', 'esptool'), { recursive: true })
        await fs.writeFile(path.join(tempDir, 'tools', 'esptool', 'esptool.exe'), 'fake exe')
        await expect(findEsptoolAssets(tempDir)).rejects.toThrow(/Base firmware folder not found/)
    })

    test('refuses an ambiguous firmware folder instead of guessing which image to flash', async () => {
        await makeBundle()
        await fs.writeFile(path.join(tempDir, 'firmware', 'another.bin'), 'second image')
        await expect(findEsptoolAssets(tempDir)).rejects.toThrow(/found 2/)
    })
})
