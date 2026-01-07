'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function CreateBillPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const formData = new FormData(e.currentTarget)
    const payerName = formData.get('payerName') as string
    const paypalHandle = formData.get('paypalHandle') as string

    if (!payerName || !paypalHandle) {
      setError('Bitte fülle alle Felder aus')
      setLoading(false)
      return
    }

    try {
      const response = await fetch('/api/bills/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          payerName,
          paypalHandle,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Fehler beim Erstellen der Rechnung')
      }

      // Redirect to upload page
      router.push(`/bills/${data.billId}/upload`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ein Fehler ist aufgetreten')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white p-8">
      <div className="max-w-md mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Neue Rechnung teilen
          </h1>
          <p className="text-gray-600">
            Gib deine Daten ein, um loszulegen
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label
                htmlFor="payerName"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Dein Name
              </label>
              <input
                type="text"
                id="payerName"
                name="payerName"
                placeholder="Max Mustermann"
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label
                htmlFor="paypalHandle"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                PayPal Username
              </label>
              <div className="flex items-center">
                <span className="px-3 py-3 bg-gray-100 border border-r-0 border-gray-300 rounded-l-lg text-gray-600">
                  paypal.me/
                </span>
                <input
                  type="text"
                  id="paypalHandle"
                  name="paypalHandle"
                  placeholder="maxmustermann"
                  required
                  pattern="[A-Za-z0-9_-]+"
                  title="Nur Buchstaben, Zahlen, _ und - erlaubt"
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-r-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <p className="mt-2 text-sm text-gray-500">
                Dein PayPal.me Link zum Empfangen von Zahlungen
              </p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
            >
              {loading ? 'Wird erstellt...' : 'Weiter zur Rechnung'}
            </button>
          </form>
        </div>

        <div className="mt-6 text-center">
          <a
            href="/"
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            ← Zurück zur Startseite
          </a>
        </div>

        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 mb-2">
            💡 Tipp: PayPal.me einrichten
          </h3>
          <p className="text-sm text-blue-800">
            Gehe zu{' '}
            <a
              href="https://www.paypal.me"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              paypal.me
            </a>{' '}
            und erstelle deinen persönlichen PayPal.me Link, falls noch nicht vorhanden.
          </p>
        </div>
      </div>
    </div>
  )
}
