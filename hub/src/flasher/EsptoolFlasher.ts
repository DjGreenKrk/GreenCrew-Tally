import { spawn } from 'child_process'
import { findEsptoolAssets } from './EsptoolAssets'
import { releaseSerialPortMutex, tryToAcquireSerialPortMutex } from './NodeMcuConnector'

const chip = 'esp8266'
const flashOffset = '0x00000'
// Mirrors release/windows/flash-nodemcu.cmd: try the fast baud rate first,
// fall back to the safe one some USB-UART bridges/cables need.
const writeBaudRates = [460800, 115200]

export interface BaseFirmwareProgressType {
    inititalizeDone: boolean
    connectionDone: boolean
    eraseDone: boolean
    writePercent: number
    writeDone: boolean
    allDone: boolean
    error: boolean
    errorMessage?: string
}

function freshProgress(): BaseFirmwareProgressType {
    return {
        inititalizeDone: false,
        connectionDone: false,
        eraseDone: false,
        writePercent: 0,
        writeDone: false,
        allDone: false,
        error: false,
    }
}

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

/** Runs one esptool.exe subcommand to completion, or rejects after `timeoutMs`. */
function runEsptool(esptoolPath: string, args: string[], timeoutMs: number, onLine?: (line: string) => void): Promise<void> {
    return new Promise((resolve, reject) => {
        let output = ''
        let timedOut = false
        const child = spawn(esptoolPath, args)

        const timer = setTimeout(() => {
            timedOut = true
            child.kill()
        }, timeoutMs)

        const onData = (chunk: Buffer) => {
            const text = chunk.toString()
            output += text
            if (onLine) {
                for (const line of text.split(/\r?\n/)) {
                    if (line) onLine(line)
                }
            }
        }
        child.stdout.on('data', onData)
        child.stderr.on('data', onData)

        child.on('error', error => {
            clearTimeout(timer)
            reject(new Error(`Could not start esptool: ${String(error)}`))
        })
        child.on('close', code => {
            clearTimeout(timer)
            if (timedOut) {
                reject(new Error(`esptool ${args[0]} timed out after ${timeoutMs}ms`))
            } else if (code !== 0) {
                reject(new Error(`esptool ${args.join(' ')} failed (exit code ${code}):\n${output.trim()}`))
            } else {
                resolve()
            }
        })
    })
}

/**
 * Erases an ESP8266 and writes the bundled base NodeMCU image - the one-time
 * step release/windows/flash-nodemcu.cmd otherwise needs run by hand before
 * the Hub's Flash page can install the tally application (issue #5).
 *
 * Shares NodeMcuConnector's serial port mutex: esptool.exe and nodemcu-tool
 * must never address the same port at the same time.
 */
export async function flashBaseFirmware(path: string, onProgress: (state: BaseFirmwareProgressType) => void): Promise<boolean> {
    const progress = freshProgress()
    onProgress(progress)

    let esptoolPath: string
    let firmwarePath: string
    try {
        const assets = await findEsptoolAssets()
        esptoolPath = assets.esptoolPath
        firmwarePath = assets.firmwarePath
    } catch (error) {
        console.error('Cannot flash base firmware: ' + String(error))
        progress.error = true
        progress.errorMessage = error instanceof Error ? error.message : String(error)
        onProgress(progress)
        return false
    }

    while (!tryToAcquireSerialPortMutex()) {
        await sleep(100)
    }
    try {
        progress.inititalizeDone = true
        onProgress(progress)

        await runEsptool(esptoolPath, ['--chip', chip, '--port', path, 'flash_id'], 15000)
        progress.connectionDone = true
        onProgress(progress)

        await runEsptool(esptoolPath, ['--chip', chip, '--port', path, 'erase_flash'], 60000)
        progress.eraseDone = true
        onProgress(progress)

        const onWriteLine = (line: string) => {
            const match = line.match(/\((\d{1,3})\s*%\)/)
            if (match) {
                progress.writePercent = Math.min(100, parseInt(match[1], 10))
                onProgress(progress)
            }
        }
        const writeArgs = (baud: number) => [
            '--chip', chip, '--port', path, '--baud', String(baud),
            'write_flash', '-fm', 'dio', flashOffset, firmwarePath,
        ]

        let lastError: unknown
        let wrote = false
        for (const [index, baud] of writeBaudRates.entries()) {
            try {
                if (index > 0) {
                    console.warn(`esptool write_flash at ${writeBaudRates[index - 1]} baud failed, retrying at ${baud}: ${String(lastError)}`)
                    progress.writePercent = 0
                    onProgress(progress)
                }
                await runEsptool(esptoolPath, writeArgs(baud), 180000, onWriteLine)
                wrote = true
                break
            } catch (error) {
                lastError = error
            }
        }
        if (!wrote) throw lastError

        progress.writePercent = 100
        progress.writeDone = true
        progress.allDone = true
        onProgress(progress)
        return true
    } catch (error) {
        console.error('Flashing base firmware failed: ' + String(error))
        progress.error = true
        progress.errorMessage = error instanceof Error ? error.message : String(error)
        onProgress(progress)
        return false
    } finally {
        releaseSerialPortMutex()
    }
}
