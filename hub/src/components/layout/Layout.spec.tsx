import React from 'react'
import { act, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { socket } from '../../hooks/useSocket'
import DisconnectedClientSideSocket from '../../lib/DisconnectedClientSideSocket'

let mockPhone = true
jest.mock('@mui/material/useMediaQuery', () => ({ __esModule: true, default: () => mockPhone }))
jest.mock('../../hooks/useVmixProject', () => ({ __esModule: true, default: () => ({ projectName: null }) }))
jest.mock('../../buildInfo', () => ({ buildInfo: { version: '9.9.9', builtAt: '' } }))

import Layout from './Layout'

const renderAt = (path: string) => render(
  <MemoryRouter initialEntries={[path]}><Layout testId="x">content</Layout></MemoryRouter>,
  { container: document.body.appendChild(document.createElement('div')) },
)
const fake = socket as DisconnectedClientSideSocket

afterEach(() => { act(() => { fake.emitServerEvent('connect') }) })

test('phone: bottom navigation with four items, current route selected', () => {
  mockPhone = true
  renderAt('/control')
  const nav = screen.getByTestId('bottom-navigation')
  expect(nav.querySelectorAll('a').length).toBe(4)
  expect(screen.getByRole('link', { name: 'Control' })).toHaveClass('Mui-selected')
  expect(screen.getByRole('link', { name: 'Tallies' })).not.toHaveClass('Mui-selected')
})

test('phone: tally pages highlight Tallies, about highlights nothing', () => {
  mockPhone = true
  const first = renderAt('/tally/abc/log')
  expect(screen.getByRole('link', { name: 'Tallies' })).toHaveClass('Mui-selected')
  first.unmount()
  renderAt('/about')
  expect(document.querySelectorAll('[data-testid="bottom-navigation"] .Mui-selected').length).toBe(0)
})

test('desktop: top bar buttons and no bottom navigation', () => {
  mockPhone = false
  renderAt('/config')
  expect(screen.queryByTestId('bottom-navigation')).toBeNull()
  expect(screen.getByRole('link', { name: 'Configuration' })).toHaveAttribute('aria-current', 'page')
})

test('shows the offline banner only while the Hub is disconnected', () => {
  mockPhone = false
  renderAt('/')
  expect(screen.getByTestId('hub-offline-banner')).toHaveTextContent('No connection to the Hub')
  act(() => { fake.emitServerEvent('connect') })
  expect(screen.queryByTestId('hub-offline-banner')).toBeNull()
  act(() => { fake.emitServerEvent('disconnect') })
  expect(screen.getByTestId('hub-offline-banner')).toBeTruthy()
})
