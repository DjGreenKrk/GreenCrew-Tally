import React from 'react'
import { fireEvent, render, within } from '@testing-library/react'
import '@testing-library/jest-dom'
import { DeviceActions, DevicesView } from './Devices'
import { DeviceListState, DeviceView } from '../../tally/DeviceList'

const unpaired: DeviceView = {
  id: 'a1b2c3', name: 'CAM1', firmware: '2.0.0', address: '10.0.0.5', online: true, via: ['udp'],
  status: 'unpaired', crewPassword: 'none', duplicateName: false,
}
const state = (devices: DeviceView[], extra: Partial<DeviceListState> = {}): DeviceListState =>
  ({ hubId: '1a2b3c4d', devices, crewPasswordSet: false, canChangeCrewPassword: true, ...extra })

function setup(listState: DeviceListState) {
  const actions: DeviceActions = { identify: jest.fn(), pair: jest.fn(), unpair: jest.fn(), forget: jest.fn(), setCrewPassword: jest.fn() }
  const view = render(<DevicesView state={listState} actions={actions} />, {
    container: document.body.appendChild(document.createElement('div')),
  })
  return { actions, ...view }
}

describe('v2 tallies', () => {
  test('pairing makes the tally blink first and needs a confirmation', () => {
    const { actions, getByTestId, queryByTestId } = setup(state([unpaired]))
    fireEvent.click(getByTestId('device-pair'))
    expect(actions.identify).toHaveBeenCalledWith('a1b2c3')
    expect(actions.pair).not.toHaveBeenCalled()
    expect(getByTestId('device-confirm')).toHaveTextContent('CAM1')
    fireEvent.click(getByTestId('device-confirm-pair'))
    expect(actions.pair).toHaveBeenCalledWith('a1b2c3')
    expect(queryByTestId('device-confirm')).toBeNull()
  })

  test('paired tallies can be unpaired, or forgotten when away', () => {
    const { actions, getByTestId } = setup(state([
      { ...unpaired, status: 'paired', crewPassword: 'synced' },
      { ...unpaired, id: 'd4e5f6', name: 'CAM2', status: 'paired', online: false, via: [] },
    ]))
    fireEvent.click(within(getByTestId('device-a1b2c3')).getByTestId('device-unpair'))
    expect(actions.unpair).toHaveBeenCalledWith('a1b2c3')
    fireEvent.click(within(getByTestId('device-d4e5f6')).getByTestId('device-forget'))
    expect(actions.forget).toHaveBeenCalledWith('d4e5f6')
  })

  test('shows duplicate names, other Hubs and refusals', () => {
    const { getByTestId } = setup(state([
      { ...unpaired, duplicateName: true, lastError: 'paired-elsewhere' },
      { ...unpaired, id: 'd4e5f6', status: 'pairedElsewhere', pairedHub: '99999999' },
    ]))
    expect(within(getByTestId('device-a1b2c3')).getByTestId('device-duplicate')).toBeInTheDocument()
    expect(within(getByTestId('device-a1b2c3')).getByTestId('device-error')).toBeInTheDocument()
    expect(within(getByTestId('device-d4e5f6')).getByTestId('device-status')).toHaveTextContent('99999999')
    expect(within(getByTestId('device-d4e5f6')).queryByTestId('device-pair')).toBeNull()
  })

  test('sets a valid crew password only', () => {
    const { actions, getByTestId } = setup(state([]))
    expect(getByTestId('devices-none')).toBeInTheDocument()
    const input = getByTestId('crew-password-input')
    fireEvent.change(input, { target: { value: 'short' } })
    expect(getByTestId('crew-password-save')).toBeDisabled()
    fireEvent.change(input, { target: { value: 'crew pass 1!' } })
    fireEvent.click(getByTestId('crew-password-save'))
    expect(actions.setCrewPassword).toHaveBeenCalledWith('crew pass 1!')
  })

  test('the crew password is changed on the Hub computer only', () => {
    const { actions, getByTestId, queryByTestId } = setup(state([], { crewPasswordSet: true, canChangeCrewPassword: false }))
    expect(queryByTestId('crew-password-input')).toBeNull()
    expect(queryByTestId('crew-password-clear')).toBeNull()
    expect(getByTestId('crew-password-state')).toBeInTheDocument()
    expect(actions.setCrewPassword).not.toHaveBeenCalled()
  })
})
