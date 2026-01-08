'use client'

import { useState, useEffect } from 'react'
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
  itemRemainingQuantities: Record<string, number>
}

export default function SplitForm({
  billId,
  shareToken,
  payerName,
  paypalHandle,
  items,
  itemRemainingQuantities,
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

  // Load friendName from localStorage on mount
  useEffect(() => {
    const savedFriendName = localStorage.getItem('friendName')
    if (savedFriendName) {
      setFriendName(savedFriendName)
    }
  }, [])

  // Calculate subtotal from selected items
  const subtotal = items.reduce((sum, item) => {
    const quantity = selectedItems[item.id] || 0
    return sum + item.pricePerUnit * quantity
  }, 0)

  // Calculate tip
  const tipAmount =
    tipPercent === -1
      ? parseFloat(customTip) || 0
      : (subtotal * tipPercent) / 100

  const total = subtotal + tipAmount

  // Generate quantity options based on remaining quantity
  function getQuantityOptions(remainingQty: number): number[] {
    if (remainingQty === 0) return []

    const options = [0]

    // Add 0.5 if there's at least 0.5 remaining
    if (remainingQty >= 0.5) {
      options.push(0.5)
    }

    // Add whole numbers up to remaining quantity (max 3 buttons for whole numbers)
    const maxWholeNumber = Math.min(Math.floor(remainingQty), 3)
    for (let i = 1; i <= maxWholeNumber; i++) {
      options.push(i)
    }

    return options
  }

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
    const remainingQty = itemRemainingQuantities[itemId]

    if (!isNaN(numValue) && numValue > 0) {
      // Limit to remaining quantity
      const clampedValue = Math.min(numValue, remainingQty)
      setSelectedItems((prev) => ({ ...prev, [itemId]: clampedValue }))
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

    // Save friendName to localStorage
    localStorage.setItem('friendName', friendName.trim())

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
    <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5 md:space-y-6">
      <div>
        <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 text-gray-800 dark:text-gray-100">
          Deine Auswahl
        </h2>

        <label
          htmlFor="friendName"
          className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
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
          className="w-full px-3 py-2.5 sm:px-4 sm:py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 dark:focus:ring-green-400 focus:border-transparent text-sm sm:text-base dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-400"
        />
      </div>

      <div>
        <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 sm:mb-3">
          Was hattest du?
        </label>
        <div className="space-y-2">
          {items.map((item) => {
            const remainingQty = itemRemainingQuantities[item.id] ?? item.quantity
            const isFullyClaimed = remainingQty === 0
            const quantityOptions = getQuantityOptions(remainingQty)

            return (
              <div
                key={item.id}
                className={`border rounded-lg p-2.5 sm:p-3 transition-colors ${
                  isFullyClaimed
                    ? 'border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 opacity-60'
                    : 'border-gray-200 dark:border-gray-600 hover:border-green-300 dark:hover:border-green-500 dark:bg-gray-700/50'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-gray-900 dark:text-gray-100 text-sm sm:text-base">
                        {item.name}
                      </h3>
                      {isFullyClaimed && (
                        <span className="px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-xs font-medium rounded">
                          Vergeben
                        </span>
                      )}
                    </div>
                    <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                      {item.quantity}x à {formatEUR(item.pricePerUnit)} ={' '}
                      {formatEUR(item.totalPrice)}
                      {!isFullyClaimed && remainingQty < item.quantity && (
                        <span className="ml-2 text-orange-600 dark:text-orange-400 font-medium">
                          (noch {remainingQty}x verfügbar)
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                {!isFullyClaimed && (
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 w-full sm:w-auto">
                        Menge:
                      </span>
                      <div className="flex gap-1.5 sm:gap-2 flex-wrap">
                        {quantityOptions.map((qty) => (
                          <button
                            key={qty}
                            type="button"
                            onClick={() => handleItemQuantityChange(item.id, qty)}
                            className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors min-w-[2.5rem] ${
                              selectedItems[item.id] === qty && !customQuantityMode[item.id]
                                ? 'bg-green-600 text-white dark:bg-green-500'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500'
                            }`}
                          >
                            {qty === 0 ? '✗' : `${qty}x`}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => handleCustomQuantityToggle(item.id)}
                          className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                            customQuantityMode[item.id]
                              ? 'bg-green-600 text-white dark:bg-green-500'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500'
                          }`}
                        >
                          Andere
                        </button>
                      </div>
                      {selectedItems[item.id] > 0 && !customQuantityMode[item.id] && (
                        <span className="ml-auto text-xs sm:text-sm font-semibold text-green-600 dark:text-green-400">
                          {formatEUR(item.pricePerUnit * selectedItems[item.id])}
                        </span>
                      )}
                    </div>
                    {customQuantityMode[item.id] && (
                      <div className="space-y-2">
                        {/* Fraction Buttons */}
                        <div>
                          <span className="text-xs text-gray-600 dark:text-gray-400 block mb-1.5">
                            Schnellauswahl:
                          </span>
                          <div className="flex gap-1.5 flex-wrap">
                            {[
                              { label: '1/3', value: 1/3 },
                              { label: '1/4', value: 1/4 },
                              { label: '1/5', value: 1/5 },
                              { label: '1/6', value: 1/6 },
                              { label: '1/7', value: 1/7 },
                              { label: '1/8', value: 1/8 },
                              { label: '1/9', value: 1/9 },
                              { label: '1/10', value: 1/10 },
                            ].map((fraction) => {
                              const actualValue = Math.min(fraction.value * item.quantity, remainingQty)
                              return (
                                <button
                                  key={fraction.label}
                                  type="button"
                                  onClick={() => {
                                    setCustomQuantityInput((prev) => ({
                                      ...prev,
                                      [item.id]: actualValue.toString()
                                    }))
                                    setSelectedItems((prev) => ({
                                      ...prev,
                                      [item.id]: actualValue
                                    }))
                                  }}
                                  className="px-2 py-1 bg-purple-100 hover:bg-purple-200 dark:bg-purple-700 dark:hover:bg-purple-600 text-purple-700 dark:text-purple-100 rounded text-xs font-medium transition-colors"
                                >
                                  {fraction.label}
                                </button>
                              )
                            })}
                          </div>
                        </div>

                        {/* Divide By Input */}
                        <div>
                          <label className="text-xs text-gray-600 dark:text-gray-400 block mb-1.5">
                            Oder teilen durch:
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min="2"
                              max="20"
                              placeholder="Anzahl Personen"
                              onChange={(e) => {
                                const persons = parseInt(e.target.value)
                                if (!isNaN(persons) && persons > 1) {
                                  const value = Math.min(item.quantity / persons, remainingQty)
                                  setCustomQuantityInput((prev) => ({
                                    ...prev,
                                    [item.id]: value.toString()
                                  }))
                                  setSelectedItems((prev) => ({
                                    ...prev,
                                    [item.id]: value
                                  }))
                                }
                              }}
                              className="w-32 px-2.5 py-1.5 border border-gray-300 dark:border-gray-500 rounded-lg focus:ring-2 focus:ring-green-500 dark:focus:ring-green-400 focus:border-transparent text-xs dark:bg-gray-600 dark:text-gray-100"
                            />
                            <span className="text-xs text-gray-500 dark:text-gray-400">Personen</span>
                          </div>
                        </div>

                        {/* Manual Input */}
                        <div>
                          <label className="text-xs text-gray-600 dark:text-gray-400 block mb-1.5">
                            Oder eigene Menge:
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              max={remainingQty}
                              value={customQuantityInput[item.id] || ''}
                              onChange={(e) => handleCustomQuantityInputChange(item.id, e.target.value)}
                              placeholder={`Max ${remainingQty}`}
                              className="flex-1 px-2.5 sm:px-3 py-2 border border-gray-300 dark:border-gray-500 rounded-lg focus:ring-2 focus:ring-green-500 dark:focus:ring-green-400 focus:border-transparent text-xs sm:text-sm dark:bg-gray-600 dark:text-gray-100"
                            />
                            {selectedItems[item.id] > 0 && (
                              <span className="text-xs sm:text-sm font-semibold text-green-600 dark:text-green-400 whitespace-nowrap">
                                {formatEUR(item.pricePerUnit * selectedItems[item.id])}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Tip Calculator */}
      <div>
        <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 sm:mb-3">
          Trinkgeld (optional)
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-2 mb-2">
          {[0, 7, 10, 15].map((percent) => (
            <button
              key={percent}
              type="button"
              onClick={() => handleTipChange(percent)}
              className={`px-2.5 sm:px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                tipPercent === percent
                  ? 'bg-green-600 text-white dark:bg-green-500'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500'
              }`}
            >
              {percent}%
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => handleTipChange(-1)}
          className={`w-full px-2.5 sm:px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors mb-2 ${
            tipPercent === -1
              ? 'bg-green-600 text-white dark:bg-green-500'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500'
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
            className="w-full px-3 sm:px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 dark:focus:ring-green-400 focus:border-transparent text-sm sm:text-base dark:bg-gray-700 dark:text-gray-100"
          />
        )}
      </div>

      {/* Total Summary */}
      <div className="border-t dark:border-gray-600 pt-3 sm:pt-4 space-y-1.5 sm:space-y-2">
        <div className="flex justify-between text-xs sm:text-sm">
          <span className="text-gray-600 dark:text-gray-400">Zwischensumme:</span>
          <span className="font-medium text-gray-900 dark:text-gray-200">{formatEUR(subtotal)}</span>
        </div>
        {tipAmount > 0 && (
          <div className="flex justify-between text-xs sm:text-sm">
            <span className="text-gray-600 dark:text-gray-400">Trinkgeld:</span>
            <span className="font-medium text-gray-900 dark:text-gray-200">{formatEUR(tipAmount)}</span>
          </div>
        )}
        <div className="flex justify-between text-base sm:text-lg font-bold">
          <span className="text-gray-900 dark:text-gray-100">Gesamt:</span>
          <span className="text-green-600 dark:text-green-400">{formatEUR(total)}</span>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 text-center pt-1">
          Zahlung an {payerName} via PayPal
        </p>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-3 py-2.5 sm:px-4 sm:py-3 rounded-lg text-xs sm:text-sm">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading || total === 0}
        className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 dark:bg-green-500 dark:hover:bg-green-600 dark:disabled:bg-gray-600 text-white font-semibold py-3 sm:py-4 px-4 sm:px-6 rounded-lg transition-colors text-base sm:text-lg"
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
