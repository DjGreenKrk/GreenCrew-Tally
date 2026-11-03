import { promises as fs } from 'fs'
import path from 'path'

export interface EsptoolAssets {
    esptoolPath: string
    firmwarePath: string
}

/**
 * The bundled esptool.exe and base NodeMCU image only exist beside the
 * packaged gc-tally.exe (see windows-bundle.yml, which places them at
 * tools/esptool/esptool.exe and firmware/*.bin). A dev checkout never has
 * them, so this is unavailable outside the Windows bundle - same as the
 * esp8266 Lua modules in FirmwareAssets.ts are unavailable outside a build.
 */
export function esptoolSearchRoot(): string | undefined {
    const pkgProcess = process as NodeJS.Process & { pkg?: unknown }
    return pkgProcess.pkg ? path.dirname(process.execPath) : undefined
}

export async function findEsptoolAssets(root: string | undefined = esptoolSearchRoot()): Promise<EsptoolAssets> {
    if (!root) {
        throw new Error('Flashing the base firmware is only available in the packaged gc-tally.exe.')
    }

    const esptoolPath = path.join(root, 'tools', 'esptool', 'esptool.exe')
    const firmwareDir = path.join(root, 'firmware')

    try {
        await fs.access(esptoolPath)
    } catch (error) {
        throw new Error(`esptool not found at ${esptoolPath}: ${String(error)}`)
    }

    let entries: string[]
    try {
        entries = await fs.readdir(firmwareDir)
    } catch (error) {
        throw new Error(`Base firmware folder not found at ${firmwareDir}: ${String(error)}`)
    }

    const binFiles = entries.filter(name => name.toLowerCase().endsWith('.bin'))
    if (binFiles.length !== 1) {
        throw new Error(`Expected exactly one base firmware image (*.bin) in ${firmwareDir}, found ${binFiles.length}.`)
    }

    return { esptoolPath, firmwarePath: path.join(firmwareDir, binFiles[0]) }
}
