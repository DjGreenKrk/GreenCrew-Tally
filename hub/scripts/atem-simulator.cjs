#!/usr/bin/env node
/*
 * A minimal fake ATEM switcher for testing the Hub without hardware.
 *
 * It speaks enough of the ATEM UDP protocol for atem-connection: the
 * handshake, acknowledgements, keep-alives and an initial state dump with
 * inputs, program, preview and aux buses. Change the state by typing
 * commands on stdin:
 *
 *   pgm <input>         program input of M/E 1
 *   pvw <input>         preview input of M/E 1
 *   aux <bus> <input>   source of an aux bus (bus counts from 1)
 *   state               print the current state
 *
 * Usage: node scripts/atem-simulator.cjs [--port 9910] [--inputs 8] [--auxes 1]
 */
const dgram = require('dgram')
const readline = require('readline')

const args = process.argv.slice(2)
const option = (name, fallback) => {
    const index = args.indexOf(`--${name}`)
    return index >= 0 ? Number(args[index + 1]) : fallback
}
const port = option('port', 9910)
const inputCount = option('inputs', 8)
const auxCount = option('auxes', 1)

const FLAG_ACK_REQUEST = 0x01
const FLAG_HELLO = 0x02
const FLAG_ACK_REPLY = 0x10
const PROTOCOL_V9_6 = 131104

const state = { program: 1, preview: 2, auxes: Array(auxCount).fill(1) }

function command(name, payload) {
    const header = Buffer.alloc(8)
    header.writeUInt16BE(8 + payload.length, 0)
    header.write(name, 4, 4, 'ascii')
    return Buffer.concat([header, payload])
}

function u16Command(name, first, value, size = 4) {
    const payload = Buffer.alloc(size)
    payload.writeUInt8(first, 0)
    payload.writeUInt16BE(value, 2)
    return command(name, payload)
}

function versionCommand() {
    const payload = Buffer.alloc(4)
    payload.writeUInt32BE(PROTOCOL_V9_6, 0)
    return command('_ver', payload)
}

function topologyCommand() {
    const payload = Buffer.alloc(28)
    payload.writeUInt8(1, 0) // mix effects
    payload.writeUInt8(inputCount, 1)
    payload.writeUInt8(1, 2) // downstream keyers
    payload.writeUInt8(auxCount, 3)
    return command('_top', payload)
}

function mixEffectConfigCommand() {
    const payload = Buffer.alloc(4)
    payload.writeUInt8(0, 0) // M/E 1
    payload.writeUInt8(1, 1) // upstream keyers
    return command('_MeC', payload)
}

function inputCommand(id) {
    const payload = Buffer.alloc(36)
    payload.writeUInt16BE(id, 0)
    payload.write(`Camera ${id}`, 2, 20, 'ascii')
    payload.write(`CAM${id}`.slice(0, 4), 22, 4, 'ascii')
    payload.writeUInt16BE(1, 28) // external port: SDI
    payload.writeUInt16BE(1, 30)
    payload.writeUInt8(0, 32) // internal port type: External
    payload.writeUInt8(0x1f, 34) // available everywhere
    payload.writeUInt8(0x03, 35)
    return command('InPr', payload)
}

function transitionSelectionCommand() {
    const payload = Buffer.alloc(8)
    payload.writeUInt8(0, 0) // M/E 1
    payload.writeUInt8(0, 1) // style: mix
    payload.writeUInt8(1, 2) // transition: background
    payload.writeUInt8(1, 4) // next transition: background
    return command('TrSS', payload)
}

const stateCommands = () => [
    u16Command('PrgI', 0, state.program),
    u16Command('PrvI', 0, state.preview, 8),
    ...state.auxes.map((source, bus) => u16Command('AuxS', bus, source)),
]

const initialDump = () => [
    versionCommand(),
    topologyCommand(),
    mixEffectConfigCommand(),
    ...Array.from({ length: inputCount }, (_, i) => inputCommand(i + 1)),
    transitionSelectionCommand(),
    ...stateCommands(),
    command('InCm', Buffer.alloc(4)),
]

const socket = dgram.createSocket('udp4')
// one simulated switcher, one client at a time is enough for tests
let client = null

function packet(flags, sessionId, packetId, payload = Buffer.alloc(0), ackId = 0) {
    const header = Buffer.alloc(12)
    header.writeUInt16BE((flags << 11) | (12 + payload.length), 0)
    header.writeUInt16BE(sessionId, 2)
    header.writeUInt16BE(ackId, 4)
    header.writeUInt16BE(packetId, 10)
    return Buffer.concat([header, payload])
}

function send(buffer) {
    if (client) socket.send(buffer, client.port, client.address)
}

function sendCommands(commands) {
    if (!client || !client.established) return
    client.packetId = (client.packetId + 1) % 0x8000
    send(packet(FLAG_ACK_REQUEST, client.sessionId, client.packetId, Buffer.concat(commands)))
}

socket.on('message', (message, remote) => {
    const flags = message.readUInt8(0) >> 3
    if (flags & FLAG_HELLO) {
        client = { address: remote.address, port: remote.port, sessionId: 0x8001, packetId: 0, established: false }
        console.log(`Client ${remote.address}:${remote.port} connecting`)
        send(packet(FLAG_HELLO, client.sessionId, 0))
        return
    }
    if (!client || remote.address !== client.address || remote.port !== client.port) return
    if ((flags & FLAG_ACK_REPLY) && !client.established) {
        client.established = true
        console.log('Client connected, sending state')
        sendCommands(initialDump())
    }
    if (flags & FLAG_ACK_REQUEST) {
        send(packet(FLAG_ACK_REPLY, client.sessionId, 0, Buffer.alloc(0), message.readUInt16BE(10)))
    }
})

// the client reconnects when it hears nothing for 5 s
setInterval(() => sendCommands([]), 1000)

function printState() {
    console.log(`PGM ${state.program}  PVW ${state.preview}  AUX ${state.auxes.join(', ')}`)
}

readline.createInterface({ input: process.stdin }).on('line', line => {
    const [name, a, b] = line.trim().split(/\s+/)
    if (name === 'pgm' && a) state.program = Number(a)
    else if (name === 'pvw' && a) state.preview = Number(a)
    else if (name === 'aux' && a && b && Number(a) >= 1 && Number(a) <= auxCount) state.auxes[Number(a) - 1] = Number(b)
    else if (name !== 'state') {
        console.log('Commands: pgm <input> | pvw <input> | aux <bus> <input> | state')
        return
    }
    sendCommands(stateCommands())
    printState()
})

socket.bind(port, () => {
    console.log(`Fake ATEM listening on UDP ${port} (${inputCount} inputs, ${auxCount} aux)`)
    printState()
})
