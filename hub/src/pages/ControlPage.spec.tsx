import React from 'react'
import { fireEvent, render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import ManualConfiguration from '../mixer/manual/ManualConfiguration'

const mockEmit = jest.fn()
let mockMixer = 'manual'
const mockManual = new ManualConfiguration().setChannelNames(['Actor', 'Singer'])
jest.mock('../hooks/useSocket', () => ({ socket: { emit: (...args) => mockEmit(...args), on: jest.fn(), off: jest.fn() } }))
jest.mock('../hooks/useConfiguration', () => ({
    useMixerNameConfiguration: () => mockMixer,
    useManualConfiguration: () => mockManual,
}))
jest.mock('../hooks/useChannels', () => () => [{ id: '1', name: 'Actor' }, { id: '2', name: 'Singer' }])
jest.mock('../hooks/useProgramPreview', () => () => [['1'], ['2'], []])
jest.mock('../hooks/useTallies', () => () => [{ name: 'Tally01', type: 'udp', channelIds: ['1'] }])
jest.mock('../components/layout/Layout', () => ({ children }) => <div>{children}</div>)

import ControlPage, { channelState } from './ControlPage'

const renderPage = () => render(<MemoryRouter><ControlPage /></MemoryRouter>, { container: document.body.appendChild(document.createElement('div')) })

beforeEach(() => { mockEmit.mockClear(); mockMixer = 'manual' })

test('shows each channel with its state and patched tallies', () => {
    const { getByTestId, getByText } = renderPage()
    expect(getByTestId('control-channel-1').getAttribute('data-state')).toBe('program')
    expect(getByTestId('control-channel-2').getAttribute('data-state')).toBe('preview')
    expect(getByText('Tally01')).toBeTruthy()
    expect(getByTestId('control-1-program').getAttribute('aria-pressed')).toBe('true')
})

test('buttons set the channel state, flash highlights the patched tallies', () => {
    const { getByTestId, getAllByText } = renderPage()
    fireEvent.click(getByTestId('control-2-aux'))
    expect(mockEmit).toHaveBeenCalledWith('manual.set', '2', 'aux')
    fireEvent.click(getByTestId('control-all-off'))
    expect(mockEmit).toHaveBeenCalledWith('manual.allOff')
    fireEvent.click(getAllByText('Flash')[0])
    expect(mockEmit).toHaveBeenCalledWith('tally.highlight', 'Tally01', 'udp')
})

test('offers to switch to manual control when a mixer is selected', () => {
    mockMixer = 'atem'
    const { getByTestId } = renderPage()
    fireEvent.click(getByTestId('control-activate'))
    expect(mockEmit).toHaveBeenCalledWith('config.change.manual', mockManual.toJson(), 'manual')
})

test('program beats aux beats preview', () => {
    expect(channelState('1', ['1'], ['1'], ['1'])).toBe('program')
    expect(channelState('1', [], ['1'], ['1'])).toBe('aux')
    expect(channelState('1', null, null, [])).toBe('off')
})

