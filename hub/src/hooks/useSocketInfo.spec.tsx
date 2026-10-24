import React from 'react'
import { act, render, screen } from '@testing-library/react'
import useSocketInfo from './useSocketInfo'
import { socket } from './useSocket'
import DisconnectedClientSideSocket from '../lib/DisconnectedClientSideSocket'

const Indicator = () => <span data-testid="socket-status">{useSocketInfo() ? 'connected' : 'disconnected'}</span>

test('disconnect and reconnection update UI connection state', () => {
  const fake = socket as DisconnectedClientSideSocket
  const view = render(<Indicator />)
  expect(screen.getByTestId('socket-status')).toHaveTextContent('disconnected')
  act(() => { fake.emitServerEvent('connect') })
  expect(screen.getByTestId('socket-status')).toHaveTextContent('connected')
  act(() => { fake.emitServerEvent('disconnect') })
  expect(screen.getByTestId('socket-status')).toHaveTextContent('disconnected')
  act(() => { fake.emitServerEvent('connect') })
  expect(screen.getByTestId('socket-status')).toHaveTextContent('connected')
  view.unmount()
})
