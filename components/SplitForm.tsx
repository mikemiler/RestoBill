'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatEUR } from '@/lib/utils'

interface BillItem {
  id: string
  name: string
  quantity: number
  pricePerUnit: number
  totalPrice: number
}

interface SplitFormProps {
  billId: string
  shareToken: string
  payerName: string
  paypalHandle: string
  items: BillItem[]
}

export default function SplitForm({
  billId,
  shareToken,
  payerName,
  paypalHandle,
  items,
}: SplitFormProps) {
  const router = useRouter()
  const [friendName, setFriendName] = useState('')
  const [selectedItems, setSelectedItems] = useState<Record<string, number>>({})
  const [customQuantityMode, setCustomQuantityMode] = useState<Record<string, boolean>>({})
  const [customQuantityInput, setCustomQuantityInput] = useState<Record<string, string>>({})
  const [tipPercent, setTipPercent] = useState(0)
  const [customTip, setCustomTip] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Calculate subtotal from selected items
  const subtotal = items.reduce((sum, item) => {
    const quantity = selectedItems[item.id] || 0
    return sum + item.pricePerUnit * item.quantity * quantity
  }, 0)

  // Calculate tip
  const tipAmount =
    tipPercent === -1
      ? parseFloat(customTip) || 0
      : (subtotal * tipPercent) / 100

  const total = subtotal + tipAmount

  function handleItemQuantityChange(itemId: string, quantity: number) {
    setSelectedItems((prev) => {
      if (quantity === 0) {
        const newItems = { ...prev }
        delete newItems[itemId]
        return newItems
      }
      return { ...prev, [itemId]: quantity }
    })
    // Disable custom mode when selecting a preset quantity
    if (customQuantityMode[itemId]) {
      setCustomQuantityMode((prev) => {
        const newMode = { ...prev }
        delete newMode[itemId]
        return newMode
      })
      setCustomQuantityInput((prev) => {
        const newInput = { ...prev }
        delete newInput[itemId]
        return newInput
      })
    }
  }

  function handleCustomQuantityToggle(itemId: string) {
    setCustomQuantityMode((prev) => ({ ...prev, [itemId]: true }))
    setCustomQuantityInput((prev) => ({ ...prev, [itemId]: '' }))
  }

  function handleCustomQuantityInputChange(itemId: string, value: string) {
    setCustomQuantityInput((prev) => ({ ...prev, [itemId]: value }))
    const numValue = parseFloat(value)
    if (!isNaN(numValue) && numValue > 0) {
      setSelectedItems((prev) => ({ ...prev, [itemId]: numValue }))
    } else if (value === '') {
      setSelectedItems((prev) => {
        const newItems = { ...prev }
        delete newItems[itemId]
        return newItems
      })
    }
  }

  function handleTipChange(percent: number) {
    setTipPercent(percent)
    if (percent !== -1) {
      setCustomTip('')
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!friendName.trim()) {
      setError('Bitte gib deinen Namen ein')
      return
    }

    if (Object.keys(selectedItems).length === 0) {
      setError('Bitte wähle mindestens eine Position aus')
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/selections/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          billId,
          shareToken,
          friendName: friendName.trim(),
          itemQuantities: selectedItems,
          tipAmount,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Fehler beim Erstellen der Auswahl')
      }

      // Validate PayPal URL before redirect
      if (!data.paypalUrl || !data.paypalUrl.startsWith('https://paypal.me/')) {
        throw new Error('Ungültige PayPal URL')
      }

      // Redirect to PayPal
      window.location.href = data.paypalUrl
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ein Fehler ist aufgetreten')
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-4 text-gray-800">
          Deine Auswahl
        </h2>

        <label
          htmlFor="friendName"
          className="block text-sm font-medium text-gray-700 mb-2"
        >
          Dein Name
        </label>
        <input
          type="text"
          id="friendName"
          value={friendName}
          onChange={(e) => setFriendName(e.target.value)}
          placeholder="Max Mustermann"
          required
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Was hattest du?
        </label>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {items.map((item) => (
            <div
              key={item.id}
              className="border border-gray-200 rounded-lg p-3 hover:border-green-300 transition-colors"
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex-1">
                  <h3 className="font-medium text-gray-900">{item.name}</h3>
                  <p className="text-sm text-gray-600">
                    {item.quantity}x à {formatEUR(item.pricePerUnit)} ={' '}
                    {formatEUR(item.totalPrice)}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600">Menge:</span>
                  <div className="flex space-x-1">
                    {[0, 0.5, 1, 2].map((qty) => (
                      <button
                        key={qty}
                        type="button"
                        onClick={() => handleItemQuantityChange(item.id, qty)}
                        className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                          selectedItems[item.id] === qty && !customQuantityMode[item.id]
                            ? 'bg-green-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {qty === 0 ? '✗' : `${qty}x`}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => handleCustomQuantityToggle(item.id)}
                      className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                        customQuantityMode[item.id]
                          ? 'bg-green-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      Andere
                    </button>
                  </div>
                  {selectedItems[item.id] > 0 && !customQuantityMode[item.id] && (
                    <span className="ml-auto text-sm font-semibold text-green-600">
                      {formatEUR(
                        item.pricePerUnit * item.quantity * selectedItems[item.id]
                      )}
                    </span>
                  )}
                </div>
                {customQuantityMode[item.id] && (
                  <div className="flex items-center space-x-2">
                    <input
                      type="number"
                      step="0.25"
                      min="0"
                      value={customQuantityInput[item.id] || ''}
                      onChange={(e) => handleCustomQuantityInputChange(item.id, e.target.value)}
                      placeholder="Menge eingeben"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                    />
                    {selectedItems[item.id] > 0 && (
                      <span className="text-sm font-semibold text-green-600">
                        {formatEUR(
                          item.pricePerUnit * item.quantity * selectedItems[item.id]
                        )}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tip Calculator */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Trinkgeld (optional)
        </label>
        <div className="grid grid-cols-4 gap-2 mb-2">
          {[0, 10, 15, 20].map((percent) => (
            <button
              key={percent}
              type="button"
              onClick={() => handleTipChange(percent)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                tipPercent === percent
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {percent}%
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => handleTipChange(-1)}
          className={`w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors mb-2 ${
            tipPercent === -1
              ? 'bg-green-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Eigener Betrag
        </button>
        {tipPercent === -1 && (
          <input
            type="number"
            step="0.01"
            min="0"
            value={customTip}
            onChange={(e) => setCustomTip(e.target.value)}
            placeholder="0.00"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
        )}
      </div>

      {/* Total Summary */}
      <div className="border-t pt-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Zwischensumme:</span>
          <span className="font-medium">{formatEUR(subtotal)}</span>
        </div>
        {tipAmount > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Trinkgeld:</span>
            <span className="font-medium">{formatEUR(tipAmount)}</span>
          </div>
        )}
        <div className="flex justify-between text-lg font-bold">
          <span>Gesamt:</span>
          <span className="text-green-600">{formatEUR(total)}</span>
        </div>
        <p className="text-xs text-gray-500 text-center">
          Zahlung an {payerName} via PayPal
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading || total === 0}
        className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-semibold py-4 px-6 rounded-lg transition-colors text-lg"
      >
        {loading ? (
          'Weiterleitung...'
        ) : (
          <>
            Jetzt bezahlen {total > 0 && `• ${formatEUR(total)}`}
          </>
        )}
      </button>
    </form>
  )
}
