import React from 'react'
import { fireEvent, render } from '@testing-library/react'
import CompanionConfiguration from '../CompanionConfiguration'

const mockEmit = jest.fn()
const mockCompanion = new CompanionConfiguration()
jest.mock('../../../hooks/useSocket', () => ({ socket: { emit: (...args) => mockEmit(...args), on: jest.fn(), off: jest.fn() } }))
jest.mock('../../../hooks/useConfiguration', () => ({ useCompanionConfiguration: () => mockCompanion }))
jest.mock('./CompanionLanAccess', () => () => null)

import CompanionSettings from './CompanionSettings'

test('shows 8 channels by default and saves a longer list', () => {
    const { getByTestId, getByText } = render(<CompanionSettings />)
    expect((getByTestId('companion-channel-names') as HTMLTextAreaElement).value.split('\n')).toHaveLength(8)
    const names = Array.from({ length: 10 }, (_, i) => `Cam ${i + 1}`)
    fireEvent.change(getByTestId('companion-channel-names'), { target: { value: names.join('\n') } })
    fireEvent.click(getByText('Save'))
    expect(mockEmit).toHaveBeenCalledWith('config.change.companion', { channelNames: names }, 'companion')
})

test('cannot save without channels', () => {
    const { getByTestId, getByText } = render(<CompanionSettings />)
    fireEvent.change(getByTestId('companion-channel-names'), { target: { value: '\n \n' } })
    expect(getByText('Save').closest('button')).toBeDisabled()
})
