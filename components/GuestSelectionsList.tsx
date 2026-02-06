'use client'

import { useState, useMemo } from 'react'
import { formatEUR } from '@/lib/utils'
import { useTranslation, interpolate } from '@/lib/i18n'

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
  paid: boolean
  paymentMethod: 'PAYPAL' | 'CASH' | null
  status?: 'SELECTING' | 'PAID'
  createdAt: string
}

interface GuestSelectionsListProps {
  items: BillItem[]
  selections: Selection[]  // Now passed as props!
  isOwner?: boolean
  totalBillAmount?: number
}

export default function GuestSelectionsList({
  items,
  selections,
  isOwner = false,
  totalBillAmount = 0,
}: GuestSelectionsListProps) {
  const { t } = useTranslation()
  const [loadingSelectionId, setLoadingSelectionId] = useState<string | null>(null)
  const [expandedSelections, setExpandedSelections] = useState<Record<string, boolean>>({})

  // Format quantity as fraction if applicable
  function formatQuantity(quantity: number): string {
    if (quantity % 1 === 0) return quantity.toString()

    // Try to find the simplest fraction representation
    // Check all denominators from 2 to 30
    for (let den = 2; den <= 30; den++) {
      for (let num = 1; num < den; num++) {
        const fracValue = num / den
        if (Math.abs(quantity - fracValue) < 0.01) {
          // Found a matching fraction - check if it's in simplest form
          const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b)
          const divisor = gcd(num, den)
          const simpleNum = num / divisor
          const simpleDen = den / divisor
          return `${simpleNum}/${simpleDen}`
        }
      }
    }

    // Fallback to decimal if no fraction found
    return (Math.round(quantity * 100) / 100).toString()
  }

  // Calculate summary data (memoized for performance)
  const summaryData = useMemo(() => {
    console.log('🔢 [GuestSelectionsList] Recalculating summary data:', {
      totalSelections: selections.length,
      totalBillAmount,
      selectionsData: selections.map(s => ({
        friendName: s.friendName,
        paymentMethod: s.paymentMethod,
        paid: s.paid,
        tipAmount: s.tipAmount,
        itemQuantities: s.itemQuantities
      }))
    })

    // Count ALL selections (including live selections with paymentMethod=null)
    // Live selections = guests still choosing
    // Submitted selections = paymentMethod set, waiting for or already confirmed
    const validSelections = selections.filter(s => {
      const hasItems = s.itemQuantities && Object.keys(s.itemQuantities).length > 0
      const hasTip = s.tipAmount && s.tipAmount > 0
      return hasItems || hasTip
    })

    console.log('🔢 [GuestSelectionsList] Valid selections (including live):', {
      count: validSelections.length,
      selections: validSelections.map(s => ({
        friendName: s.friendName,
        paymentMethod: s.paymentMethod,
        paid: s.paid,
        tipAmount: s.tipAmount,
        hasItems: Object.keys(s.itemQuantities).length > 0
      }))
    })

    // Calculate total tip from ALL valid selections (including live)
    const totalTip = validSelections.reduce((sum, s) => sum + s.tipAmount, 0)

    // Calculate average tip percentage (based on bill amount)
    const averageTipPercentage = totalBillAmount > 0
      ? (totalTip / totalBillAmount) * 100
      : 0

    // Calculate total amount (bill + tip)
    const totalAmount = totalBillAmount + totalTip

    // Calculate total confirmed payments (paid=true, with OR without paymentMethod)
    // Owner can confirm both submitted selections AND live selections (e.g. cash payment without formal submit)
    const confirmedSelections = validSelections.filter(s => s.paid === true)
    console.log('🔢 [GuestSelectionsList] Confirmed selections:', {
      count: confirmedSelections.length,
      selections: confirmedSelections.map(s => ({
        friendName: s.friendName,
        itemQuantities: s.itemQuantities,
        tipAmount: s.tipAmount
      }))
    })

    const totalConfirmed = confirmedSelections.reduce((sum, s) => {
      const itemQuantities = s.itemQuantities || {}
      const subtotal = Object.entries(itemQuantities).reduce((itemSum, [itemId, quantity]) => {
        const item = items.find(i => i.id === itemId)
        if (!item) return itemSum
        return itemSum + (item.pricePerUnit * quantity)
      }, 0)
      console.log('🔢 [GuestSelectionsList] Confirmed selection calculation:', {
        friendName: s.friendName,
        subtotal,
        tipAmount: s.tipAmount,
        total: subtotal + s.tipAmount
      })
      return sum + subtotal + s.tipAmount
    }, 0)

    // Calculate total pending payments (includes BOTH submitted and live selections)
    // pending = paid=false (either paymentMethod set OR null for live selections)
    const pendingSelections = validSelections.filter(s => s.paid === false)
    console.log('🔢 [GuestSelectionsList] Pending selections:', {
      count: pendingSelections.length,
      selections: pendingSelections.map(s => ({
        friendName: s.friendName,
        itemQuantities: s.itemQuantities,
        tipAmount: s.tipAmount,
        paymentMethod: s.paymentMethod
      }))
    })

    const totalPending = pendingSelections.reduce((sum, s) => {
      const itemQuantities = s.itemQuantities || {}
      const subtotal = Object.entries(itemQuantities).reduce((itemSum, [itemId, quantity]) => {
        const item = items.find(i => i.id === itemId)
        if (!item) {
          console.log('🔢 [GuestSelectionsList] Item not found for ID:', itemId)
          return itemSum
        }
        const lineTotal = item.pricePerUnit * quantity
        console.log('🔢 [GuestSelectionsList] Item calculation:', {
          itemName: item.name,
          pricePerUnit: item.pricePerUnit,
          quantity,
          lineTotal
        })
        return itemSum + lineTotal
      }, 0)
      console.log('🔢 [GuestSelectionsList] Pending selection calculation:', {
        friendName: s.friendName,
        subtotal,
        tipAmount: s.tipAmount,
        total: subtotal + s.tipAmount
      })
      return sum + subtotal + s.tipAmount
    }, 0)

    const result = {
      totalBillAmount,
      totalTip,
      averageTipPercentage,
      totalAmount,
      totalConfirmed,
      totalPending,
    }

    console.log('🔢 [GuestSelectionsList] Summary result:', result)

    return result
  }, [items, selections, totalBillAmount])

  // Filter and sort selections (memoized for performance)
  const allSelections = useMemo(() => {
    // Split by paid flag for display logic
    const unpaid = selections.filter((s: Selection) => s.paid === false)
    const paid = selections.filter((s: Selection) => s.paid === true)

    // For guests: Show only unpaid selections (they don't see confirmation status)
    // For owner: Show both unpaid and confirmed selections
    const filtered = isOwner ? [...unpaid, ...paid] : unpaid

    // Sort: confirmed (paid=true) before unconfirmed (paid=false), then by date
    const sorted = filtered.sort((a, b) => {
      // Sort by paid flag first: confirmed (paid=true) before unconfirmed (paid=false)
      if (a.paid && !b.paid) return -1
      if (!a.paid && b.paid) return 1

      // Then by creation date (newest first)
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })

    return sorted
  }, [selections, isOwner])

  // Handler to mark selection as paid
  const handleMarkAsPaid = async (selectionId: string) => {
    setLoadingSelectionId(selectionId)
    try {
      const response = await fetch(`/api/selections/${selectionId}/mark-paid`, {
        method: 'POST',
      })

      if (!response.ok) {
        throw new Error(t.guestSelections.errorMarkingPaid)
      }
    } catch (error) {
      console.error('Error marking selection as paid:', error)
      alert(t.guestSelections.errorMarkingPaid)
    } finally {
      setLoadingSelectionId(null)
    }
  }

  // Handler to unmark selection as paid
  const handleUnmarkAsPaid = async (selectionId: string) => {
    setLoadingSelectionId(selectionId)
    try {
      const response = await fetch(`/api/selections/${selectionId}/mark-paid`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error(t.guestSelections.errorResetting)
      }
    } catch (error) {
      console.error('Error unmarking selection as paid:', error)
      alert(t.guestSelections.errorResetting)
    } finally {
      setLoadingSelectionId(null)
    }
  }

  // Calculate selection total
  const calculateSelectionTotal = (selection: Selection): number => {
    const subtotal = Object.entries(selection.itemQuantities).reduce((sum, [itemId, quantity]) => {
      const item = items.find(i => i.id === itemId)
      if (!item) return sum
      return sum + item.pricePerUnit * quantity
    }, 0)
    return subtotal + selection.tipAmount
  }

  if (allSelections.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 text-center">
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          {isOwner
            ? t.guestSelections.noSelectionsOwner
            : t.guestSelections.noSelectionsGuest}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="mb-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100">
            {interpolate(t.guestSelections.allGuests, { count: allSelections.length })}
          </h3>
          {isOwner && (
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 border-2 border-green-500 rounded" />
                <span className="text-gray-600 dark:text-gray-400">{t.guestSelections.paid}</span>
              </div>
            </div>
          )}
        </div>
        {isOwner && (
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {t.guestSelections.paidHelpText}
          </p>
        )}
      </div>

      {allSelections.map((selection) => {
        // Determine selection state based on paymentMethod and paid flag
        // NEW: All selections have status='SELECTING', so we check paymentMethod instead
        const isLiveSelection = !selection.paymentMethod  // No payment method = still selecting
        const isSubmitted = !!selection.paymentMethod      // Has payment method = submitted
        const isConfirmed = isSubmitted && selection.paid === true
        const total = calculateSelectionTotal(selection)

        // Get selected items details
        const selectedItems = Object.entries(selection.itemQuantities)
          .map(([itemId, quantity]) => {
            const item = items.find(i => i.id === itemId)
            if (!item) return null
            return {
              name: item.name,
              quantity,
              pricePerUnit: item.pricePerUnit,
              total: item.pricePerUnit * quantity
            }
          })
          .filter(Boolean) as Array<{
            name: string
            quantity: number
            pricePerUnit: number
            total: number
          }>

        return (
          <div
            key={selection.id}
            className={`rounded-lg border-2 transition-colors overflow-hidden ${
              selection.paid
                ? 'bg-green-50 dark:bg-green-900/20 border-green-500 dark:border-green-500'
                : 'bg-white dark:bg-gray-800 border-blue-200 dark:border-blue-700'
            }`}
          >
            {/* Header - Clickable Accordion Button */}
            <button
              type="button"
              onClick={() => setExpandedSelections(prev => ({
                ...prev,
                [selection.id]: !prev[selection.id]
              }))}
              className={`w-full flex items-start justify-between p-4 transition-colors text-left ${
                selection.paid
                  ? 'hover:bg-green-100 dark:hover:bg-green-900/30'
                  : 'hover:bg-gray-50 dark:hover:bg-gray-700/30'
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <h4 className="font-semibold text-gray-900 dark:text-gray-100 text-base">
                    {selection.friendName}
                  </h4>

                  {/* Payment Method Badge */}
                  {selection.paymentMethod && (
                    <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs font-medium rounded">
                      {selection.paymentMethod === 'CASH' ? t.guestSelections.paymentMethodCash : t.guestSelections.paymentMethodPaypal}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 ml-2">
                <p className="text-xl font-bold text-gray-900 dark:text-gray-100 whitespace-nowrap">
                  {formatEUR(total)}
                </p>
                <svg
                  className={`w-5 h-5 text-gray-600 dark:text-gray-400 transition-transform duration-200 flex-shrink-0 ${
                    expandedSelections[selection.id] ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </button>

            {/* Items List - Collapsible */}
            {expandedSelections[selection.id] && (
              <div className="px-4 pb-3 space-y-1.5">
                {selectedItems.map((item, idx) => (
                <div
                  key={idx}
                  className="flex justify-between items-center text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/50 rounded px-2 py-1.5"
                >
                  <span>
                    {item.name} <span className="text-gray-500 dark:text-gray-400">({formatQuantity(item.quantity)}×)</span>
                  </span>
                  <span className="font-medium">{formatEUR(item.total)}</span>
                </div>
              ))}
              </div>
            )}

            {/* Tip - Also collapsible */}
            {expandedSelections[selection.id] && selection.tipAmount > 0 && (
              <div className="px-4 pb-3 mb-3 border-b border-gray-200 dark:border-gray-700">
                <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                  <span>{t.guestSelections.tipLabel}</span>
                  <span className="font-medium">{formatEUR(selection.tipAmount)}</span>
                </div>
              </div>
            )}

            {/* Action Buttons - Only visible to owner (even for live selections) */}
            {isOwner && (
              <div className="px-4 pb-4">
                {!selection.paid ? (
                <button
                  onClick={() => handleMarkAsPaid(selection.id)}
                  disabled={loadingSelectionId === selection.id}
                  className="w-full px-4 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 dark:bg-green-500 dark:hover:bg-green-600 dark:disabled:bg-gray-600 text-white rounded-lg text-sm font-semibold transition-colors"
                >
                  {loadingSelectionId === selection.id ? t.guestSelections.confirmingButton : t.guestSelections.confirmPaymentButton}
                </button>
              ) : (
                <button
                  onClick={() => handleUnmarkAsPaid(selection.id)}
                  disabled={loadingSelectionId === selection.id}
                  className="w-full px-4 py-2.5 bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 dark:bg-gray-700 dark:hover:bg-gray-600 dark:disabled:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium transition-colors"
                >
                  {loadingSelectionId === selection.id ? t.guestSelections.resettingButton : t.guestSelections.resetPaymentButton}
                </button>
                )}
              </div>
            )}
            {/* No buttons for guests */}
          </div>
        )
      })}

      {/* Summary Section - Below guest list */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg border border-blue-200 dark:border-blue-800 p-3 sm:p-4 mt-4">
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-0.5">{t.guestSelections.billTotal}</p>
            <p className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100">
              {formatEUR(summaryData.totalBillAmount)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-0.5">{interpolate(t.guestSelections.averageTip, { percentage: summaryData.averageTipPercentage.toFixed(1) })}</p>
            <p className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100">
              {formatEUR(summaryData.totalTip)}
            </p>
          </div>
        </div>
        <div className="pt-3 border-t border-blue-200 dark:border-blue-700">
          <div className="flex justify-between items-center mb-2">
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{t.guestSelections.totalAmount}</p>
            <p className="text-xl sm:text-2xl font-bold text-blue-600 dark:text-blue-400">
              {formatEUR(summaryData.totalAmount)}
            </p>
          </div>
          <div className="flex justify-between items-center text-xs text-gray-600 dark:text-gray-400">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 bg-green-500 rounded-full" />
              {interpolate(t.guestSelections.confirmedAmount, { amount: formatEUR(summaryData.totalConfirmed) })}
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 bg-yellow-500 rounded-full" />
              {interpolate(t.guestSelections.pendingAmount, { amount: formatEUR(summaryData.totalPending) })}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
