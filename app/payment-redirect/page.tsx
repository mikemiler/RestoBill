'use client'

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'

export default function PaymentRedirectPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [countdown, setCountdown] = useState(3)

  useEffect(() => {
    const paypalUrl = searchParams.get('url')
    const amount = searchParams.get('amount')

    // Validate PayPal URL
    if (!paypalUrl || !paypalUrl.startsWith('https://paypal.me/')) {
      router.push('/')
      return
    }

    // Countdown timer
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          // Redirect to PayPal using window.location (stays in browser on mobile)
          window.location.href = paypalUrl
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [searchParams, router])

  const amount = searchParams.get('amount')

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 text-center">
        <div className="mb-6">
          {/* CSS Spinner */}
          <div className="h-16 w-16 mx-auto border-4 border-blue-200 dark:border-blue-900 border-t-blue-600 dark:border-t-blue-400 rounded-full animate-spin"></div>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
          Weiterleitung zu PayPal...
        </h1>

        {amount && (
          <p className="text-lg text-gray-700 dark:text-gray-300 mb-6">
            Betrag: <span className="font-bold text-blue-600 dark:text-blue-400">{amount} €</span>
          </p>
        )}

        <div className="bg-blue-50 dark:bg-gray-700 rounded-lg p-4 mb-6">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Du wirst in <span className="font-bold text-blue-600 dark:text-blue-400">{countdown}</span> Sekunden zu PayPal weitergeleitet.
          </p>
        </div>

        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <p className="text-xs text-yellow-800 dark:text-yellow-200">
            💡 <strong>Tipp:</strong> Für beste Ergebnisse sollte sich die PayPal-Seite im Browser öffnen, nicht in der App.
          </p>
        </div>

        <button
          onClick={() => {
            const paypalUrl = searchParams.get('url')
            if (paypalUrl) {
              window.location.href = paypalUrl
            }
          }}
          className="mt-6 w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors"
        >
          Jetzt zu PayPal
        </button>
      </div>
    </div>
  )
}
