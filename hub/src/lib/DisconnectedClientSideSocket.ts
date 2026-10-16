// Browser-safe emitter for the disconnected/test socket; do not bundle Node's 'events'.
class EventEmitter {
    private listeners = new Map<string | symbol, Array<(...args: any[]) => void>>()

    on(event: string | symbol, listener: (...args: any[]) => void) {
        const listeners = this.listeners.get(event) || []
        listeners.push(listener)
        this.listeners.set(event, listeners)
        return this
    }

    off(event: string | symbol, listener: (...args: any[]) => void) {
        const listeners = this.listeners.get(event)
        if (listeners) {
            const index = listeners.indexOf(listener)
            if (index !== -1) listeners.splice(index, 1)
            if (listeners.length === 0) this.listeners.delete(event)
        }
        return this
    }

    emit(event: string | symbol, ...args: any[]) {
        const listeners = this.listeners.get(event)
        if (!listeners || listeners.length === 0) return false
        for (const listener of [...listeners]) listener(...args)
        return true
    }

    removeAllListeners() {
        this.listeners.clear()
        return this
    }
}
import { ClientSideSocket } from "./SocketEvents";

// used for tests only
class DisconnectedClientSideSocket implements ClientSideSocket {
    connected: boolean
    clientEventEmitter: EventEmitter
    serverEventEmitter: EventEmitter

    constructor() {
        this.connected = false
        this.clientEventEmitter = new EventEmitter()
        this.serverEventEmitter = new EventEmitter()
    }

    on(event: string|symbol, listener: (...args: any[]) => void) {
        this.clientEventEmitter.on(event, listener)
        return this
    }
    off(event: string|symbol, listener: (...args: any[]) => void) {
        this.clientEventEmitter.off(event, listener)
        return this
    }
    emit(event: string|symbol, ...args: any[]) {
        this.serverEventEmitter.emit(event, ...args)
        return this
    }
    
    emitServerEvent(event: string|symbol, ...args: any[]) {
        return this.clientEventEmitter.emit(event, ...args)
    }
    
    onServerEvent(event: string|symbol, listener: (...args: any[]) => void) {
        this.serverEventEmitter.on(event, listener)
    }

    cleanUp() {
        this.serverEventEmitter.removeAllListeners()
    }
}
export default DisconnectedClientSideSocket
