import React from 'react'
import { fireEvent, render } from '@testing-library/react'
import { Color, createCustomColorScheme } from '../../tally/ColorScheme'
import CustomColorEditor from './CustomColorEditor'

test('shows the current colors as hex inputs', () => {
  const value = createCustomColorScheme({ program: new Color(255, 0, 0), aux: new Color(0, 128, 255) })
  const { getByTestId } = render(<CustomColorEditor testId="custom-colors" value={value} onChange={jest.fn()} />)

  expect(getByTestId('custom-colors-program')).toHaveValue('#ff0000')
  expect(getByTestId('custom-colors-aux')).toHaveValue('#0080ff')
})

test('reports the changed channel and color', () => {
  const value = createCustomColorScheme()
  const onChange = jest.fn()
  const { getByTestId } = render(<CustomColorEditor testId="custom-colors" value={value} onChange={onChange} />)

  fireEvent.change(getByTestId('custom-colors-highlight'), { target: { value: '#112233' } })

  expect(onChange).toHaveBeenCalledWith('highlight', new Color(0x11, 0x22, 0x33))
})

test('disables every input when disabled', () => {
  const value = createCustomColorScheme()
  const { getByTestId } = render(<CustomColorEditor testId="custom-colors" value={value} onChange={jest.fn()} disabled />)

  expect(getByTestId('custom-colors-idle')).toBeDisabled()
})
