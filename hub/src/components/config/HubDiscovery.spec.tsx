import React from 'react'
import { render } from '@testing-library/react'
import '@testing-library/jest-dom'
import { HubDiscoveryView } from './HubDiscovery'
import { HubDiscoveryState } from '../../lib/HubDiscoveryState'

const active: HubDiscoveryState = { status: 'active', hubId: '1a2b3c4d', serviceName: 'GC Tally Hub 1a2b3c4d._gctally._udp.local', port: 7411 }
const renderView = (state: HubDiscoveryState) => render(<HubDiscoveryView state={state} />, {
  container: document.body.appendChild(document.createElement('div')),
})

describe('Hub discovery', () => {
  test('shows that v2 tallies find the Hub and its id', () => {
    const { getByTestId, queryByTestId } = renderView(active)
    expect(getByTestId('hub-discovery-active')).toBeInTheDocument()
    expect(getByTestId('hub-discovery-id')).toHaveTextContent('1a2b3c4d')
    expect(queryByTestId('hub-discovery-error')).toBeNull()
  })

  test('explains that tallies need hub.ip when the announcement fails', () => {
    const { getByTestId } = renderView({ ...active, status: 'error', error: 'bind EADDRINUSE 0.0.0.0:5353' })
    expect(getByTestId('hub-discovery-error')).toHaveTextContent('bind EADDRINUSE 0.0.0.0:5353')
    expect(getByTestId('hub-discovery-error')).toHaveTextContent('hub.ip')
  })

  test('says when discovery is turned off', () => {
    const { getByTestId } = renderView({ ...active, status: 'off', serviceName: '' })
    expect(getByTestId('hub-discovery-off')).toHaveTextContent('GC_TALLY_MDNS=off')
  })
})
