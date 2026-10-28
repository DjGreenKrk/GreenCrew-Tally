import React from 'react'
import { fireEvent, render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import VmixConfiguration from '../VmixConfiguration'

const mockEmit = jest.fn()
const mockVmix = new VmixConfiguration()
let mockMixerName = 'vmix'
jest.mock('../../../hooks/useSocket', () => ({ socket: { emit: (...args) => mockEmit(...args), on: jest.fn(), off: jest.fn() } }))
jest.mock('../../../hooks/useConfiguration', () => ({
    useVmixConfiguration: () => mockVmix,
    useMixerNameConfiguration: () => mockMixerName,
}))

import VmixSettings from './VmixSettings'

afterEach(() => {
    mockEmit.mockClear()
    mockMixerName = 'vmix'
})

test('a Reconnect button asks the Hub to restart the vMix connection, without saving settings', () => {
    const { getByTestId } = render(<MemoryRouter><VmixSettings /></MemoryRouter>, { container: document.body.appendChild(document.createElement('div')) })

    fireEvent.click(getByTestId('vmix-reconnect'))

    expect(mockEmit).toHaveBeenCalledWith('mixer.reconnect')
    expect(mockEmit).not.toHaveBeenCalledWith('config.change.vmix', expect.anything(), expect.anything())
})

test('the Reconnect button is hidden while vMix is not the active mixer', () => {
    mockMixerName = 'obs'
    const { queryByTestId } = render(<MemoryRouter><VmixSettings /></MemoryRouter>, { container: document.body.appendChild(document.createElement('div')) })

    expect(queryByTestId('vmix-reconnect')).toBeNull()
})
