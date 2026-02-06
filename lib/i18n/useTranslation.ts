'use client'

import { useContext } from 'react'
import { LanguageContext } from './LanguageProvider'

export function useTranslation() {
  return useContext(LanguageContext)
}
