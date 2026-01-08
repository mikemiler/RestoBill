'use client'

import { useTheme } from './ThemeProvider'

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  const cycleTheme = () => {
    if (theme === 'light') setTheme('dark')
    else if (theme === 'dark') setTheme('system')
    else setTheme('light')
  }

  const getIcon = () => {
    if (theme === 'dark') return '🌙'
    if (theme === 'light') return '☀️'
    return '🌓'
  }

  const getLabel = () => {
    if (theme === 'dark') return 'Dark'
    if (theme === 'light') return 'Light'
    return 'Auto'
  }

  return (
    <button
      onClick={cycleTheme}
      className="fixed top-4 right-4 z-50 flex items-center space-x-2 px-3 py-2
                 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600
                 rounded-lg shadow-lg dark:shadow-gray-900/30
                 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
      aria-label="Theme wechseln"
    >
      <span className="text-xl">{getIcon()}</span>
      <span className="hidden sm:inline text-sm font-medium text-gray-700 dark:text-gray-300">
        {getLabel()}
      </span>
    </button>
  )
}
