import readline from 'readline'

const banner = '='.repeat(72)
let failing = false

/** Turns a failed listen/bind into advice an operator can act on. */
export function describeListenError(error: NodeJS.ErrnoException, purpose: string, port: number): string {
    if (error.code === 'EADDRINUSE') {
        return `The ${purpose} port ${port} is already in use.\n` +
            `Another vTally Hub is probably still running (look for vtally.exe in Task Manager),\n` +
            `or another program uses this port. Close it and start vTally again.`
    }
    if (error.code === 'EACCES') {
        return `The ${purpose} port ${port} is not allowed for this user or is blocked by the system.`
    }
    return `Could not open the ${purpose} port ${port}: ${error.message}`
}

/**
 * Explains a fatal startup problem and exits. A double-clicked vtally.exe
 * runs in its own console window, which would vanish with the message, so
 * the packaged Hub waits for Enter first.
 */
export function exitWithStartupError(message: string): void {
    // HTTP and UDP can both fail for the same reason; explain it only once.
    if (failing) return
    failing = true
    console.error(`\n${banner}\nvTally Hub cannot start:\n\n${message}\n${banner}\n`)

    const packaged = !!(process as NodeJS.Process & { pkg?: unknown }).pkg
    if (packaged && process.stdin.isTTY) {
        console.error('Press Enter to close this window.')
        readline.createInterface({ input: process.stdin }).once('line', () => process.exit(1))
    } else {
        process.exit(1)
    }
}
