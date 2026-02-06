'use client'

import { useTranslation, LANGUAGES } from '@/lib/i18n'

export default function Footer() {
  const { language, t, setLanguage } = useTranslation()

  return (
    <footer className="w-full py-6 px-4 mb-28 bg-gray-100 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800">
      <div className="max-w-6xl mx-auto flex flex-col items-center gap-4 text-sm text-gray-600 dark:text-gray-300">
        <div className="flex flex-wrap justify-center gap-4">
          <a
            href="https://werhattewas.de/nutzungsbedingungen/"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            {t.footer.terms}
          </a>
          <a
            href="https://werhattewas.de/rueckerstattungsrichtlinie/"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            {t.footer.refund}
          </a>
          <a
            href="https://werhattewas.de/datenschutz/"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            {t.footer.privacy}
          </a>
          <a
            href="https://werhattewas.de/impressum/"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            {t.footer.imprint}
          </a>
        </div>

        {/* Language Switch */}
        <div className="flex flex-wrap justify-center gap-1.5">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              onClick={() => setLanguage(lang.code)}
              className={`px-2.5 py-1 rounded text-xs transition-colors ${
                language === lang.code
                  ? 'bg-blue-600 text-white font-semibold'
                  : 'hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400'
              }`}
            >
              {lang.flag} {lang.label}
            </button>
          ))}
        </div>

        <div className="text-center">
          <p>© {new Date().getFullYear()} WerHatteWas</p>
        </div>
      </div>
    </footer>
  )
}
