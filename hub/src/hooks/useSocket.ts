import { useEffect } from 'react'
import { io } from 'socket.io-client'
import { EventEmitter } from '../lib/DisconnectedClientSideSocket'
import { ClientSideSocket, ServerSentEvents } from '../lib/SocketEvents'
import DisconnectedClientSideSocket from '../lib/DisconnectedClientSideSocket'

// @TODO: remove socket event emitter. It does not have any purpose apart from announcing connection and disconnection
const socketEventEmitter = new EventEmitter()

const isTestEnvironment = process.env.JEST_WORKER_ID !== undefined

const socket: ClientSideSocket = isTestEnvironment ? new DisconnectedClientSideSocket() : io()

const onConnection = function() {
  socketEventEmitter.emit("connected")
}
const onDisconnection = function() {
  socketEventEmitter.emit("disconnected")
}
if (typeof window !== 'undefined') {
  // on client only
  socket.on("connect", onConnection)
  socket.on("connect_error", onDisconnection)
  // Socket.IO 4 emits "connect" again after every successful reconnect;
  // the reconnect_* events only exist on the Manager (socket.io).
  socket.on("disconnect", onDisconnection)
}

/** @deprecated */
const useSocket = function<EventName extends keyof ServerSentEvents>(eventName: EventName, cb: ServerSentEvents[EventName]) {
  useEffect(() => {
    socket.on(eventName, cb)

    return function useSocketCleanup() {
      socket.off(eventName, cb)
    }
  }, [eventName, cb])

  return socket
}

export {useSocket, socketEventEmitter, socket}
  