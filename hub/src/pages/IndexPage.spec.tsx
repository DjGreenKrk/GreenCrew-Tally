import React from 'react'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { UdpTally } from '../domain/Tally'

let mockTallies: UdpTally[] | null = []
jest.mock('../hooks/useSocket', () => ({ socket: { emit: jest.fn(), on: jest.fn(), off: jest.fn() } }))
jest.mock('../hooks/useTallies', () => () => mockTallies)
jest.mock('../hooks/useSocketInfo', () => () => true)
jest.mock('../hooks/useMixerInfo', () => () => true)
jest.mock('../hooks/useChannels', () => () => [])
jest.mock('../hooks/useProgramPreview', () => () => [[], [], []])
jest.mock('../components/layout/Layout', () => ({ children }) => <div>{children}</div>)

import IndexPage from './IndexPage'
import { fireEvent } from '@testing-library/react'

const renderPage = () => render(<MemoryRouter><IndexPage /></MemoryRouter>, { container: document.body.appendChild(document.createElement('div')) })

test('shows a loading indicator until the tallies arrive', () => {
    mockTallies = null
    const { getByTestId, queryByTestId } = renderPage()
    expect(getByTestId('tallies-loading')).toBeTruthy()
    expect(queryByTestId('tallies-empty')).toBeNull()
})

test('explains how tallies appear when there are none', () => {
    mockTallies = []
    const { getByTestId } = renderPage()
    expect(getByTestId('tallies-empty').textContent).toContain('ESP8266')
    expect(getByTestId('tally-create')).toBeTruthy()
})

test('says that filters hide the tallies', () => {
    mockTallies = [new UdpTally('Hidden')]
    const { getByTestId, queryByTestId } = renderPage()
    expect(queryByTestId('tallies-filtered-empty')).toBeNull()
    fireEvent.click(getByTestId('toggle-disconnected'))
    expect(getByTestId('tallies-filtered-empty').textContent).toContain('Show Disconnected')
    expect(queryByTestId('tallies-empty')).toBeNull()
})
