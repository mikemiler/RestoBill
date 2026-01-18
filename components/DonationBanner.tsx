'use client'

import { useState } from 'react'

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
        throw new Error(data.error || 'Fehler beim Erstellen der Zahlung')
      }

      // Open Paddle Checkout
      if (window.Paddle) {
        window.Paddle.Checkout.open({
          transactionId: data.transactionId,
        })
      } else {
        throw new Error('Paddle ist nicht geladen')
      }
    } catch (err) {
      console.error('Donation error:', err)
      setError(err instanceof Error ? err.message : 'Ein Fehler ist aufgetreten')
    } finally {
      setLoading(false)
    }
  }

  function handleCustomAmount() {
    const amount = parseFloat(customAmount)
    if (isNaN(amount) || amount < 1) {
      setError('Bitte gib einen Betrag von mindestens €1 ein')
      return
    }
    if (amount > 500) {
      setError('Maximalbetrag ist €500')
      return
    }
    handleDonation(amount)
  }

  return (
    <div className="donation-banner">
      <div className="donation-content">
        <h3 className="donation-heading">Unterstütze WerHatteWas</h3>
        <p className="donation-text">
          💝 Diese App ist gratis, aber um meine KI-Kosten und Server-Kosten zu
          decken, würde ich mich über einen Beitrag zur Unterstützung freuen –
          auch wenn dieser nur 1 € ist.
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
            Eigener Betrag:
          </label>
          <input
            id="customAmount"
            type="number"
            min="1"
            max="500"
            step="1"
            value={customAmount}
            onChange={(e) => setCustomAmount(e.target.value)}
            placeholder="z.B. 3"
            disabled={loading}
            className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 mb-2"
          />
          <button
            onClick={handleCustomAmount}
            disabled={loading || !customAmount}
            className="w-full py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-500 text-white rounded-lg transition-colors"
          >
            {loading ? 'Lädt...' : 'Unterstützen'}
          </button>
        </div>

        {/* Error message */}
        {error && (
          <div className="text-red-400 text-sm mb-3">{error}</div>
        )}

        {/* Payment methods info */}
        <p className="text-xs text-gray-400">
          💳 Zahlung via PayPal, Google Pay, Apple Pay oder Kreditkarte
        </p>
      </div>
    </div>
  )
}
