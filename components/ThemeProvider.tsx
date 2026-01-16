'use client'

import { useEffect } from 'react'

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Always force dark mode
    document.documentElement.classList.add('dark')
  }, [])

  return <>{children}</>
}
