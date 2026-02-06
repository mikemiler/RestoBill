'use client'

/**
 * DonationBanner Component
 *
 * STATUS: Currently disabled - waiting for Paddle approval for usage-based model
 *
 * This component was originally designed for donation-based payments but Paddle
 * does not approve donation models. Will be re-enabled once we implement a
 * usage-based pricing model (e.g., pay per bill or monthly subscription).
 *
 * Keep this component and all Paddle integration code for future use.
 *
 * TODO: Re-enable once usage-based pricing model is approved by Paddle
 */

import { useState } from 'react'
import { useTranslation } from '@/lib/i18n'

// Declare Paddle global type
declare global {
  interface Window {
    Paddle?: {
      Checkout: {
        open: (options: { transactionId: string }) => void
      }
    }
  }
}

export default function DonationBanner() {
  const { t } = useTranslation()
  const [customAmount, setCustomAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleDonation(amount: number) {
    setLoading(true)
    setError('')

    try {
      // Create Paddle transaction
      const response = await fetch('/api/paddle/create-transaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, source: 'werhattewas' }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || t.donation.errorCreating)
      }

      // Open Paddle Checkout
      if (window.Paddle) {
        window.Paddle.Checkout.open({
          transactionId: data.transactionId,
        })
      } else {
        throw new Error(t.donation.errorPaddle)
      }
    } catch (err) {
      console.error('Donation error:', err)
      setError(err instanceof Error ? err.message : t.common.genericError)
    } finally {
      setLoading(false)
    }
  }

  function handleCustomAmount() {
    const amount = parseFloat(customAmount)
    if (isNaN(amount) || amount < 1) {
      setError(t.donation.minAmount)
      return
    }
    if (amount > 500) {
      setError(t.donation.maxAmount)
      return
    }
    handleDonation(amount)
  }

  return (
    <div className="donation-banner">
      <div className="donation-content">
        <h3 className="donation-heading">{t.donation.heading}</h3>
        <p className="donation-text">
          {t.donation.text}
        </p>

        {/* Quick amount buttons */}
        <div className="flex flex-wrap gap-2 mb-3">
          <button
            onClick={() => handleDonation(2)}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-500 text-white rounded-lg transition-colors"
          >
            €2
          </button>
          <button
            onClick={() => handleDonation(5)}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-500 text-white rounded-lg transition-colors"
          >
            €5
          </button>
          <button
            onClick={() => handleDonation(7)}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-500 text-white rounded-lg transition-colors"
          >
            €7
          </button>
          <button
            onClick={() => handleDonation(10)}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-500 text-white rounded-lg transition-colors"
          >
            €10
          </button>
        </div>

        {/* Custom amount input */}
        <div className="mb-3">
          <label htmlFor="customAmount" className="block text-sm text-gray-300 mb-2">
            {t.donation.customAmountLabel}
          </label>
          <input
            id="customAmount"
            type="number"
            min="1"
            max="500"
            step="1"
            value={customAmount}
            onChange={(e) => setCustomAmount(e.target.value)}
            placeholder={t.donation.customAmountPlaceholder}
            disabled={loading}
            className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 mb-2"
          />
          <button
            onClick={handleCustomAmount}
            disabled={loading || !customAmount}
            className="w-full py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-500 text-white rounded-lg transition-colors"
          >
            {loading ? t.donation.loadingButton : t.donation.supportButton}
          </button>
        </div>

        {/* Error message */}
        {error && (
          <div className="text-red-400 text-sm mb-3">{error}</div>
        )}

        {/* Payment methods info */}
        <p className="text-xs text-gray-400">
          {t.donation.paymentMethods}
        </p>
      </div>
    </div>
  )
}
