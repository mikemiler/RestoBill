'use client'

import { useMemo, useEffect } from 'react'
import { formatEUR } from '@/lib/utils'

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
  paymentMethod: 'PAYPAL' | 'CASH' | null
  status?: 'SELECTING' | 'PAID'
}

interface PaymentOverviewProps {
  totalBillAmount: number
  selections: Selection[]  // Now passed as props!
  items: BillItem[]
}

export default function PaymentOverview({
  totalBillAmount,
  selections,
  items,
}: PaymentOverviewProps) {
  // Log when props change
  useEffect(() => {
    const timestamp = new Date().toISOString()
    console.log(`\n💰 [PaymentOverview ${timestamp}] ===== PROPS RECEIVED =====`)
    console.log('[PaymentOverview] Received props:', {
      totalBillAmount,
      selectionsCount: selections.length,
      itemsCount: items.length,
      selections: selections.map(s => ({
        id: s.id.substring(0, 8),
        friendName: s.friendName,
        itemCount: Object.keys(s.itemQuantities || {}).length,
        tipAmount: s.tipAmount,
        paymentMethod: s.paymentMethod,
        paid: s.paid
      }))
    })
    console.log('[PaymentOverview] ===== PROPS RECEIVED END =====\n')
  }, [selections, items, totalBillAmount])

  // Filter selections: only show submitted ones (with paymentMethod)
  // Live selections (paymentMethod=null) are excluded from payment overview
  const submittedSelections = useMemo(() => {
    console.log('\n💰 [PaymentOverview] ===== useMemo: FILTERING SUBMITTED SELECTIONS =====')
    const filtered = selections.filter((s: Selection) =>
      s.paymentMethod !== null  // Exclude live selections (still choosing)
    )
    console.log('[PaymentOverview] Filtered result:', {
      input: selections.length,
      output: filtered.length,
      filtered: filtered.map(s => ({
        id: s.id.substring(0, 8),
        friendName: s.friendName,
        paymentMethod: s.paymentMethod,
        paid: s.paid
      }))
    })
    console.log('[PaymentOverview] ===== useMemo END =====\n')
    return filtered
  }, [selections])

  // Split by paid flag
  const selectingSelections = useMemo(() =>
    submittedSelections.filter((s: Selection) => s.paid === false),
    [submittedSelections]
  )

  const paidSelections = useMemo(() =>
    submittedSelections.filter((s: Selection) => s.paid === true),
    [submittedSelections]
  )

  // Combine both for calculations
  const allSelections = [...selectingSelections, ...paidSelections]

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

  // Calculate totals separately
  const selectingTotal = selectingSelections.reduce(
    (sum, sel) => sum + calculateSelectionTotal(sel),
    0
  )

  const paidTotal = paidSelections.reduce(
    (sum, sel) => sum + calculateSelectionTotal(sel),
    0
  )

  // Remaining amount (total - paid - selecting)
  const remaining = totalBillAmount - paidTotal - selectingTotal

  // Total tips from all selections
  const totalTips = allSelections.reduce((sum, sel) => sum + sel.tipAmount, 0)

  // Progress percentage (based on paid + selecting)
  const paidPercent = totalBillAmount > 0
    ? (paidTotal / totalBillAmount) * 100
    : 0

  const selectingPercent = totalBillAmount > 0
    ? (selectingTotal / totalBillAmount) * 100
    : 0

  const totalPercent = Math.min(100, paidPercent + selectingPercent)

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

        {/* Eingereicht (paid=false, paymentMethod set) */}
        {selectingSelections.length > 0 && (
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-yellow-500 rounded-full" />
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Eingereicht ({selectingSelections.length} {selectingSelections.length === 1 ? 'Gast' : 'Gäste'}):
              </span>
            </div>
            <span className="text-lg font-semibold text-yellow-600 dark:text-yellow-400">
              {formatEUR(selectingTotal)}
            </span>
          </div>
        )}

        {/* Bestätigt (paid=true) */}
        {paidSelections.length > 0 && (
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-2">
              <span className="text-green-600 dark:text-green-400">✓</span>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Bestätigt ({paidSelections.length} {paidSelections.length === 1 ? 'Gast' : 'Gäste'}):
              </span>
            </div>
            <span className="text-lg font-semibold text-green-600 dark:text-green-400">
              {formatEUR(paidTotal)}
            </span>
          </div>
        )}

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
          <span>{Math.round(totalPercent)}%</span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden relative">
          {/* PAID section (green) */}
          <div
            className="bg-green-500 dark:bg-green-600 h-full transition-all duration-500 ease-out absolute left-0"
            style={{ width: `${paidPercent}%` }}
          />
          {/* SUBMITTED section (yellow) */}
          <div
            className="bg-yellow-500 dark:bg-yellow-600 h-full transition-all duration-500 ease-out absolute"
            style={{
              left: `${paidPercent}%`,
              width: `${selectingPercent}%`
            }}
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
