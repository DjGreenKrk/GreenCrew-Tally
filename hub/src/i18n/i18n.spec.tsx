import React from 'react'
import { fireEvent, render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import pl from './pl'
import en from './en'
import { I18nProvider, translate, useTranslation, LANGUAGE_STORAGE_KEY } from './index'
import LanguageSwitch from '../components/layout/LanguageSwitch'

const placeholders = (text: string) => (text.match(/\{\w+\}/g) || []).sort()

describe('dictionaries', () => {
  test('have the same keys', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(pl).sort())
  })

  test('have no empty values', () => {
    for (const [name, dictionary] of Object.entries({ pl, en })) {
      for (const [key, value] of Object.entries(dictionary)) {
        expect([name, key, value.trim() === '']).toEqual([name, key, false])
      }
    }
  })

  test('use the same {placeholders} in both languages', () => {
    for (const key of Object.keys(pl)) {
      expect([key, placeholders(en[key])]).toEqual([key, placeholders(pl[key])])
    }
  })

  test('Polish texts keep their diacritics (no ASCII-stripped words)', () => {
    const stripped = /\b(wylacz|polacz|blad(?![a-ząćęłńóśźż])|jasnosc|usun(?![a-ząćęłńóśźż])|zrodl|wlacz|ustawien(?![a-ząćęłńóśźż])|polaczen|urzadz|zapisz zmiany|swiec|zolt|rozlacz|sciezk|pamie[^c]|hasl)/i
    const needsDiacritics = /\b(wyl|wlacz|polacz|rozlacz|blad(?![a-ząćęłńóśźż])|jasnosc|usun(?![a-ząćęłńóśźż])|ustawien(?![a-ząćęłńóśźż])|swiec|zolto|rozowy|przegladark|kanal|jezyk|wiecej|podswietl|zrodlo|sciezka|cwiek|miedzy|ktory)/i
    for (const [key, value] of Object.entries(pl)) {
      expect([key, stripped.test(value)]).toEqual([key, false])
      expect([key, needsDiacritics.test(value)]).toEqual([key, false])
    }
    const joined = Object.values(pl).join(' ')
    for (const letter of 'ąćęłńóśźż') {
      expect(joined).toContain(letter)
    }
  })

  test('Polish uses the agreed wording', () => {
    expect(pl['control.allOff']).toBe('Wszystko wyłącz')
    expect(pl['nav.tallies']).toBe('Lampki')
    expect(pl['nav.config']).toBe('Konfiguracja')
    expect(pl['common.save']).toBe('Zapisz')
  })
})

describe('translate', () => {
  test('replaces {placeholders}', () => {
    expect(translate('en', 'tallyMenu.title', { name: 'Cam1' })).toBe('Cam1 Menu')
    expect(translate('pl', 'tallyMenu.title', { name: 'Cam1' })).toBe('Menu: Cam1')
  })
})

const Sample = () => {
  const { t, language } = useTranslation()
  return <div>
    <span data-testid="text">{t('control.allOff')}</span>
    <span data-testid="lang">{language}</span>
    <LanguageSwitch />
  </div>
}

describe('language switch', () => {
  beforeEach(() => {
    window.localStorage.removeItem(LANGUAGE_STORAGE_KEY)
    document.documentElement.lang = ''
  })

  test('is Polish by default', () => {
    const { getByTestId } = render(<MemoryRouter><I18nProvider><Sample /></I18nProvider></MemoryRouter>)
    expect(getByTestId('text').textContent).toBe('Wszystko wyłącz')
    expect(document.documentElement.lang).toBe('pl')
  })

  test('changes the rendered text, is remembered and sets the document language', () => {
    const first = render(<MemoryRouter><I18nProvider><Sample /></I18nProvider></MemoryRouter>)
    fireEvent.click(first.getByTestId('language-en'))
    expect(first.getByTestId('text').textContent).toBe('All off')
    expect(document.documentElement.lang).toBe('en')
    expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('en')
    first.unmount()

    // a new page load starts with the remembered language
    const second = render(<MemoryRouter><I18nProvider><Sample /></I18nProvider></MemoryRouter>)
    expect(second.getByTestId('text').textContent).toBe('All off')
    fireEvent.click(second.getByTestId('language-pl'))
    expect(second.getByTestId('text').textContent).toBe('Wszystko wyłącz')
  })

  test('falls back to Polish when the stored value is unknown', () => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, 'de')
    const { getByTestId } = render(<I18nProvider><Sample /></I18nProvider>)
    expect(getByTestId('lang').textContent).toBe('pl')
  })
})
