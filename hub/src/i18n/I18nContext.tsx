import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import en from './en'
import pl from './pl'

export type Language = 'pl' | 'en'
export type TranslationKey = keyof typeof pl
export type TranslationParams = Record<string, string | number>
export type TranslateFunction = (key: TranslationKey, params?: TranslationParams) => string

export const LANGUAGES: Language[] = ['pl', 'en']
export const DEFAULT_LANGUAGE: Language = 'pl'
export const LANGUAGE_STORAGE_KEY = 'gc-tally.language'

const dictionaries: Record<Language, Record<string, string>> = { pl, en }

export function readStoredLanguage(): Language {
  try {
    const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY)
    if (stored === 'pl' || stored === 'en') return stored
  } catch {
    // storage not available: fall back to the default
  }
  return DEFAULT_LANGUAGE
}

function storeLanguage(language: Language) {
  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language)
  } catch {
    // storage not available: the choice only lasts for this page load
  }
}

export function translate(language: Language, key: TranslationKey, params?: TranslationParams): string {
  const text = dictionaries[language][key] ?? dictionaries[DEFAULT_LANGUAGE][key] ?? key
  if (!params) return text
  return text.replace(/\{(\w+)\}/g, (match, name) => (name in params ? String(params[name]) : match))
}

type I18nContextValue = {
  t: TranslateFunction
  language: Language
  setLanguage: (language: Language) => void
}

const I18nContext = createContext<I18nContextValue | null>(null)

type I18nProviderProps = {
  initialLanguage?: Language
  children?: React.ReactNode
}

export function I18nProvider({ initialLanguage, children }: I18nProviderProps) {
  const [language, setLanguageState] = useState<Language>(() => initialLanguage ?? readStoredLanguage())

  useEffect(() => {
    document.documentElement.lang = language
  }, [language])

  const setLanguage = useCallback((newLanguage: Language) => {
    storeLanguage(newLanguage)
    setLanguageState(newLanguage)
  }, [])

  const value = useMemo<I18nContextValue>(() => ({
    language,
    setLanguage,
    t: (key, params) => translate(language, key, params),
  }), [language, setLanguage])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useTranslation(): I18nContextValue {
  const context = useContext(I18nContext)
  if (context) return context
  // no provider (e.g. an isolated component test): use the stored language
  const language = readStoredLanguage()
  return {
    language,
    setLanguage: storeLanguage,
    t: (key, params) => translate(language, key, params),
  }
}

// translate with the stored language, for code that runs outside of a component
export const tStored: TranslateFunction = (key, params) => translate(readStoredLanguage(), key, params)
