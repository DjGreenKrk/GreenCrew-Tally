import { promises as fs } from 'fs'
import path from 'path'

// Every module is needed for a bootable NodeMCU tally; never flash only a partial set.
export const FIRMWARE_MODULES = [
    'my-app', 'my-led', 'my-log-buffer', 'my-log',
    'my-settings', 'my-tally', 'my-wifi',
]

export interface FirmwareFile {
    fileName: string
    filePath: string
    fileSize: number
}

/**
 * Both a pkg-built EXE and the Electron portable wrapper need files on disk.
 * The pkg virtual filesystem is read-only and does not include tally/out.
 * Development can fall back to Lua sources directly; NodeMCU supports .lua.
 */
export function firmwareSearchPaths() {
    const pkgProcess = process as NodeJS.Process & { pkg?: unknown }
    const paths: string[] = []
    if (pkgProcess.pkg) paths.push(path.join(path.dirname(process.execPath), 'esp8266'))
    paths.push(path.resolve(__dirname, '../esp8266'))
    paths.push(path.resolve(__dirname, '../../esp8266'))
    paths.push(path.resolve(__dirname, '../../../tally/out'))
    paths.push(path.resolve(__dirname, '../../../tally/src'))
    return Array.from(new Set(paths))
}

export async function findFirmwareFiles(searchPaths: string[] = firmwareSearchPaths()): Promise<FirmwareFile[]> {
    const failures: string[] = []
    for (const dir of searchPaths) {
        let entries: string[]
        try {
            entries = await fs.readdir(dir)
        } catch (error) {
            if (error && (error as NodeJS.ErrnoException).code === 'ENOENT') continue
            // 'pkg' can throw an ordinary Error for missing virtual folders.
            if (String(error).includes('was not included into executable')) continue
            throw error
        }

        const chosen = ['init.lua']
        const missing: string[] = []
        if (!entries.includes('init.lua')) missing.push('init.lua')
        for (const moduleName of FIRMWARE_MODULES) {
            const compiled = moduleName + '.lc'
            const source = moduleName + '.lua'
            if (entries.includes(compiled)) chosen.push(compiled)
            else if (entries.includes(source)) chosen.push(source)
            else missing.push(source + ' or ' + compiled)
        }
        if (missing.length) {
            failures.push(dir + ': missing ' + missing.join(', '))
            continue
        }
        const files = await Promise.all(chosen.map(async fileName => ({
            fileName,
            filePath: path.join(dir, fileName),
            fileSize: (await fs.stat(path.join(dir, fileName))).size,
        })))
        console.info('Using vTally ESP8266 firmware from ' + dir)
        return files
    }
    throw new Error('Firmware unavailable: no complete ESP8266 Lua bundle was found. ' +
        'Expected an esp8266 folder beside vtally.exe or the tally/src sources. ' + failures.join('; '))
}
