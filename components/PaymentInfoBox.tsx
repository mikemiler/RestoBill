'use client'

import { useState } from 'react'
import { formatEUR, generatePayPalUrlWithoutAmount, formatAmountForPayPal } from '@/lib/utils'

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
  const [amountCopied, setAmountCopied] = useState(false)

  // Don't show if no items selected or total is 0
  if (!hasSelection || total <= 0) {
    return null
  }

  const paypalUrl = paypalHandle ? generatePayPalUrlWithoutAmount(paypalHandle) : null
  const amountForPayPal = formatAmountForPayPal(total)

  const handleCopyAmount = async () => {
    try {
      await navigator.clipboard.writeText(amountForPayPal)
      setAmountCopied(true)
      setTimeout(() => setAmountCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy amount:', error)
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

      {/* Amount Display with Copy Button */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 mb-4">
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
          Zu bezahlen an {payerName}
        </p>
        <div className="flex items-center justify-between gap-3">
          <p className="text-3xl font-bold text-green-600 dark:text-green-400">
            {formatEUR(total)}
          </p>
          <button
            onClick={handleCopyAmount}
            className={`${
              amountCopied
                ? 'bg-green-600 dark:bg-green-500'
                : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600'
            } text-gray-900 dark:text-gray-100 font-semibold py-2 px-4 rounded-lg transition-colors text-sm flex items-center gap-2 whitespace-nowrap`}
          >
            {amountCopied ? (
              <>
                <span>✓</span>
                <span>Kopiert!</span>
              </>
            ) : (
              <>
                <span>📋</span>
                <span>Betrag kopieren</span>
              </>
            )}
          </button>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
          Kopiere den Betrag, dann kannst du ihn direkt in PayPal einfügen
        </p>
      </div>

      {/* PayPal Option */}
      {paypalUrl && (
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">💳</span>
            <h4 className="font-semibold text-gray-900 dark:text-gray-100">So bezahlst du mit PayPal</h4>
          </div>

          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 mb-3 space-y-2 text-sm">
            <div className="flex gap-2">
              <span className="text-blue-600 dark:text-blue-400 font-bold">1.</span>
              <p className="text-gray-700 dark:text-gray-300">
                Klicke auf <span className="font-semibold">"Betrag kopieren"</span> (oben)
              </p>
            </div>
            <div className="flex gap-2">
              <span className="text-blue-600 dark:text-blue-400 font-bold">2.</span>
              <p className="text-gray-700 dark:text-gray-300">
                Klicke auf <span className="font-semibold">"PayPal öffnen"</span> (unten)
              </p>
            </div>
            <div className="flex gap-2">
              <span className="text-blue-600 dark:text-blue-400 font-bold">3.</span>
              <p className="text-gray-700 dark:text-gray-300">
                Füge den Betrag in PayPal ein und sende die Zahlung
              </p>
            </div>
          </div>

          <button
            onClick={handleOpenPayPal}
            className="w-full bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors text-sm sm:text-base flex items-center justify-center gap-2"
          >
            <span>💳</span>
            <span>PayPal öffnen</span>
          </button>
        </div>
      )}

      {/* Cash Option */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xl">💵</span>
          <h4 className="font-semibold text-gray-900 dark:text-gray-100">Oder bar bezahlen</h4>
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
