import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import TallyDevice from '../../flasher/TallyDevice'
import Help from './Help'

function deviceNeedingBaseFirmware(baseFirmwareAvailable: boolean) {
  const device = new TallyDevice()
  device.path = 'COM3'
  device.ports = [{ path: 'COM3', vendorId: '1A86', supported: true }]
  device.baseFirmwareAvailable = baseFirmwareAvailable
  return device
}

describe('Help: flashing the base firmware from the Hub', () => {
  test('offers it when the bundle has esptool and a handler is given, and asks before erasing', () => {
    const onFlashBaseFirmware = jest.fn()
    render(<Help tallyDevice={deviceNeedingBaseFirmware(true)} onReload={jest.fn()} onFlashBaseFirmware={onFlashBaseFirmware} />)

    fireEvent.click(screen.getByTestId('flash-base-firmware'))
    expect(screen.getByText('Erase this ESP8266 and flash NodeMCU?')).toBeTruthy()
    expect(onFlashBaseFirmware).not.toHaveBeenCalled()
  })

  test('cancel does not flash anything', () => {
    const onFlashBaseFirmware = jest.fn()
    render(<Help tallyDevice={deviceNeedingBaseFirmware(true)} onReload={jest.fn()} onFlashBaseFirmware={onFlashBaseFirmware} />)

    fireEvent.click(screen.getByTestId('flash-base-firmware'))
    fireEvent.click(screen.getByTestId('flash-base-firmware-cancel'))
    expect(onFlashBaseFirmware).not.toHaveBeenCalled()
  })

  test('confirm triggers the handler', () => {
    const onFlashBaseFirmware = jest.fn()
    render(<Help tallyDevice={deviceNeedingBaseFirmware(true)} onReload={jest.fn()} onFlashBaseFirmware={onFlashBaseFirmware} />)

    fireEvent.click(screen.getByTestId('flash-base-firmware'))
    fireEvent.click(screen.getByTestId('flash-base-firmware-confirm'))
    expect(onFlashBaseFirmware).toHaveBeenCalledTimes(1)
  })

  test('stays hidden when the Windows bundle does not have esptool', () => {
    render(<Help tallyDevice={deviceNeedingBaseFirmware(false)} onReload={jest.fn()} onFlashBaseFirmware={jest.fn()} />)
    expect(screen.queryByTestId('flash-base-firmware')).toBeNull()
  })

  test('stays hidden without a handler, even if the bundle has esptool', () => {
    render(<Help tallyDevice={deviceNeedingBaseFirmware(true)} onReload={jest.fn()} />)
    expect(screen.queryByTestId('flash-base-firmware')).toBeNull()
  })
})
