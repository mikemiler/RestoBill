'use client'

import { useState } from 'react'
import { formatEUR } from '@/lib/utils'
import { useRealtimeSubscription } from '@/lib/hooks'

interface BillItem {
  id: string
  pricePerUnit: number
}

interface Selection {
  id: string
  friendName: string
  itemQuantities: Record<string, number>
  tipAmount: number
  paid: boolean
}

interface PaymentOverviewProps {
  billId: string
  totalBillAmount: number
  selections: Selection[]
  items: BillItem[]
}

export default function PaymentOverview({
  billId,
  totalBillAmount,
  selections: initialSelections,
  items,
}: PaymentOverviewProps) {
  const [selections, setSelections] = useState<Selection[]>(initialSelections)

  // Fetch paid selections from API (status=PAID only)
  const fetchSelections = async () => {
    try {
      const response = await fetch(`/api/bills/${billId}/selections`)
      const data = await response.json()
      setSelections(data)
    } catch (error) {
      console.error('Error fetching selections for payment overview:', error)
    }
  }

  // Realtime subscription for paid Selection changes only
  const { isConnected, connectionStatus } = useRealtimeSubscription(billId, {
    // Initial data fetch on mount and after reconnection
    onInitialFetch: async () => {
      await fetchSelections()
    },

    // Selection table changes - refresh paid selections
    onSelectionChange: async () => {
      await fetchSelections()
    },

    // Also handle via onActiveSelectionChange for backwards compatibility
    onActiveSelectionChange: async () => {
      await fetchSelections()
    },

    // Enable debug logging (optional - set to false in production)
    debug: process.env.NODE_ENV === 'development'
  })

  // Calculate total amount from all selections (items + tip)
  const calculateSelectionTotal = (selection: Selection): number => {
    let itemsTotal = 0

    // Calculate items total
    Object.entries(selection.itemQuantities).forEach(([itemId, quantity]) => {
      const item = items.find((i) => i.id === itemId)
      if (item) {
        itemsTotal += item.pricePerUnit * quantity
      }
    })

    return itemsTotal + selection.tipAmount
  }

  // Total from paid selections (status=PAID only)
  const paidTotal = selections.reduce(
    (sum, sel) => sum + calculateSelectionTotal(sel),
    0
  )

  // Remaining amount
  const remaining = totalBillAmount - paidTotal

  // Total tips from paid selections
  const totalTips = selections.reduce((sum, sel) => sum + sel.tipAmount, 0)

  // Progress percentage (based on paid selections only)
  const progressPercent = totalBillAmount > 0
    ? Math.min(100, (paidTotal / totalBillAmount) * 100)
    : 0

  return (
    <div className="bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-lg p-4 sm:p-5 md:p-6 border border-purple-200 dark:border-purple-800">
      <h2 className="text-lg sm:text-xl font-semibold mb-4 text-gray-800 dark:text-gray-100 flex items-center gap-2">
        💰 Zahlungsübersicht
      </h2>

      {/* Payment Stats */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 sm:p-5 shadow-sm mb-4">
        {/* Gesamtbetrag */}
        <div className="flex justify-between items-center mb-3">
          <span className="text-sm text-gray-600 dark:text-gray-400">Gesamtbetrag:</span>
          <span className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {formatEUR(totalBillAmount)}
          </span>
        </div>

        {/* Bezahlt */}
        <div className="flex justify-between items-center mb-3">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Bezahlt ({selections.length} {selections.length === 1 ? 'Gast' : 'Gäste'}):
          </span>
          <span className="text-lg font-semibold text-green-600 dark:text-green-400">
            {formatEUR(paidTotal)}
          </span>
        </div>

        {/* Noch offen */}
        <div className="flex justify-between items-center pt-3 mb-3 border-t border-gray-200 dark:border-gray-700">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Noch offen:</span>
          <span className={`text-xl font-bold ${
            remaining <= 0
              ? 'text-green-600 dark:text-green-400'
              : 'text-orange-600 dark:text-orange-400'
          }`}>
            {formatEUR(Math.max(0, remaining))}
          </span>
        </div>

        {/* Trinkgeld */}
        {totalTips > 0 && (
          <div className="flex justify-between items-center pt-3 border-t border-gray-200 dark:border-gray-700">
            <span className="text-sm text-gray-600 dark:text-gray-400">+ Trinkgeld:</span>
            <span className="text-base font-semibold text-purple-600 dark:text-purple-400">
              {formatEUR(totalTips)}
            </span>
          </div>
        )}
      </div>

      {/* Progress Bar */}
      <div className="mb-3">
        <div className="flex justify-between text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-2">
          <span>Fortschritt</span>
          <span>{Math.round(progressPercent)}%</span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
          <div
            className="bg-gradient-to-r from-purple-500 to-blue-500 h-full transition-all duration-500 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Status Message */}
      {remaining <= 0 ? (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 text-center">
          <p className="text-sm sm:text-base text-green-700 dark:text-green-400 font-medium">
            ✓ Alle Positionen wurden bezahlt!
          </p>
        </div>
      ) : (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
          <p className="text-xs sm:text-sm text-blue-700 dark:text-blue-400">
            <strong>Hinweis:</strong> Gäste können ihre Auswahl über den Share-Link treffen.
          </p>
        </div>
      )}
    </div>
  )
}
