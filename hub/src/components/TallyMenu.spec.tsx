import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { UdpTally } from '../domain/Tally'

const mockEmit = jest.fn()
jest.mock('../hooks/useSocket', () => ({ socket: { emit: (...args) => mockEmit(...args), on: jest.fn(), off: jest.fn() } }))
jest.mock('./TallySettings', () => () => null)

import TallyMenu from './TallyMenu'

const renderMenu = () => {
    const tally = new UdpTally('Lampka-1')
    render(<MemoryRouter><TallyMenu tally={tally} /></MemoryRouter>, { container: document.body.appendChild(document.createElement('div')) })
    fireEvent.click(screen.getByTitle('Lampka-1 Menu'))
    fireEvent.click(screen.getByText('Remove'))
}

beforeEach(() => mockEmit.mockClear())

test('asks before removing and names the tally', () => {
    renderMenu()
    expect(screen.getByText('Remove tally Lampka-1?')).toBeTruthy()
    expect(mockEmit).not.toHaveBeenCalled()
})

test('cancel does not remove the tally', () => {
    renderMenu()
    fireEvent.click(screen.getByTestId('tally-remove-cancel'))
    expect(mockEmit).not.toHaveBeenCalled()
})

test('confirm removes the tally', () => {
    renderMenu()
    fireEvent.click(screen.getByTestId('tally-remove-confirm'))
    expect(mockEmit).toHaveBeenCalledWith('tally.remove', 'Lampka-1', 'udp')
})
