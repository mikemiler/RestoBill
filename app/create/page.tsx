'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

export default function CreateBillPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [payerName, setPayerName] = useState('')
  const [paypalHandle, setPaypalHandle] = useState('')

  // Load from localStorage on mount
  useEffect(() => {
    const savedPayerName = localStorage.getItem('payerName')
    const savedPaypalHandle = localStorage.getItem('paypalHandle')

    if (savedPayerName) setPayerName(savedPayerName)
    if (savedPaypalHandle) setPaypalHandle(savedPaypalHandle)
  }, [])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (!payerName.trim() || !paypalHandle.trim()) {
      setError('Bitte fülle alle Felder aus')
      setLoading(false)
      return
    }

    // Validate PayPal handle format
    const handleRegex = /^[A-Za-z0-9_-]+$/
    if (!handleRegex.test(paypalHandle)) {
      setError('PayPal Username darf nur Buchstaben, Zahlen, _ und - enthalten')
      setLoading(false)
      return
    }

    // Save to localStorage
    localStorage.setItem('payerName', payerName.trim())
    localStorage.setItem('paypalHandle', paypalHandle.trim())

    try {
      const response = await fetch('/api/bills/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          payerName: payerName.trim(),
          paypalHandle: paypalHandle.trim(),
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

  function handleTestPayPalLink() {
    if (paypalHandle.trim()) {
      window.open(`https://paypal.me/${paypalHandle.trim()}`, '_blank', 'noopener,noreferrer')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800 p-8">
      <div className="max-w-md mx-auto">
        <div className="text-center mb-8">
          <div className="mb-4 flex justify-center">
            <Image
              src="/logo.png"
              alt="Kill The Bill Logo"
              width={80}
              height={80}
              className="app-logo"
            />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-50 mb-2">
            Neue Rechnung teilen
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Gib deine Daten ein, um loszulegen
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg dark:shadow-gray-900/30 p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label
                htmlFor="payerName"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                Dein Name
              </label>
              <input
                type="text"
                id="payerName"
                name="payerName"
                value={payerName}
                onChange={(e) => setPayerName(e.target.value)}
                placeholder="Max Mustermann"
                required
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-400"
              />
            </div>

            <div>
              <label
                htmlFor="paypalHandle"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                PayPal Username
              </label>
              <div className="flex items-center">
                <span className="px-3 py-3 bg-gray-100 dark:bg-gray-600 border border-r-0 border-gray-300 dark:border-gray-500 rounded-l-lg text-gray-600 dark:text-gray-200">
                  paypal.me/
                </span>
                <input
                  type="text"
                  id="paypalHandle"
                  name="paypalHandle"
                  value={paypalHandle}
                  onChange={(e) => setPaypalHandle(e.target.value)}
                  placeholder="maxmustermann"
                  required
                  pattern="[A-Za-z0-9_-]+"
                  title="Nur Buchstaben, Zahlen, _ und - erlaubt"
                  className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-r-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-400"
                />
              </div>
              {paypalHandle.trim() && (
                <div className="mt-3 space-y-2">
                  <div className="flex items-center justify-between bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
                    <div>
                      <p className="text-xs text-green-700 dark:text-green-400 font-medium mb-1">
                        Zahlungen gehen an:
                      </p>
                      <p className="text-sm font-semibold text-green-800 dark:text-green-300">
                        paypal.me/{paypalHandle.trim()}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleTestPayPalLink}
                      className="ml-2 px-3 py-1.5 bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600 text-white text-xs font-medium rounded-lg transition-colors"
                    >
                      Testen
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Klicke auf "Testen", um zu überprüfen, ob der PayPal-Account existiert
                  </p>
                </div>
              )}
            </div>

            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 dark:bg-blue-500 dark:hover:bg-blue-600 dark:disabled:bg-gray-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
            >
              {loading ? 'Wird erstellt...' : 'Weiter zur Rechnung'}
            </button>
          </form>
        </div>

        <div className="mt-6 text-center">
          <a
            href="/"
            className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
          >
            ← Zurück zur Startseite
          </a>
        </div>

        <div className="mt-8 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 dark:text-blue-300 mb-2">
            💡 Tipp: PayPal.me einrichten
          </h3>
          <p className="text-sm text-blue-800 dark:text-blue-300">
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
