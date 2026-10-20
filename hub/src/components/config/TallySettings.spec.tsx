import React from 'react'
import { render } from '@testing-library/react'
import { DefaultTallyConfiguration } from '../../tally/TallyConfiguration'

const mockConfiguration = new DefaultTallyConfiguration()
mockConfiguration.setOperatorLightBrightness(80)
mockConfiguration.setStageLightBrightness(40)
jest.mock('../../hooks/useConfiguration', () => ({ useDefaultTallyConfiguration: () => mockConfiguration }))
jest.mock('../../hooks/useSocket', () => ({ socket: { emit: jest.fn(), on: jest.fn(), off: jest.fn() } }))

import TallySettings from './TallySettings'

test('the brightness sliders show the loaded tally defaults', () => {
    const { container } = render(<TallySettings />, { container: document.body.appendChild(document.createElement('div')) })
    const values = [...container.querySelectorAll('[role=slider]')].map(slider => slider.getAttribute('aria-valuenow'))
    expect(values).toEqual(['80', '40'])
})
