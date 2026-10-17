import ServerEventEmitter, { EventHandlersDataMap } from './ServerEventEmitter'
import { ServerSideSocket } from './SocketEvents'

/* Takes care that an event on the server is passed through
 * a socket to the browser.
 * 
 * The heavy lifting it does is making sure events are registered
 * and unregistered accordingly. This should prevent dangling event
 * listeners as much as possible.
 */
export class SocketAwareEvent<EventName extends keyof EventHandlersDataMap> {
    eventEmitter: ServerEventEmitter
    socket: ServerSideSocket
    eventName: EventName
    eventListener: EventHandlersDataMap[EventName]
    isRegistered: boolean
    private disconnectListener: () => void
    
    constructor(eventEmitter: ServerEventEmitter, eventName: EventName, socket: ServerSideSocket, fnc: (socket: ServerSideSocket, ...args: Parameters<EventHandlersDataMap[EventName]>) => void) {
        this.eventEmitter = eventEmitter
        this.socket = socket
        this.eventName = eventName

        this.eventListener = (...args: Parameters<EventHandlersDataMap[EventName]>) : void => {
            fnc(socket, ...args)
        }
        this.isRegistered = false
        this.disconnectListener = () => this.unregister()

    }

    register() {
        if (!this.isRegistered) {
            console.debug(`Connecting event ${this.eventName} to socket ${this.socket.id}`)
            this.eventEmitter.on(this.eventName, this.eventListener)
            this.socket.on("disconnect", this.disconnectListener)
            this.isRegistered = true
        }   
    }

    unregister() {
        if (this.isRegistered) {
            console.debug(`Detatching event ${this.eventName} from socket ${this.socket.id}`)
        }
        this.eventEmitter.off(this.eventName, this.eventListener)
        this.socket.off("disconnect", this.disconnectListener)
        this.isRegistered = false
    }
}
