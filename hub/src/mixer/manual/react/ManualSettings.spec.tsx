import React from 'react'
import { fireEvent, render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import ManualConfiguration from '../ManualConfiguration'

const mockEmit = jest.fn()
const mockManual = new ManualConfiguration().setChannelNames(['Actor', 'Singer'])
jest.mock('../../../hooks/useSocket', () => ({ socket: { emit: (...args) => mockEmit(...args), on: jest.fn(), off: jest.fn() } }))
jest.mock('../../../hooks/useConfiguration', () => ({ useManualConfiguration: () => mockManual }))

import ManualSettings from './ManualSettings'

test('saves the channel names and the exclusive Program switch', () => {
    const { getByTestId, getByText } = render(<MemoryRouter><ManualSettings /></MemoryRouter>, { container: document.body.appendChild(document.createElement('div')) })
    fireEvent.change(getByTestId('manual-channel-names'), { target: { value: 'Actor\nSinger\n\nBand' } })
    fireEvent.click(getByTestId('manual-exclusive'))
    fireEvent.click(getByText('Save'))
    expect(mockEmit).toHaveBeenCalledWith('config.change.manual', { channelNames: ['Actor', 'Singer', 'Band'], exclusiveProgram: true }, 'manual')
})
