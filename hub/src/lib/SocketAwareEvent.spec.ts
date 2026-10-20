import { EventEmitter } from 'events'
import ServerEventEmitter from './ServerEventEmitter'
import { SocketAwareEvent } from './SocketAwareEvent'
import type { ServerSideSocket } from './SocketEvents'

test('repeated subscribe/unsubscribe does not accumulate socket disconnect handlers', () => {
  const emitter = new ServerEventEmitter()
  const socket = new EventEmitter() as EventEmitter & ServerSideSocket
  socket.id = 'client'
  let forwarded = 0
  const bridge = new SocketAwareEvent(emitter, 'mixer.connected', socket, () => forwarded++)
  for (let i = 0; i < 5; i++) {
    bridge.register()
    bridge.register()
    expect(socket.listenerCount('disconnect')).toBe(1)
    emitter.emit('mixer.connected')
    expect(forwarded).toBe(i + 1)
    bridge.unregister()
    expect(socket.listenerCount('disconnect')).toBe(0)
    expect(emitter.listenerCount('mixer.connected')).toBe(0)
  }
  bridge.register()
  socket.emit('disconnect')
  expect(socket.listenerCount('disconnect')).toBe(0)
  expect(emitter.listenerCount('mixer.connected')).toBe(0)
  emitter.emit('mixer.connected')
  expect(forwarded).toBe(5)
})
