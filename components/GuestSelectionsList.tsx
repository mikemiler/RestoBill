'use client'

import { useState, useMemo, useEffect } from 'react'
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
  paid: boolean
  paymentMethod: 'PAYPAL' | 'CASH' | null
  status?: 'SELECTING' | 'PAID'
  createdAt: string
}

interface GuestSelectionsListProps {
  items: BillItem[]
  selections: Selection[]  // Now passed as props!
  isOwner?: boolean
}

export default function GuestSelectionsList({
  items,
  selections,
  isOwner = false,
}: GuestSelectionsListProps) {
  const [loadingSelectionId, setLoadingSelectionId] = useState<string | null>(null)
  const [expandedSelections, setExpandedSelections] = useState<Record<string, boolean>>({})

  // Log when props change
  useEffect(() => {
    const timestamp = new Date().toISOString()
    console.log(`\n👥 [GuestSelectionsList ${timestamp}] ===== PROPS RECEIVED =====`)
    console.log('[GuestSelectionsList] Received props:', {
      selectionsCount: selections.length,
      itemsCount: items.length,
      isOwner,
      selections: selections.map(s => ({
        id: s.id.substring(0, 8),
        friendName: s.friendName,
        itemCount: Object.keys(s.itemQuantities || {}).length,
        itemQuantities: s.itemQuantities,
        tipAmount: s.tipAmount,
        paymentMethod: s.paymentMethod,
        paid: s.paid,
        status: s.status
      }))
    })
    console.log('[GuestSelectionsList] ===== PROPS RECEIVED END =====\n')
  }, [selections, items, isOwner])

  // Filter and sort selections (memoized for performance)
  const allSelections = useMemo(() => {
    console.log(`\n🔄 [GuestSelectionsList] ===== useMemo RECALCULATING =====`)
    console.log('[GuestSelectionsList] Input selections:', selections.length)
    // Split by paid flag for display logic
    const unpaid = selections.filter((s: Selection) => s.paid === false)
    const paid = selections.filter((s: Selection) => s.paid === true)

    // For guests: Show only unpaid selections (they don't see confirmation status)
    // For owner: Show both unpaid and confirmed selections
    const filtered = isOwner ? [...unpaid, ...paid] : unpaid

    console.log('[GuestSelectionsList] Filtering logic:', {
      unpaidCount: unpaid.length,
      paidCount: paid.length,
      filteredCount: filtered.length,
      isOwner,
      unpaidSelections: unpaid.map(s => ({
        id: s.id.substring(0, 8),
        friendName: s.friendName,
        itemCount: Object.keys(s.itemQuantities || {}).length,
        paid: s.paid
      })),
      paidSelections: paid.map(s => ({
        id: s.id.substring(0, 8),
        friendName: s.friendName,
        itemCount: Object.keys(s.itemQuantities || {}).length,
        paid: s.paid
      }))
    })

    // Sort: confirmed (paid=true) before unconfirmed (paid=false), then by date
    const sorted = filtered.sort((a, b) => {
      // Sort by paid flag first: confirmed (paid=true) before unconfirmed (paid=false)
      if (a.paid && !b.paid) return -1
      if (!a.paid && b.paid) return 1

      // Then by creation date (newest first)
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })

    console.log('[GuestSelectionsList] ✅ Final sorted selections:', {
      count: sorted.length,
      selections: sorted.map(s => ({
        id: s.id.substring(0, 8),
        friendName: s.friendName,
        itemCount: Object.keys(s.itemQuantities || {}).length,
        itemQuantities: s.itemQuantities,
        paid: s.paid,
        paymentMethod: s.paymentMethod
      }))
    })
    console.log('[GuestSelectionsList] ===== useMemo RECALCULATING END =====\n')

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
        throw new Error('Fehler beim Markieren als bezahlt')
      }
    } catch (error) {
      console.error('Error marking selection as paid:', error)
      alert('Fehler beim Markieren als bezahlt')
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
        throw new Error('Fehler beim Zurücksetzen')
      }
    } catch (error) {
      console.error('Error unmarking selection as paid:', error)
      alert('Fehler beim Zurücksetzen')
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
            ? 'Noch keine Auswahlen. Teile den Link mit deinen Gästen!'
            : 'Noch keine aktiven Auswahlen.'}
        </p>
        {process.env.NODE_ENV === 'development' && (
          <p className="text-xs text-gray-400 mt-2">
            Debug: Received {selections.length} selections from props
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100">
          Alle Gäste ({allSelections.length})
        </h3>
        {isOwner && (
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
              <span className="text-gray-600 dark:text-gray-400">Wählt aus</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 bg-yellow-500 rounded-full" />
              <span className="text-gray-600 dark:text-gray-400">Eingereicht</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-green-600 dark:text-green-400">✓</span>
              <span className="text-gray-600 dark:text-gray-400">Bestätigt</span>
            </div>
          </div>
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
            className={`bg-white dark:bg-gray-800 rounded-lg border-2 transition-colors overflow-hidden ${
              isLiveSelection
                ? 'border-blue-200 dark:border-blue-700'
                : isConfirmed
                  ? 'border-green-200 dark:border-green-700'
                  : 'border-yellow-200 dark:border-yellow-700'
            }`}
          >
            {/* Header - Clickable Accordion Button */}
            <button
              type="button"
              onClick={() => setExpandedSelections(prev => ({
                ...prev,
                [selection.id]: !prev[selection.id]
              }))}
              className="w-full flex items-start justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors text-left"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <h4 className="font-semibold text-gray-900 dark:text-gray-100 text-base">
                    {selection.friendName}
                  </h4>

                  {/* Status Badge - Based on status and paid flag */}
                  {isLiveSelection ? (
                    // Live selection (SELECTING status)
                    <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-medium rounded flex items-center gap-1">
                      <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                      <span>Auswählt gerade</span>
                    </span>
                  ) : isOwner ? (
                    // Owner sees confirmation status for submitted (PAID) selections
                    isConfirmed ? (
                      <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs font-medium rounded flex items-center gap-1">
                        <span>✓</span>
                        <span>Zahlung bestätigt</span>
                      </span>
                    ) : (
                      <span className="px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 text-xs font-medium rounded flex items-center gap-1">
                        <span>⏳</span>
                        <span>Eingereicht</span>
                      </span>
                    )
                  ) : (
                    // Guest only sees "Eingereicht" for submitted selections (doesn't see confirmation status)
                    <span className="px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 text-xs font-medium rounded flex items-center gap-1">
                      <span>⏳</span>
                      <span>Eingereicht</span>
                    </span>
                  )}

                  {/* Payment Method Badge - nur für submitted selections */}
                  {selection.paymentMethod && (
                    <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs font-medium rounded">
                      {selection.paymentMethod === 'CASH' ? '💵 Bar' : '💳 PayPal'}
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
                    {item.name} <span className="text-gray-500 dark:text-gray-400">({item.quantity}x)</span>
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
                  <span>+ Trinkgeld</span>
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
                  {loadingSelectionId === selection.id ? 'Bestätigen...' : '✓ Zahlung bestätigen'}
                </button>
              ) : (
                <button
                  onClick={() => handleUnmarkAsPaid(selection.id)}
                  disabled={loadingSelectionId === selection.id}
                  className="w-full px-4 py-2.5 bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 dark:bg-gray-700 dark:hover:bg-gray-600 dark:disabled:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium transition-colors"
                >
                  {loadingSelectionId === selection.id ? 'Zurücksetzen...' : '↻ Zahlung zurücksetzen'}
                </button>
                )}
              </div>
            )}
            {/* No buttons for guests */}
          </div>
        )
      })}
    </div>
  )
}
