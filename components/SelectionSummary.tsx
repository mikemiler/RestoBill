'use client'

import { formatEUR } from '@/lib/utils'
import { SavedSelection } from '@/lib/selectionStorage'

interface BillItem {
  id: string
  name: string
  pricePerUnit: number
}

interface SelectionSummaryProps {
  selections: SavedSelection[]
  items: BillItem[]
}

export default function SelectionSummary({
  selections,
  items,
}: SelectionSummaryProps) {
  if (selections.length === 0) {
    return null
  }

  // Calculate total amount across all selections
  const grandTotal = selections.reduce((sum, sel) => sum + sel.totalAmount, 0)
  const totalTip = selections.reduce((sum, sel) => sum + sel.tipAmount, 0)
  const totalSubtotal = selections.reduce((sum, sel) => sum + sel.subtotal, 0)

  return (
    <div className="bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-300 dark:border-blue-700 rounded-lg p-4 sm:p-5 mb-4 sm:mb-6">
      <div className="mb-4">
        <h3 className="font-semibold text-blue-900 dark:text-blue-300 text-base sm:text-lg flex items-center gap-2 mb-1">
          ✅ Deine bisherigen Zahlungen
        </h3>
        <p className="text-xs text-blue-700 dark:text-blue-400">
          Du hast bereits {selections.length} {selections.length === 1 ? 'Zahlung' : 'Zahlungen'} getätigt
        </p>
      </div>

      <div className="space-y-3">
        {selections.map((selection, idx) => {
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

          return (
            <div
              key={selection.selectionId}
              className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-blue-200 dark:border-blue-700"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold text-blue-700 dark:text-blue-400">
                      Zahlung #{selections.length - idx}
                    </span>
                    <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 text-xs font-medium rounded">
                      {selection.paymentMethod === 'CASH' ? '💵 Bar' : '💳 PayPal'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    {selection.friendName} • {new Date(selection.createdAt).toLocaleString('de-DE', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
                <span className="text-base font-bold text-blue-600 dark:text-blue-400">
                  {formatEUR(selection.totalAmount)}
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
            </div>
          )
        })}
      </div>

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
          Du kannst weitere Positionen auswählen und bezahlen
        </p>
      </div>
    </div>
  )
}
