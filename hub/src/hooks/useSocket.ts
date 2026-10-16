import { useEffect } from 'react'
import io from 'socket.io-client'
import { EventEmitter } from '../lib/DisconnectedClientSideSocket'
import { ClientSentEvents, ClientSideSocket } from '../lib/SocketEvents'
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
  socket.on("connect_timeout", onDisconnection)
  // Socket.IO emits "disconnect", never "disconnected". Successful
  // reconnect must set Hub state back to connected, not disconnected.
  socket.on("disconnect", onDisconnection)
  socket.on("reconnect", onConnection)
  socket.on("reconnecting", onDisconnection)
  socket.on("reconnect_error", onDisconnection)
  socket.on("reconnect_failed", onDisconnection)
}

/** @deprecated */
const useSocket = function<EventName extends keyof ClientSentEvents>(eventName: EventName, cb: (...args: any[]) => void) {
  useEffect(() => {
    //@ts-ignore
    socket.on(eventName, cb)

    return function useSocketCleanup() {
      // @ts-ignore
      socket.off(eventName, cb)
    }
  }, [eventName, cb])

  return socket
}

export {useSocket, socketEventEmitter, socket}
  