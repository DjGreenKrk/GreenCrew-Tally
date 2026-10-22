import React from 'react'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

jest.mock('../components/layout/Layout', () => ({ children }) => <div>{children}</div>)
jest.mock('../buildInfo', () => ({ buildInfo: { version: '9.9.9', builtAt: '' } }))

import AboutPage from './AboutPage'

const renderPage = () => render(<MemoryRouter><AboutPage /></MemoryRouter>, { container: document.body.appendChild(document.createElement('div')) })

test('shows version, author, licence, repository and credits', () => {
    const { getByText, container } = renderPage()
    expect(getByText('9.9.9')).toBeTruthy()
    expect(getByText('Development build')).toBeTruthy()
    expect(getByText('Julian Szymański')).toBeTruthy()
    expect(getByText('MIT').getAttribute('href')).toBe('https://github.com/DjGreenKrk/GreenCrew-Tally/blob/main/LICENSE')
    expect(container.querySelector('a[href="https://github.com/DjGreenKrk/GreenCrew-Tally"]')).toBeTruthy()
    expect(getByText('vTally / wifi-tally').getAttribute('href')).toBe('https://github.com/wifi-tally/wifi-tally')
    expect(getByText('Christian Zenker and contributors')).toBeTruthy()
    expect(getByText('Part of GreenCrew Tools')).toBeTruthy()
})
