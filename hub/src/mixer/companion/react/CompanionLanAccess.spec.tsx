import React from 'react'
import { fireEvent, render } from '@testing-library/react'
import '@testing-library/jest-dom'
import { CompanionLanAccessView } from './CompanionLanAccess'
import { CompanionLanState } from '../../../lib/CompanionLanState'

const base: CompanionLanState = { source: 'none', tooShort: false, canManage: true, hubAddresses: ['192.168.1.10'], httpPort: 3000 }
const renderView = (state: CompanionLanState, onGenerate = jest.fn(), onDisable = jest.fn()) =>
    render(<CompanionLanAccessView state={state} onGenerate={onGenerate} onDisable={onDisable} />, {
        container: document.body.appendChild(document.createElement('div')),
    })

describe('Companion LAN access settings', () => {
    test('without a token it explains localhost use and offers to allow LAN access', () => {
        const onGenerate = jest.fn()
        const { getByTestId, getByText } = renderView(base, onGenerate)
        expect(getByTestId('companion-lan-off')).toBeInTheDocument()
        expect(getByTestId('companion-lan-ips')).toHaveTextContent('192.168.1.10')
        fireEvent.click(getByText('Allow LAN access (generate token)'))
        expect(onGenerate).toHaveBeenCalledTimes(1)
    })

    test('on the Hub computer the token can be revealed and LAN access turned off', () => {
        const onDisable = jest.fn()
        const { getByTestId, getByText } = renderView({ ...base, source: 'hub', token: 'f'.repeat(48) }, jest.fn(), onDisable)
        expect(getByTestId('companion-lan-token')).not.toHaveValue('f'.repeat(48))
        fireEvent.click(getByText('Show'))
        expect(getByTestId('companion-lan-token')).toHaveValue('f'.repeat(48))
        fireEvent.click(getByTestId('companion-lan-disable'))
        expect(onDisable).toHaveBeenCalledTimes(1)
    })

    test('other computers only learn that a token exists', () => {
        const { getByTestId, queryByTestId } = renderView({ ...base, source: 'hub', canManage: false })
        expect(getByTestId('companion-lan-hidden')).toBeInTheDocument()
        expect(queryByTestId('companion-lan-token')).toBeNull()
        expect(queryByTestId('companion-lan-generate')).toBeNull()
    })

    test('a token from the environment is shown but not managed', () => {
        const { getByText, queryByTestId } = renderView({ ...base, source: 'env', token: 'e'.repeat(20), canManage: false })
        expect(getByText(/VTALLY_COMPANION_TOKEN/)).toBeInTheDocument()
        expect(queryByTestId('companion-lan-generate')).toBeNull()
    })
})
