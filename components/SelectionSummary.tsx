'use client'

import { useState } from 'react'
import { formatEUR } from '@/lib/utils'

interface BillItem {
  id: string
  name: string
  pricePerUnit: number
}

interface Selection {
  id: string
  friendName: string
  itemQuantities: Record<string, number>
  tipAmount: number
  paymentMethod: 'PAYPAL' | 'CASH'
  createdAt: string
  status?: 'SELECTING' | 'PAID'
  paid?: boolean
}

interface SelectionSummaryProps {
  selections: Selection[]
  items: BillItem[]
  isOwner?: boolean
}

export default function SelectionSummary({
  selections,
  items,
  isOwner = false,
}: SelectionSummaryProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [loadingSelectionId, setLoadingSelectionId] = useState<string | null>(null)

  // Handler to mark selection as paid (SELECTING → PAID)
  const handleMarkAsPaid = async (selectionId: string) => {
    setLoadingSelectionId(selectionId)
    try {
      const response = await fetch(`/api/selections/${selectionId}/mark-paid`, {
        method: 'POST',
      })

      if (!response.ok) {
        throw new Error('Fehler beim Markieren als bezahlt')
      }

      // The selection will be updated via realtime subscription
      // No manual refresh needed
    } catch (error) {
      console.error('Error marking selection as paid:', error)
      alert('Fehler beim Markieren als bezahlt')
    } finally {
      setLoadingSelectionId(null)
    }
  }

  // Handler to unmark selection as paid (PAID → SELECTING)
  const handleUnmarkAsPaid = async (selectionId: string) => {
    setLoadingSelectionId(selectionId)
    try {
      const response = await fetch(`/api/selections/${selectionId}/mark-paid`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Fehler beim Zurücksetzen')
      }

      // The selection will be updated via realtime subscription
    } catch (error) {
      console.error('Error unmarking selection as paid:', error)
      alert('Fehler beim Zurücksetzen')
    } finally {
      setLoadingSelectionId(null)
    }
  }

  if (selections.length === 0) {
    return null
  }

  // Helper function to calculate subtotal from itemQuantities
  const calculateSubtotal = (itemQuantities: Record<string, number>) => {
    return Object.entries(itemQuantities).reduce((sum, [itemId, quantity]) => {
      const item = items.find(i => i.id === itemId)
      if (!item) return sum
      return sum + item.pricePerUnit * quantity
    }, 0)
  }

  // Calculate totals across all selections
  const grandTotal = selections.reduce((sum, sel) => {
    const subtotal = calculateSubtotal(sel.itemQuantities)
    return sum + subtotal + sel.tipAmount
  }, 0)
  const totalTip = selections.reduce((sum, sel) => sum + sel.tipAmount, 0)
  const totalSubtotal = selections.reduce((sum, sel) => {
    return sum + calculateSubtotal(sel.itemQuantities)
  }, 0)

  return (
    <div className="bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-300 dark:border-blue-700 rounded-lg mb-4 sm:mb-6">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 sm:px-5 py-4 flex items-center justify-between text-left hover:bg-blue-100/50 dark:hover:bg-blue-900/30 transition-colors rounded-t-lg"
      >
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-blue-900 dark:text-blue-300 text-base sm:text-lg">
              ✅ Alle Zahlungen
            </h3>
            <span className="text-xs text-blue-700 dark:text-blue-400">
              ({selections.length} {selections.length === 1 ? 'Zahlung' : 'Zahlungen'})
            </span>
          </div>
          <p className="text-sm sm:text-base font-bold text-blue-600 dark:text-blue-400">
            {formatEUR(grandTotal)}
          </p>
        </div>
        <svg
          className={`w-6 h-6 text-blue-600 dark:text-blue-400 transform transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {isOpen && (
        <div className="px-4 sm:px-5 pb-4 space-y-3">
          {selections.map((selection, idx) => {
          // Calculate subtotal and total for this selection
          const selectionSubtotal = calculateSubtotal(selection.itemQuantities)
          const selectionTotal = selectionSubtotal + selection.tipAmount

          // Map item IDs to names and calculate totals
          const selectedItemsDetails = Object.entries(selection.itemQuantities)
            .map(([itemId, quantity]) => {
              const item = items.find(i => i.id === itemId)
              if (!item) return null
              return {
                name: item.name,
                quantity,
                pricePerUnit: item.pricePerUnit,
                total: item.pricePerUnit * quantity,
              }
            })
            .filter(Boolean) as {
              name: string
              quantity: number
              pricePerUnit: number
              total: number
            }[]

          // Determine if this selection is paid or selecting
          const isPaid = selection.status === 'PAID' || selection.paid === true
          const isSelecting = selection.status === 'SELECTING' || !isPaid

          return (
            <div
              key={selection.id}
              className={`bg-white dark:bg-gray-800 rounded-lg p-3 border ${
                isPaid
                  ? 'border-green-200 dark:border-green-700'
                  : 'border-blue-200 dark:border-blue-700'
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-sm font-semibold text-blue-900 dark:text-blue-200">
                      {selection.friendName}
                    </span>
                    <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 text-xs font-medium rounded">
                      {selection.paymentMethod === 'CASH' ? '💵 Bar' : '💳 PayPal'}
                    </span>
                    {/* Status Badge */}
                    {isPaid ? (
                      <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 text-xs font-medium rounded flex items-center gap-1">
                        <span>✓</span>
                        <span>Bezahlt</span>
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 text-xs font-medium rounded flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
                        <span>Ausgewählt</span>
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    {new Date(selection.createdAt).toLocaleString('de-DE', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
                <span className="text-base font-bold text-blue-600 dark:text-blue-400">
                  {formatEUR(selectionTotal)}
                </span>
              </div>

              <div className="space-y-1">
                {selectedItemsDetails.map((item, index) => (
                  <div
                    key={index}
                    className="flex justify-between items-center text-xs text-gray-700 dark:text-gray-300"
                  >
                    <span>
                      {item.name} <span className="text-gray-500 dark:text-gray-500">({item.quantity}x)</span>
                    </span>
                    <span className="font-medium">{formatEUR(item.total)}</span>
                  </div>
                ))}
              </div>

              {selection.tipAmount > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400">
                    <span>inkl. Trinkgeld</span>
                    <span>{formatEUR(selection.tipAmount)}</span>
                  </div>
                </div>
              )}

              {/* Owner Controls - Mark as Paid Button */}
              {isOwner && (
                <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                  {isSelecting ? (
                    <button
                      onClick={() => handleMarkAsPaid(selection.id)}
                      disabled={loadingSelectionId === selection.id}
                      className="w-full px-3 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 dark:bg-green-500 dark:hover:bg-green-600 dark:disabled:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      {loadingSelectionId === selection.id ? 'Bestätigen...' : '✓ Zahlung bestätigen'}
                    </button>
                  ) : (
                    <button
                      onClick={() => handleUnmarkAsPaid(selection.id)}
                      disabled={loadingSelectionId === selection.id}
                      className="w-full px-3 py-2 bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 dark:bg-gray-600 dark:hover:bg-gray-500 dark:disabled:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg text-sm font-medium transition-colors"
                    >
                      {loadingSelectionId === selection.id ? 'Zurücksetzen...' : '↻ Zahlung zurücksetzen'}
                    </button>
                  )}
                </div>
              )}
            </div>
          )
          })}

          {/* Grand Total Summary */}
          <div className="mt-4 pt-4 border-t-2 border-blue-300 dark:border-blue-700 space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-blue-700 dark:text-blue-400">Gesamt Zwischensumme:</span>
              <span className="font-medium text-blue-900 dark:text-blue-200">
                {formatEUR(totalSubtotal)}
              </span>
            </div>
            {totalTip > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-blue-700 dark:text-blue-400">Gesamt Trinkgeld:</span>
                <span className="font-medium text-blue-900 dark:text-blue-200">
                  {formatEUR(totalTip)}
                </span>
              </div>
            )}
            <div className="flex justify-between text-lg sm:text-xl font-bold pt-1">
              <span className="text-blue-900 dark:text-blue-200">Gesamtbetrag:</span>
              <span className="text-blue-600 dark:text-blue-400">
                {formatEUR(grandTotal)}
              </span>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-blue-300 dark:border-blue-700">
            <p className="text-xs text-blue-700 dark:text-blue-400 text-center">
              Weitere Positionen können unten ausgewählt und bezahlt werden
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
