'use client'

import { createContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { Language, Translations, LANGUAGES, DEFAULT_LANGUAGE } from './types'
import { en } from './translations/en'

interface LanguageContextType {
  language: Language
  t: Translations
  setLanguage: (lang: Language) => void
}

export const LanguageContext = createContext<LanguageContextType>({
  language: DEFAULT_LANGUAGE,
  t: en,
  setLanguage: () => {},
})

async function loadTranslations(lang: Language): Promise<Translations> {
  switch (lang) {
    case 'de': return (await import('./translations/de')).de
    case 'en': return (await import('./translations/en')).en
    case 'es': return (await import('./translations/es')).es
    case 'fr': return (await import('./translations/fr')).fr
    case 'it': return (await import('./translations/it')).it
    case 'pt': return (await import('./translations/pt')).pt
    default: return en
  }
}

function detectLanguage(): Language {
  if (typeof window === 'undefined') return DEFAULT_LANGUAGE

  // 1. URL parameter ?lang=xx
  const params = new URLSearchParams(window.location.search)
  const langParam = params.get('lang')
  if (langParam && LANGUAGES.some(l => l.code === langParam)) {
    localStorage.setItem('preferredLanguage', langParam)
    return langParam as Language
  }

  // 2. localStorage
  const stored = localStorage.getItem('preferredLanguage')
  if (stored && LANGUAGES.some(l => l.code === stored)) {
    return stored as Language
  }

  // 3. Browser language
  const browserLang = navigator.language.substring(0, 2)
  const match = LANGUAGES.find(l => l.code === browserLang)
  if (match) return match.code

  // 4. Default
  return DEFAULT_LANGUAGE
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(DEFAULT_LANGUAGE)
  const [translations, setTranslations] = useState<Translations>(en)

  useEffect(() => {
    const detected = detectLanguage()
    setLanguageState(detected)
    document.documentElement.lang = detected
    if (detected !== DEFAULT_LANGUAGE) {
      loadTranslations(detected).then(setTranslations)
    }
  }, [])

  const setLanguage = useCallback(async (lang: Language) => {
    setLanguageState(lang)
    localStorage.setItem('preferredLanguage', lang)
    document.documentElement.lang = lang
    const t = await loadTranslations(lang)
    setTranslations(t)
  }, [])

  return (
    <LanguageContext.Provider value={{ language, t: translations, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  )
}
