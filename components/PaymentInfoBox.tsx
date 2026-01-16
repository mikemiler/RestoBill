'use client'

import { useState } from 'react'
import { formatEUR, generatePayPalUrl } from '@/lib/utils'

interface PaymentInfoBoxProps {
  total: number
  payerName: string
  paypalHandle: string | null
  hasSelection: boolean
}

export default function PaymentInfoBox({
  total,
  payerName,
  paypalHandle,
  hasSelection
}: PaymentInfoBoxProps) {
  const [linkCopied, setLinkCopied] = useState(false)

  // Don't show if no items selected or total is 0
  if (!hasSelection || total <= 0) {
    return null
  }

  const paypalUrl = paypalHandle ? generatePayPalUrl(paypalHandle, total) : null

  const handleCopyLink = async () => {
    if (!paypalUrl) return

    try {
      await navigator.clipboard.writeText(paypalUrl)
      setLinkCopied(true)
      setTimeout(() => setLinkCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy link:', error)
    }
  }

  const handleOpenPayPal = () => {
    if (!paypalUrl) return
    window.open(paypalUrl, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-300 dark:border-blue-700 rounded-lg p-4 sm:p-5">
      <div className="flex items-start gap-2 mb-3">
        <span className="text-blue-600 dark:text-blue-400 text-xl">ℹ️</span>
        <div className="flex-1">
          <h3 className="font-semibold text-blue-900 dark:text-blue-100 text-base sm:text-lg mb-1">
            Deine Auswahl wird automatisch gespeichert!
          </h3>
          <p className="text-sm text-blue-800 dark:text-blue-300">
            Du kannst jederzeit zurückkehren und Änderungen vornehmen.
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 mb-4">
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
          Nächster Schritt: Bezahle an {payerName}
        </p>
        <p className="text-3xl font-bold text-green-600 dark:text-green-400">
          {formatEUR(total)}
        </p>
      </div>

      {/* PayPal Option */}
      {paypalUrl && (
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xl">💳</span>
            <h4 className="font-semibold text-gray-900 dark:text-gray-100">Per PayPal</h4>
          </div>

          <div className="space-y-2">
            <button
              onClick={handleOpenPayPal}
              className="w-full bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors text-sm sm:text-base flex items-center justify-center gap-2"
            >
              Jetzt mit PayPal bezahlen
            </button>

            <button
              onClick={handleCopyLink}
              className="w-full bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-medium py-2 px-4 rounded-lg transition-colors text-sm flex items-center justify-center gap-2"
            >
              {linkCopied ? (
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
          </div>
        </div>
      )}

      {/* Cash Option */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xl">💵</span>
          <h4 className="font-semibold text-gray-900 dark:text-gray-100">Oder bar</h4>
        </div>
        <p className="text-sm text-gray-700 dark:text-gray-300">
          Gib {payerName} das Geld beim nächsten Treffen.
        </p>
      </div>

      {/* Info Note */}
      <div className="mt-4 pt-4 border-t border-blue-200 dark:border-blue-800">
        <p className="text-xs text-blue-700 dark:text-blue-400 text-center">
          💡 Du kannst mehrfach bezahlen, falls du weitere Positionen auswählst
        </p>
      </div>
    </div>
  )
}
