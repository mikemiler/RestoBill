'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'

function PaymentRedirectContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [countdown, setCountdown] = useState(5)
  const [copied, setCopied] = useState(false)

  const paypalUrl = searchParams.get('url') || ''
  const amount = searchParams.get('amount') || ''

  useEffect(() => {
    // Validate PayPal URL
    if (!paypalUrl || !paypalUrl.startsWith('https://paypal.me/')) {
      router.push('/')
      return
    }

    // Countdown timer (no auto-redirect - user must click)
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [paypalUrl, router])

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(paypalUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const handleOpenPayPal = () => {
    // Try to open in same window to avoid app opening
    window.location.href = paypalUrl
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 text-center">

        {/* PayPal Logo */}
        <div className="mb-6">
          <div className="h-16 w-16 mx-auto bg-blue-600 dark:bg-blue-500 rounded-full flex items-center justify-center">
            <span className="text-3xl font-bold text-white">P</span>
          </div>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
          PayPal Zahlung
        </h1>

        {amount && (
          <div className="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg p-4 mb-6">
            <p className="text-sm text-blue-100 mb-1">Zu zahlender Betrag:</p>
            <p className="text-3xl font-bold text-white">{amount} €</p>
          </div>
        )}

        {/* Warning Box */}
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6">
          <p className="text-sm text-yellow-800 dark:text-yellow-200 mb-2">
            ⚠️ <strong>Wichtig:</strong>
          </p>
          <p className="text-xs text-yellow-700 dark:text-yellow-300">
            Bitte öffne den Link <strong>im Browser</strong>, nicht in der PayPal App,
            damit der Betrag vorausgefüllt wird.
          </p>
        </div>

        {/* Instructions */}
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 mb-6 text-left">
          <p className="text-sm font-medium text-gray-900 dark:text-white mb-2">
            📱 So geht's am besten:
          </p>
          <ol className="text-xs text-gray-600 dark:text-gray-300 space-y-2">
            <li>1️⃣ Link kopieren (Button unten)</li>
            <li>2️⃣ Neuen Browser-Tab öffnen</li>
            <li>3️⃣ Link in die Adresszeile einfügen</li>
            <li>4️⃣ Zahlung im Browser abschließen</li>
          </ol>
        </div>

        {/* Copy Button */}
        <button
          onClick={handleCopyLink}
          className="w-full bg-gray-600 hover:bg-gray-700 text-white font-medium py-3 px-4 rounded-lg transition-colors mb-3 flex items-center justify-center gap-2"
        >
          {copied ? (
            <>
              <span>✓</span>
              <span>Link kopiert!</span>
            </>
          ) : (
            <>
              <span>📋</span>
              <span>PayPal-Link kopieren</span>
            </>
          )}
        </button>

        {/* Direct Open Button (shows after countdown) */}
        {countdown === 0 ? (
          <button
            onClick={handleOpenPayPal}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors"
          >
            Oder: Direkt zu PayPal (öffnet möglicherweise App)
          </button>
        ) : (
          <button
            disabled
            className="w-full bg-gray-400 text-white font-medium py-3 px-4 rounded-lg cursor-not-allowed"
          >
            Direkt zu PayPal in {countdown}s...
          </button>
        )}

        {/* Link display for manual copy */}
        <div className="mt-6 p-3 bg-gray-100 dark:bg-gray-900 rounded text-xs break-all text-gray-600 dark:text-gray-400">
          {paypalUrl}
        </div>
      </div>
    </div>
  )
}

export default function PaymentRedirectPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 text-center">
          <div className="h-16 w-16 mx-auto border-4 border-blue-200 dark:border-blue-900 border-t-blue-600 dark:border-t-blue-400 rounded-full animate-spin"></div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mt-6">
            Laden...
          </h1>
        </div>
      </div>
    }>
      <PaymentRedirectContent />
    </Suspense>
  )
}
