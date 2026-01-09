'use client'

import { useState, useEffect } from 'react'
import { formatEUR } from '@/lib/utils'
import Link from 'next/link'
import ReviewFlow from './ReviewFlow'
import { markSelectionAsReviewed } from '@/lib/selectionStorage'

interface CashConfirmedContentProps {
  selectionId: string
  shareToken: string
  billId: string
  payerName: string
  restaurantName?: string | null
  googlePlaceId?: string | null
  totalAmount: number
}

export default function CashConfirmedContent({
  selectionId,
  shareToken,
  billId,
  payerName,
  restaurantName,
  googlePlaceId,
  totalAmount,
}: CashConfirmedContentProps) {
  const [showReviewFlow, setShowReviewFlow] = useState(false)

  useEffect(() => {
    // Show review flow after a short delay (so user sees success first)
    const timer = setTimeout(() => {
      setShowReviewFlow(true)
    }, 2000)

    return () => clearTimeout(timer)
  }, [])

  const handleReviewComplete = () => {
    markSelectionAsReviewed(selectionId)
    setShowReviewFlow(false)
  }

  const handleReviewSkip = () => {
    markSelectionAsReviewed(selectionId)
    setShowReviewFlow(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-xl dark:shadow-gray-900/30 p-8">
        {/* Success Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
            <svg
              className="w-12 h-12 text-green-600 dark:text-green-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
        </div>

        {/* Success Message */}
        <h1 className="text-2xl font-bold text-center text-gray-900 dark:text-gray-100 mb-4">
          Auswahl gespeichert!
        </h1>

        <div className="space-y-4 mb-6">
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
            <p className="text-sm text-green-800 dark:text-green-300 text-center">
              Deine Auswahl wurde erfolgreich gespeichert.
            </p>
          </div>

          {/* Payment Information */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <div className="flex justify-between items-center mb-3">
              <span className="text-gray-600 dark:text-gray-400">Zahlungsmethode:</span>
              <span className="font-semibold text-gray-900 dark:text-gray-100">💵 Barzahlung</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-400">Zu zahlen:</span>
              <span className="text-2xl font-bold text-green-600 dark:text-green-400">
                {formatEUR(totalAmount)}
              </span>
            </div>
          </div>

          {/* Instructions */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <h2 className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-2">
              📋 Nächste Schritte:
            </h2>
            <ul className="text-sm text-blue-800 dark:text-blue-300 space-y-1 list-disc list-inside">
              <li>Bezahle {formatEUR(totalAmount)} bar an {payerName}</li>
              <li>Der Ersteller wird über deine Auswahl informiert</li>
              <li>Du erhältst keine weitere Zahlungsaufforderung</li>
            </ul>
          </div>
        </div>

        {/* Back Button */}
        <Link
          href={`/split/${shareToken}`}
          className="block w-full text-center bg-gray-600 hover:bg-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
        >
          Zurück zur Übersicht
        </Link>
      </div>

      {/* Review Flow Modal */}
      {showReviewFlow && (
        <ReviewFlow
          billId={billId}
          shareToken={shareToken}
          selectionId={selectionId}
          restaurantName={restaurantName || 'das Restaurant'}
          googlePlaceId={googlePlaceId}
          onComplete={handleReviewComplete}
          onSkip={handleReviewSkip}
        />
      )}
    </div>
  )
}
