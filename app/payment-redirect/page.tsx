'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'

function PaymentRedirectContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [amountCopied, setAmountCopied] = useState(false)

  const paypalUrl = searchParams.get('url') || ''
  const amount = searchParams.get('amount') || ''
  const payerName = searchParams.get('payer') || 'Rechnungsersteller'

  useEffect(() => {
    // Validate PayPal URL
    if (!paypalUrl || !paypalUrl.startsWith('https://paypal.me/')) {
      router.push('/')
      return
    }
  }, [paypalUrl, router])

  const handleCopyAmount = async () => {
    try {
      await navigator.clipboard.writeText(amount)
      setAmountCopied(true)
    } catch (err) {
      console.error('Failed to copy:', err)
      // Fallback: enable button anyway
      setAmountCopied(true)
    }
  }

  const handleOpenPayPal = () => {
    window.open(paypalUrl, '_blank', 'noopener,noreferrer')
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

        {/* Payment Recipient Info - Prominent */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-300 dark:border-blue-700 rounded-lg p-4 mb-6">
          <p className="text-sm text-blue-800 dark:text-blue-200 mb-2 font-semibold">
            💳 Zahlung an:
          </p>
          <p className="text-xl font-bold text-blue-900 dark:text-blue-100">
            {payerName}
          </p>
          <p className="text-xs text-blue-700 dark:text-blue-300 mt-2">
            Diese Person hat die Rechnung erstellt und empfängt deine Zahlung.
          </p>
        </div>

        {/* Warning Box */}
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6">
          <p className="text-sm text-yellow-800 dark:text-yellow-200 mb-2">
            ⚠️ <strong>Hinweis:</strong>
          </p>
          <p className="text-xs text-yellow-700 dark:text-yellow-300">
            Der Betrag wird möglicherweise nicht automatisch übernommen.
            Kopiere daher zuerst den Betrag, dann kannst du zu PayPal weiter.
          </p>
        </div>

        {/* Amount Display */}
        {amount && (
          <div className="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg p-6 mb-6">
            <p className="text-sm text-blue-100 mb-2">Zu zahlender Betrag:</p>
            <p className="text-4xl font-bold text-white mb-4">{amount} €</p>

            {!amountCopied ? (
              <button
                onClick={handleCopyAmount}
                className="w-full bg-white hover:bg-blue-50 text-blue-600 font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <span>📋</span>
                <span>Betrag kopieren</span>
              </button>
            ) : (
              <div className="bg-white/20 text-white font-medium py-3 px-4 rounded-lg flex items-center justify-center gap-2">
                <span>✓</span>
                <span>Betrag kopiert!</span>
              </div>
            )}
          </div>
        )}

        {/* Instructions when amount is copied */}
        {amountCopied && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 mb-6">
            <p className="text-sm text-green-800 dark:text-green-200">
              ✓ Perfekt! Wenn der Betrag nicht vorausgefüllt ist, kannst du ihn einfach einfügen.
            </p>
          </div>
        )}

        {/* PayPal Button */}
        {amountCopied ? (
          <button
            onClick={handleOpenPayPal}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-4 px-6 rounded-lg transition-colors text-lg"
          >
            Weiter zu PayPal →
          </button>
        ) : (
          <button
            disabled
            className="w-full bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-500 font-medium py-4 px-6 rounded-lg cursor-not-allowed text-lg"
          >
            Zuerst Betrag kopieren
          </button>
        )}

        {/* Amount display for reference */}
        <div className="mt-6 text-xs text-gray-500 dark:text-gray-400">
          Betrag in Zwischenablage: <span className="font-mono font-bold">{amountCopied ? amount : '—'}</span>
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
