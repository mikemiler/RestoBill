'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { formatEUR } from '@/lib/utils'
import { getOrCreateSessionId } from '@/lib/sessionStorage'
import { useRealtimeSubscription } from '@/lib/hooks'

// Browser-only Supabase client
const supabase = typeof window !== 'undefined'
  ? createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  : null

interface BillItem {
  id: string
  name: string
  quantity: number
  pricePerUnit: number
  totalPrice: number
}

interface LiveSelection {
  id: string
  billId: string
  sessionId: string
  friendName: string
  itemQuantities: Record<string, number>
  status: 'SELECTING' | 'PAID'
  createdAt: string
  expiresAt: string
}

interface DatabaseSelection {
  id: string
  billId: string
  friendName: string
  itemQuantities: Record<string, number>
  tipAmount: number
  paid: boolean
  paymentMethod: 'PAYPAL' | 'CASH'
  createdAt: string
}

interface SplitFormProps {
  billId: string
  shareToken: string
  payerName: string
  paypalHandle: string | null
  items: BillItem[]
  itemRemainingQuantities: Record<string, number>
  totalAmount: number
  allSelections: DatabaseSelection[]
  isOwner?: boolean
}

export default function SplitForm({
  billId,
  shareToken,
  payerName,
  paypalHandle,
  items,
  itemRemainingQuantities,
  totalAmount,
  allSelections,
  isOwner = false,
}: SplitFormProps) {
  const router = useRouter()
  const [friendName, setFriendName] = useState('')
  const [sessionId, setSessionId] = useState('')
  const [nameConfirmed, setNameConfirmed] = useState(false)
  const [selectedItems, setSelectedItems] = useState<Record<string, number>>({})
  const [customQuantityMode, setCustomQuantityMode] = useState<Record<string, boolean>>({})
  const [customQuantityInput, setCustomQuantityInput] = useState<Record<string, string>>({})
  const [tipPercent, setTipPercent] = useState(10)
  const [customTip, setCustomTip] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [liveSelections, setLiveSelections] = useState<LiveSelection[]>([])
  const [remainingQuantities, setRemainingQuantities] = useState<Record<string, number>>(itemRemainingQuantities)
  const [selections, setSelections] = useState<DatabaseSelection[]>(allSelections)

  // Sync selections state when allSelections prop changes (from parent updates)
  useEffect(() => {
    setSelections(allSelections)
  }, [allSelections])

  // Item management states (Owner only)
  const [openMenuItemId, setOpenMenuItemId] = useState<string | null>(null)
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<{
    name: string
    quantity: number
    pricePerUnit: number
  } | null>(null)
  const [addingNew, setAddingNew] = useState(false)
  const [newItemForm, setNewItemForm] = useState({
    name: '',
    quantity: 1,
    pricePerUnit: 0
  })

  // Track if we've restored selections yet
  const hasRestoredSelections = useRef(false)

  // Initialize sessionId on mount
  useEffect(() => {
    const sid = getOrCreateSessionId()
    setSessionId(sid)
  }, [])

  // Load friendName from localStorage on mount (or set to payerName if owner)
  useEffect(() => {
    if (isOwner) {
      setFriendName(payerName)
      setNameConfirmed(true) // Owner skips welcome screen
    } else {
      // Try bill-specific name first, then global fallback
      const billSpecificName = localStorage.getItem(`friendName_${billId}`)
      const globalName = localStorage.getItem('friendName')
      const savedFriendName = billSpecificName || globalName

      if (savedFriendName) {
        setFriendName(savedFriendName)
        setNameConfirmed(true) // Returning guest skips welcome screen
      }
    }
  }, [isOwner, payerName, billId])

  // Save friendName to localStorage whenever it changes (per-bill and global fallback)
  useEffect(() => {
    if (friendName.trim()) {
      // Save per-bill (prevents name collision between bills)
      localStorage.setItem(`friendName_${billId}`, friendName.trim())
      // Also save globally (for autocomplete in new bills)
      localStorage.setItem('friendName', friendName.trim())
    }
  }, [friendName, billId])

  // Close dropdown menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (openMenuItemId) {
        setOpenMenuItemId(null)
      }
    }

    if (openMenuItemId) {
      document.addEventListener('click', handleClickOutside)
      return () => {
        document.removeEventListener('click', handleClickOutside)
      }
    }
  }, [openMenuItemId])

  // Restore selections from unified Selection table (status='SELECTING') when friendName is ready
  useEffect(() => {
    // Only run once after friendName is loaded
    if (hasRestoredSelections.current || !friendName.trim()) {
      return
    }

    // Restore from unified Selection table (DB as single source of truth)
    const restoreFromLiveSelections = async () => {
      try {
        const response = await fetch(`/api/bills/${billId}/live-selections`)
        const data: LiveSelection[] = await response.json()

        const currentSessionId = sessionId || getOrCreateSessionId()

        // Find this session's selection
        const mySelection = data.find(sel => sel.sessionId === currentSessionId)

        if (mySelection && mySelection.itemQuantities) {
          setSelectedItems(mySelection.itemQuantities)
        }
      } catch (error) {
        console.error('Error restoring selections from DB:', error)
      }
    }

    restoreFromLiveSelections()

    // Mark as restored
    hasRestoredSelections.current = true
  }, [friendName, billId, sessionId])

  // Note: fetchSelections removed - now handled by parent SplitFormContainer
  // The parent fetches and passes allSelections as prop, which is synced via useEffect

  // Fetch live selections (unified Selection with status='SELECTING')
  const fetchLiveSelections = async () => {
    try {
      console.log('[SplitForm] Fetching live selections...')
      const response = await fetch(`/api/bills/${billId}/live-selections`)
      const data: LiveSelection[] = await response.json()

      // Filter out expired selections and empty selections (no items selected)
      const now = new Date()
      const activeData = data.filter(sel => {
        const hasItems = Object.keys(sel.itemQuantities || {}).length > 0
        const notExpired = new Date(sel.expiresAt) > now
        return hasItems && notExpired
      })

      console.log('[SplitForm] Live selections fetched:', {
        total: data.length,
        active: activeData.length,
        selections: activeData.map(s => ({
          id: s.id,
          friendName: s.friendName,
          sessionId: s.sessionId,
          itemCount: Object.keys(s.itemQuantities || {}).length
        }))
      })

      setLiveSelections(activeData)
    } catch (error) {
      console.error('Error fetching live selections:', error)
    }
  }

  // Realtime subscription for LIVE selections only (SELECTING status)
  // PAID selections are fetched by parent SplitFormContainer
  const { isConnected } = useRealtimeSubscription(billId, {
    // Initial data fetch on mount and after reconnection
    onInitialFetch: async () => {
      await fetchLiveSelections()
      // Note: PAID selections come from parent prop (allSelections)
    },

    // Selection table changes - fetch only SELECTING
    // PAID selections are handled by parent
    onSelectionChange: async () => {
      await fetchLiveSelections()
    },

    // Also handle via onActiveSelectionChange for backwards compatibility
    onActiveSelectionChange: async () => {
      await fetchLiveSelections()
    },

    // Item changes broadcast from owner
    onItemChange: async () => {
      await fetchLiveSelections()
    },

    // Enable debug logging in development
    debug: process.env.NODE_ENV === 'development'
  })

  // Auto-recalculate remaining quantities when selections or liveSelections change
  // This prevents race conditions by using the actual state values
  useEffect(() => {
    calculateRemainingQuantities()
  }, [selections, liveSelections])

  // Note: We no longer cleanup ActiveSelections when leaving the page
  // This allows guests to return later and continue where they left off
  // ActiveSelections are only cleaned up when the guest actually submits payment

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

  // Calculate total paid amount from all selections
  const totalPaidAmount = selections.reduce((sum, selection) => {
    // Calculate selection subtotal from item quantities
    const selectionSubtotal = Object.entries(selection.itemQuantities).reduce((itemSum, [itemId, quantity]) => {
      const item = items.find(i => i.id === itemId)
      if (item) {
        return itemSum + (item.pricePerUnit * quantity)
      }
      return itemSum
    }, 0)
    return sum + selectionSubtotal + selection.tipAmount
  }, 0)

  // Calculate own active selection from local state (for instant feedback)
  const ownActiveAmount = items.reduce((sum, item) => {
    const quantity = selectedItems[item.id] || 0
    return sum + (item.pricePerUnit * quantity)
  }, 0)

  // Calculate other guests' active selections from liveSelections (realtime)
  const currentSessionId = sessionId || getOrCreateSessionId()
  const othersActiveAmount = liveSelections.reduce((sum, sel) => {
    // Skip current user's selections to avoid double counting
    if (sel.sessionId === currentSessionId) return sum

    const quantities = sel.itemQuantities as Record<string, number>
    if (!quantities) return sum

    return sum + Object.entries(quantities).reduce((itemSum, [itemId, qty]) => {
      const item = items.find(i => i.id === itemId)
      return item ? itemSum + (item.pricePerUnit * qty) : itemSum
    }, 0)
  }, 0)

  // Total active amount = own selections + others' selections
  const totalActiveAmount = ownActiveAmount + othersActiveAmount

  // Calculate remaining amount
  const remainingAmount = totalAmount - totalPaidAmount - totalActiveAmount

  // Calculate percentage for progress
  const paidPercentage = totalAmount > 0 ? (totalPaidAmount / totalAmount) * 100 : 0
  const activePercentage = totalAmount > 0 ? (totalActiveAmount / totalAmount) * 100 : 0
  const totalCoveredPercentage = Math.min(100, paidPercentage + activePercentage)

  // Calculate remaining quantities from ALL selections (both SELECTING and PAID)
  // Uses LOCAL states (selections + liveSelections) to avoid race conditions
  // EXCLUDES current user's own live selection to show what's available for them
  const calculateRemainingQuantities = () => {
    try {
      const currentSessionId = sessionId || getOrCreateSessionId()

      // Filter out current user's own live selection (but keep their PAID selections)
      const otherLiveSelections = liveSelections.filter(sel => sel.sessionId !== currentSessionId)

      // Combine PAID selections (including own) and OTHER users' live selections
      const allSelections = [...selections, ...otherLiveSelections]

      // Calculate claimed quantities per item from ALL selections (excluding own live)
      const claimed: Record<string, number> = {}
      allSelections.forEach((selection: any) => {
        const itemQuantities = selection.itemQuantities as Record<string, number> | null
        if (itemQuantities) {
          Object.entries(itemQuantities).forEach(([itemId, quantity]) => {
            claimed[itemId] = (claimed[itemId] || 0) + quantity
          })
        }
      })

      // Calculate remaining for each item
      const remaining: Record<string, number> = {}
      items.forEach(item => {
        const claimedQty = claimed[item.id] || 0
        remaining[item.id] = Math.max(0, item.quantity - claimedQty)
      })

      setRemainingQuantities(remaining)
    } catch (error) {
      console.error('Error calculating remaining quantities:', error)
    }
  }

  // Cleanup live selections for current user
  const cleanupLiveSelections = async () => {
    const currentSessionId = sessionId || getOrCreateSessionId()
    if (!currentSessionId) return

    try {
      await fetch('/api/live-selections/cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          billId,
          sessionId: currentSessionId
        })
      })
    } catch (error) {
      console.error('Error cleaning up live selections:', error)
    }
  }

  // Item management functions (Owner only)
  function startEditItem(item: BillItem) {
    setEditingItemId(item.id)
    setEditForm({
      name: item.name,
      quantity: item.quantity,
      pricePerUnit: item.pricePerUnit
    })
    setOpenMenuItemId(null)
    setError('')
  }

  function cancelEditItem() {
    setEditingItemId(null)
    setEditForm(null)
    setError('')
  }

  async function saveEditItem(itemId: string) {
    if (!editForm) return

    setLoading(true)
    setError('')

    try {
      const response = await fetch(`/api/bill-items/${itemId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(editForm),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Fehler beim Speichern')
      }

      setEditingItemId(null)
      setEditForm(null)

      // Broadcast item change to all clients
      if (supabase) {
        await supabase.channel(`bill:${billId}`).send({
          type: 'broadcast',
          event: 'item-changed',
          payload: { action: 'updated', itemId }
        })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ein Fehler ist aufgetreten')
    } finally {
      setLoading(false)
    }
  }

  async function deleteItem(itemId: string) {
    if (!confirm('Möchtest du diese Position wirklich löschen?')) {
      return
    }

    setOpenMenuItemId(null)
    setLoading(true)
    setError('')

    try {
      const response = await fetch(`/api/bill-items/${itemId}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Fehler beim Löschen')
      }

      // Broadcast item change to all clients
      if (supabase) {
        await supabase.channel(`bill:${billId}`).send({
          type: 'broadcast',
          event: 'item-changed',
          payload: { action: 'deleted', itemId }
        })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ein Fehler ist aufgetreten')
    } finally {
      setLoading(false)
    }
  }

  async function addNewItem() {
    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/bill-items/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          billId,
          ...newItemForm
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Fehler beim Erstellen')
      }

      setAddingNew(false)
      setNewItemForm({ name: '', quantity: 1, pricePerUnit: 0 })

      // Broadcast item change to all clients
      if (supabase) {
        await supabase.channel(`bill:${billId}`).send({
          type: 'broadcast',
          event: 'item-changed',
          payload: { action: 'created', itemId: data.item?.id }
        })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ein Fehler ist aufgetreten')
    } finally {
      setLoading(false)
    }
  }

  // Format quantity as fraction if applicable
  function formatQuantity(quantity: number): string {
    const fractions = [
      { value: 1/3, label: '1/3' },
      { value: 1/4, label: '1/4' },
      { value: 1/5, label: '1/5' },
      { value: 1/6, label: '1/6' },
      { value: 1/7, label: '1/7' },
      { value: 1/8, label: '1/8' },
      { value: 1/9, label: '1/9' },
      { value: 1/10, label: '1/10' },
      { value: 1/2, label: '1/2' },
      { value: 2/3, label: '2/3' },
      { value: 3/4, label: '3/4' },
    ]

    // Check if quantity matches a common fraction (with small tolerance for floating point errors)
    for (const fraction of fractions) {
      if (Math.abs(quantity - fraction.value) < 0.001) {
        return fraction.label
      }
    }

    // Return as decimal if not a common fraction
    return quantity.toString()
  }

  // Generate quantity options based on remaining quantity
  function getQuantityOptions(remainingQty: number): number[] {
    if (remainingQty === 0) return []

    const options = [0]

    // Add whole numbers up to remaining quantity (all available quantities)
    const maxWholeNumber = Math.floor(remainingQty)
    for (let i = 1; i <= maxWholeNumber; i++) {
      options.push(i)
    }

    return options
  }

  async function handleItemQuantityChange(itemId: string, quantity: number) {
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

    // Update live selection
    const currentSessionId = sessionId || getOrCreateSessionId()
    // Get name: Use confirmed name, or fallback to bill-specific localStorage, or 'Gast'
    const billSpecificNameKey = `friendName_${billId}`
    const currentFriendName = friendName || localStorage.getItem(billSpecificNameKey) || localStorage.getItem('friendName') || 'Gast'
    if (currentSessionId) {
      try {
        await fetch('/api/live-selections/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            billId,
            itemId,
            sessionId: currentSessionId,
            guestName: currentFriendName.trim(),
            quantity
          })
        })
      } catch (error) {
        console.error('Error updating live selection:', error)
      }
    }
  }

  function handleCustomQuantityToggle(itemId: string) {
    setCustomQuantityMode((prev) => ({ ...prev, [itemId]: true }))
    setCustomQuantityInput((prev) => ({ ...prev, [itemId]: '' }))
  }

  async function handleCustomQuantityInputChange(itemId: string, value: string) {
    setCustomQuantityInput((prev) => ({ ...prev, [itemId]: value }))
    const numValue = parseFloat(value)
    const remainingQty = remainingQuantities[itemId]

    let finalQuantity = 0

    if (!isNaN(numValue) && numValue > 0) {
      // Limit to remaining quantity and round to 2 decimal places
      const clampedValue = parseFloat(Math.min(numValue, remainingQty).toFixed(2))
      setSelectedItems((prev) => ({ ...prev, [itemId]: clampedValue }))
      finalQuantity = clampedValue
    } else if (value === '') {
      setSelectedItems((prev) => {
        const newItems = { ...prev }
        delete newItems[itemId]
        return newItems
      })
      finalQuantity = 0
    }

    // Update live selection
    const currentSessionId = sessionId || getOrCreateSessionId()
    // Get name: Use confirmed name, or fallback to bill-specific localStorage, or 'Gast'
    const billSpecificNameKey = `friendName_${billId}`
    const currentFriendName = friendName || localStorage.getItem(billSpecificNameKey) || localStorage.getItem('friendName') || 'Gast'
    if (currentSessionId) {
      try {
        await fetch('/api/live-selections/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            billId,
            itemId,
            sessionId: currentSessionId,
            guestName: currentFriendName.trim(),
            quantity: finalQuantity
          })
        })
      } catch (error) {
        console.error('Error updating live selection:', error)
      }
    }
  }

  // Cyclic row click handler: 0 → 1 → 2 → 3 → ... → max → 0
  function handleRowClick(itemId: string) {
    const remainingQty = remainingQuantities[itemId] ?? 0
    if (remainingQty === 0) return // Can't select if nothing available

    const currentQty = selectedItems[itemId] || 0

    // Calculate next quantity (cycle through whole numbers only)
    const maxQty = Math.floor(remainingQty)
    const nextQty = currentQty >= maxQty ? 0 : currentQty + 1

    handleItemQuantityChange(itemId, nextQty)
  }

  function handleTipChange(percent: number) {
    setTipPercent(percent)
    if (percent !== -1) {
      setCustomTip('')
    }
  }

  async function handleSubmit(paymentMethod: 'PAYPAL' | 'CASH') {
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
          sessionId: sessionId || getOrCreateSessionId(),
          friendName: friendName.trim(),
          itemQuantities: selectedItems,
          tipAmount,
          paymentMethod,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Fehler beim Erstellen der Auswahl')
      }

      // Cleanup live selections before redirecting
      // (Selection is now saved in DB via API, no localStorage needed)
      await cleanupLiveSelections()

      if (isOwner) {
        // Owner confirmed selection - reset form and show success
        setSelectedItems({})
        setCustomQuantityMode({})
        setCustomQuantityInput({})
        setTipPercent(10)
        setCustomTip('')
        setLoading(false)
        // The SelectionSummary will automatically update via Supabase realtime
      } else if (paymentMethod === 'CASH') {
        // Redirect to confirmation page for cash payment
        router.push(`/split/${shareToken}/cash-confirmed?selectionId=${data.selectionId}&total=${data.totalAmount}`)
      } else {
        // Validate PayPal URL before redirect
        if (!data.paypalUrl || !(data.paypalUrl.startsWith('https://paypal.me/') || data.paypalUrl.startsWith('https://www.paypal.me/'))) {
          throw new Error('Ungültige PayPal URL')
        }
        // Open payment redirect page in new tab to keep the browser open
        // This helps ensure PayPal opens in browser instead of the PayPal app
        console.log('DEBUG - shareToken value:', shareToken)
        console.log('DEBUG - shareToken type:', typeof shareToken)
        console.log('DEBUG - payerName:', payerName)
        const redirectUrl = `/payment-redirect?amount=${data.totalAmount.toFixed(2)}&payer=${encodeURIComponent(payerName)}&token=${shareToken}&url=${encodeURIComponent(data.paypalUrl)}`
        console.log('Payment redirect URL:', redirectUrl)
        window.open(redirectUrl, '_blank', 'noopener,noreferrer')

        // Reset form after opening payment page
        setSelectedItems({})
        setCustomQuantityMode({})
        setCustomQuantityInput({})
        setTipPercent(10)
        setCustomTip('')
        setLoading(false)
        // The SelectionSummary will automatically update via Supabase realtime
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ein Fehler ist aufgetreten')
      setLoading(false)
    }
  }

  // Welcome Screen for guests (before showing items)
  if (!isOwner && !nameConfirmed) {
    return (
      <div className="space-y-4 sm:space-y-5 md:space-y-6 max-w-md mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-600 p-6 sm:p-8 space-y-6">
          {/* Welcome Header */}
          <div className="text-center space-y-3">
            <div className="text-5xl">🍽️</div>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">
              Rechnung teilen
            </h2>
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
              <span className="font-semibold text-green-600 dark:text-green-400">{payerName}</span> lädt dich ein, die Rechnung zu teilen
            </p>
          </div>

          {/* Name Input */}
          <div className="space-y-3">
            <label
              htmlFor="friendName"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Bitte gib deinen Namen ein:
            </label>
            <input
              type="text"
              id="friendName"
              value={friendName}
              onChange={(e) => setFriendName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && friendName.trim()) {
                  setNameConfirmed(true)
                }
              }}
              placeholder="Max Mustermann"
              autoFocus
              required
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 dark:focus:ring-green-400 focus:border-transparent text-base dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-400"
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Continue Button */}
          <button
            type="button"
            onClick={() => {
              if (!friendName.trim()) {
                setError('Bitte gib deinen Namen ein')
                return
              }
              setError('')
              setNameConfirmed(true)
            }}
            disabled={!friendName.trim()}
            className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 dark:bg-green-500 dark:hover:bg-green-600 dark:disabled:bg-gray-600 text-white font-semibold py-3.5 px-6 rounded-lg transition-colors text-base flex items-center justify-center gap-2"
          >
            Weiter →
          </button>

          {/* Info Text */}
          <p className="text-xs text-center text-gray-500 dark:text-gray-400">
            Dein Name wird gespeichert, damit du ihn beim nächsten Mal nicht erneut eingeben musst.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-5 md:space-y-6 pb-32">

      {/* Guest Name Display/Edit (only for guests, not owner) */}
      {!isOwner && nameConfirmed && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">Dein Name:</span>
              <span className="font-semibold text-gray-900 dark:text-gray-100">{friendName}</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setNameConfirmed(false)
                setFriendName('')
              }}
              className="text-xs text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 underline"
            >
              Name ändern
            </button>
          </div>
        </div>
      )}

      <div>
        <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 sm:mb-3">
          Was hattest du?
        </label>
        <div className="space-y-2">
          {items.map((item) => {
            // Calculate total PAID quantity for this item (ignore SELECTING)
            const paidSelectionsForItem = selections
              .filter(sel => {
                const quantities = sel.itemQuantities as Record<string, number>
                return quantities && quantities[item.id] > 0
              })

            const totalPaidForItem = paidSelectionsForItem.reduce((sum, sel) => {
              const quantities = sel.itemQuantities as Record<string, number>
              return sum + quantities[item.id]
            }, 0)

            const isFullyPaid = totalPaidForItem >= item.quantity
            const remainingQty = remainingQuantities[item.id] ?? item.quantity
            const quantityOptions = getQuantityOptions(remainingQty)

            // Get live selections for this item from unified Selection table
            const currentSessionId = sessionId || getOrCreateSessionId()
            const othersSelecting = liveSelections
              .filter(sel => {
                // Skip own session
                if (sel.sessionId === currentSessionId) return false
                // Check if item is in selection
                const quantities = sel.itemQuantities as Record<string, number>
                return quantities && quantities[item.id] > 0
              })
              .map(sel => ({
                sessionId: sel.sessionId,
                guestName: sel.friendName,
                quantity: (sel.itemQuantities as Record<string, number>)[item.id]
              }))

            // Map paid selections for badge display
            const paidSelectionsForDisplay = paidSelectionsForItem
              .map(sel => ({
                friendName: sel.friendName,
                quantity: (sel.itemQuantities as Record<string, number>)[item.id]
              }))

            // Calculate total selections for this item (PAID + SELECTING)
            const ownQuantity = selectedItems[item.id] || 0
            const othersTotal = othersSelecting.reduce((sum, u) => sum + u.quantity, 0)
            const totalLiveSelected = ownQuantity + othersTotal

            // Total claimed = PAID + all SELECTING (including own)
            const totalClaimed = totalPaidForItem + totalLiveSelected

            // Overselected if total claimed exceeds item quantity
            const isOverselected = totalClaimed > item.quantity
            const isFullyMarked = totalClaimed === item.quantity && totalClaimed > 0

            const isEditingThis = editingItemId === item.id

            return (
              <div
                key={item.id}
                className={`border rounded-lg p-2.5 sm:p-3 transition-colors relative ${
                  isFullyPaid
                    ? 'border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 opacity-60'
                    : isOverselected
                    ? 'border-red-500 dark:border-red-600 bg-red-50 dark:bg-red-900/20'
                    : isFullyMarked
                    ? 'border-green-500 dark:border-green-600 bg-green-50 dark:bg-green-900/20'
                    : customQuantityMode[item.id] || isEditingThis
                    ? 'border-gray-200 dark:border-gray-600 dark:bg-gray-700/50'
                    : 'border-gray-200 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 dark:bg-gray-700/50 cursor-pointer'
                }`}
                onClick={(e) => {
                  // Don't trigger if clicking on interactive elements (buttons, inputs)
                  const target = e.target as HTMLElement
                  if (target.tagName === 'BUTTON' || target.tagName === 'INPUT' || target.closest('button') || target.closest('input')) {
                    return
                  }
                  // Don't trigger in custom quantity mode or when editing
                  if (customQuantityMode[item.id] || isEditingThis) {
                    return
                  }
                  // Don't trigger if fully paid
                  if (isFullyPaid) {
                    return
                  }
                  // Cycle through quantities: 0 → 1 → 2 → ... → max → 0
                  handleRowClick(item.id)
                }}
              >
                {isEditingThis && editForm ? (
                  // Edit Mode
                  <div className="space-y-3">
                    <h3 className="font-medium text-gray-900 dark:text-gray-100 text-sm">Position bearbeiten</h3>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Bezeichnung
                      </label>
                      <input
                        type="text"
                        value={editForm.name}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        className="w-full px-2.5 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Anzahl
                        </label>
                        <input
                          type="number"
                          step="0.25"
                          min="0.25"
                          value={editForm.quantity}
                          onChange={(e) => setEditForm({ ...editForm, quantity: parseFloat(e.target.value) || 0 })}
                          className="w-full px-2.5 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Preis/Einheit
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={editForm.pricePerUnit}
                          onChange={(e) => setEditForm({ ...editForm, pricePerUnit: parseFloat(e.target.value) || 0 })}
                          className="w-full px-2.5 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
                        />
                      </div>
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-300">
                      Gesamtpreis: {formatEUR(editForm.quantity * editForm.pricePerUnit)}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => saveEditItem(item.id)}
                        disabled={loading}
                        className="flex-1 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 dark:bg-purple-500 dark:hover:bg-purple-600 dark:disabled:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors"
                      >
                        {loading ? 'Speichern...' : 'Speichern'}
                      </button>
                      <button
                        onClick={cancelEditItem}
                        disabled={loading}
                        className="flex-1 px-3 py-1.5 bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 dark:bg-gray-600 dark:hover:bg-gray-500 dark:disabled:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg text-sm font-medium transition-colors"
                      >
                        Abbrechen
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Menu Button (Owner only) */}
                    {isOwner && (
                      <div className="absolute top-2 right-2 z-10" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setOpenMenuItemId(openMenuItemId === item.id ? null : item.id)
                          }}
                          className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                          title="Aktionen"
                        >
                          <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                          </svg>
                        </button>
                        {openMenuItemId === item.id && (
                          <div className="absolute right-0 mt-1 w-40 bg-white dark:bg-gray-700 rounded-lg shadow-lg border border-gray-200 dark:border-gray-600 overflow-hidden z-20">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                startEditItem(item)
                              }}
                              className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                            >
                              ✏️ Bearbeiten
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                deleteItem(item.id)
                              }}
                              className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                            >
                              🗑️ Löschen
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Selection Badges (Live + Paid) */}
                    {(() => {
                      // Build all badges array
                      const allBadges: Array<{ type: 'own' | 'live' | 'paid', data: any }> = []

                      // Add own selection badge
                      if (selectedItems[item.id] > 0) {
                        allBadges.push({ type: 'own', data: { quantity: selectedItems[item.id] } })
                      }

                      // Add other guests' live selections
                      othersSelecting.forEach(user => {
                        allBadges.push({ type: 'live', data: user })
                      })

                      // Add paid selections
                      paidSelectionsForDisplay.forEach(sel => {
                        allBadges.push({ type: 'paid', data: sel })
                      })

                      if (allBadges.length === 0) return null

                      const MAX_VISIBLE = 2
                      const showMore = allBadges.length > 3
                      const visibleBadges = showMore ? allBadges.slice(0, MAX_VISIBLE) : allBadges
                      const remainingCount = allBadges.length - MAX_VISIBLE

                      return (
                        <div className={`absolute top-2 ${isOwner ? 'right-10' : 'right-2'} flex flex-col gap-1 items-end max-w-[50%]`}>
                          {visibleBadges.map((badge, idx) => {
                            if (badge.type === 'own') {
                              return (
                                <div key={`own-${idx}`} className="bg-green-500 dark:bg-green-600 text-white text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                                  <span className="font-medium">{friendName || 'Ich'}</span>
                                  <span className="opacity-90">({formatQuantity(badge.data.quantity)}×)</span>
                                </div>
                              )
                            } else if (badge.type === 'live') {
                              return (
                                <div key={`live-${idx}`} className="bg-blue-500 dark:bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                                  <span className="font-medium">{badge.data.guestName}</span>
                                  <span className="opacity-90">({formatQuantity(badge.data.quantity)}×)</span>
                                </div>
                              )
                            } else {
                              return (
                                <div key={`paid-${idx}`} className="bg-emerald-700 dark:bg-emerald-800 text-white text-xs px-2 py-0.5 rounded-full flex items-center gap-1" title="Bezahlt">
                                  <span className="text-[10px]">✓</span>
                                  <span className="font-medium">{badge.data.friendName}</span>
                                  <span className="opacity-90">({formatQuantity(badge.data.quantity)}×)</span>
                                </div>
                              )
                            }
                          })}

                          {showMore && (
                            <div className="bg-gray-500 dark:bg-gray-600 text-white text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                              <span className="font-medium">+{remainingCount} weitere</span>
                            </div>
                          )}
                        </div>
                      )
                    })()}

                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1 pr-2">
                        <div className="flex items-center gap-2">
                          {isFullyMarked && !isOverselected && (
                            <span className="text-green-600 dark:text-green-400 text-lg">✓</span>
                          )}
                          <h3 className="font-medium text-gray-900 dark:text-gray-100 text-sm sm:text-base">
                            {item.name}
                          </h3>
                          {isFullyPaid && (
                            <span className="px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-xs font-medium rounded">
                              Bezahlt
                            </span>
                          )}
                        </div>
                        <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                          {item.quantity}x à {formatEUR(item.pricePerUnit)} ={' '}
                          {formatEUR(item.totalPrice)}
                        </p>
                      </div>
                    </div>
                  </>
                )}

                {/* Overselection Warning */}
                {!isEditingThis && isOverselected && (
                  <div className="mb-3 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <div className="flex items-start gap-2">
                      <span className="text-red-600 dark:text-red-400 text-sm">⚠️</span>
                      <div className="flex-1">
                        <p className="text-xs sm:text-sm text-red-700 dark:text-red-400 font-medium">
                          Zu viel ausgewählt!
                        </p>
                        <p className="text-xs text-red-600 dark:text-red-500 mt-0.5">
                          {totalClaimed}x insgesamt ausgewählt, aber nur {item.quantity}x verfügbar.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {!isFullyPaid && !isEditingThis && (
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
                          Anteilig
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
                              // Use fraction value directly (1/4 of 1 portion, not of total quantity)
                              // Round to 2 decimal places
                              const actualValue = parseFloat(Math.min(fraction.value, remainingQty).toFixed(2))
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
                              placeholder="Anzahl Personen"
                              onChange={(e) => {
                                const persons = parseInt(e.target.value)
                                if (!isNaN(persons) && persons > 1) {
                                  // Round to 2 decimal places
                                  const value = parseFloat(Math.min(item.quantity / persons, remainingQty).toFixed(2))
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

          {/* Add New Item (Owner only) */}
          {isOwner && (
            addingNew ? (
              <div className="border-2 border-dashed border-purple-300 dark:border-purple-600 rounded-lg p-3 bg-purple-50 dark:bg-purple-900/20">
                <h3 className="font-medium text-gray-900 dark:text-gray-100 text-sm mb-3">Neue Position hinzufügen</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Bezeichnung
                    </label>
                    <input
                      type="text"
                      value={newItemForm.name}
                      onChange={(e) => setNewItemForm({ ...newItemForm, name: e.target.value })}
                      placeholder="z.B. Pizza Margherita"
                      className="w-full px-2.5 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Anzahl
                      </label>
                      <input
                        type="number"
                        step="0.25"
                        min="0.25"
                        value={newItemForm.quantity}
                        onChange={(e) => setNewItemForm({ ...newItemForm, quantity: parseFloat(e.target.value) || 0 })}
                        className="w-full px-2.5 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Preis pro Einheit
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={newItemForm.pricePerUnit}
                        onChange={(e) => setNewItemForm({ ...newItemForm, pricePerUnit: parseFloat(e.target.value) || 0 })}
                        className="w-full px-2.5 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
                      />
                    </div>
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-300">
                    Gesamtpreis: {formatEUR(newItemForm.quantity * newItemForm.pricePerUnit)}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={addNewItem}
                      disabled={loading || !newItemForm.name.trim()}
                      className="flex-1 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 dark:bg-purple-500 dark:hover:bg-purple-600 dark:disabled:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      {loading ? 'Hinzufügen...' : 'Hinzufügen'}
                    </button>
                    <button
                      onClick={() => {
                        setAddingNew(false)
                        setNewItemForm({ name: '', quantity: 1, pricePerUnit: 0 })
                        setError('')
                      }}
                      disabled={loading}
                      className="flex-1 px-3 py-1.5 bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 dark:bg-gray-600 dark:hover:bg-gray-500 dark:disabled:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg text-sm font-medium transition-colors"
                    >
                      Abbrechen
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setAddingNew(true)}
                className="w-full border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-3 text-gray-600 dark:text-gray-300 hover:border-purple-400 dark:hover:border-purple-500 hover:text-purple-600 dark:hover:text-purple-400 transition-colors text-sm font-medium"
              >
                + Neue Position hinzufügen
              </button>
            )
          )}
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
      </div>

      {/* Info Box - Payment Explanation */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 sm:p-4">
        <div className="flex items-start gap-2">
          <span className="text-blue-600 dark:text-blue-400 text-lg">ℹ️</span>
          <p className="text-xs sm:text-sm text-blue-800 dark:text-blue-300 flex-1">
            <span className="font-semibold">{payerName}</span> bezahlt die Gesamtrechnung und du bezahlst deinen Anteil direkt an <span className="font-semibold">{payerName}</span>
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-3 py-2.5 sm:px-4 sm:py-3 rounded-lg text-xs sm:text-sm">
          {error}
        </div>
      )}

      {/* Payment Buttons */}
      {isOwner ? (
        <button
          type="button"
          onClick={() => handleSubmit('CASH')}
          disabled={loading || total === 0}
          className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 dark:bg-purple-500 dark:hover:bg-purple-600 dark:disabled:bg-gray-600 text-white font-semibold py-3 sm:py-4 px-4 sm:px-6 rounded-lg transition-colors text-base sm:text-lg flex items-center justify-center gap-2"
        >
          {loading ? (
            'Wird gespeichert...'
          ) : (
            <>
              ✓ Auswahl bestätigen {total > 0 && `• ${formatEUR(total)}`}
            </>
          )}
        </button>
      ) : (
        <div className="space-y-3">
          {paypalHandle && (
            <button
              type="button"
              onClick={() => handleSubmit('PAYPAL')}
              disabled={loading || total === 0}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 dark:bg-blue-500 dark:hover:bg-blue-600 dark:disabled:bg-gray-600 text-white font-semibold py-3 sm:py-4 px-4 sm:px-6 rounded-lg transition-colors text-base sm:text-lg flex items-center justify-center gap-2"
            >
              {loading ? (
                'Weiterleitung...'
              ) : (
                <>
                  💳 Mit PayPal bezahlen {total > 0 && `• ${formatEUR(total)}`}
                </>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={() => handleSubmit('CASH')}
            disabled={loading || total === 0}
            className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 dark:bg-green-500 dark:hover:bg-green-600 dark:disabled:bg-gray-600 text-white font-semibold py-3 sm:py-4 px-4 sm:px-6 rounded-lg transition-colors text-base sm:text-lg flex items-center justify-center gap-2"
          >
            {loading ? (
              'Weiterleitung...'
            ) : (
              <>
                💵 Bar bezahlen {total > 0 && `• ${formatEUR(total)}`}
              </>
            )}
          </button>
        </div>
      )}

      {/* Fixed Bottom Summary - Bill Split Progress */}
      <div className="fixed bottom-0 left-0 right-0 z-50 px-4 sm:px-5 md:px-6 py-2.5 sm:py-3 bg-white dark:bg-gray-800 border-t-2 border-gray-200 dark:border-gray-600 shadow-lg">
        <div className="space-y-2">
          {/* Progress Bar with Percentage Inside */}
          <div className="relative w-full bg-gray-200 dark:bg-gray-700 rounded-full h-6 sm:h-7 overflow-hidden shadow-inner">
            <div
              className="h-full bg-gradient-to-r from-green-500 via-green-500 to-blue-500 dark:from-green-600 dark:via-green-600 dark:to-blue-600 transition-all duration-500 flex items-center justify-center"
              style={{ width: `${totalCoveredPercentage}%` }}
            >
              {totalCoveredPercentage > 15 && (
                <span className="text-xs sm:text-sm font-bold text-white drop-shadow-md">
                  {totalCoveredPercentage.toFixed(0)}%
                </span>
              )}
            </div>
            {totalCoveredPercentage <= 15 && (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xs sm:text-sm font-bold text-gray-600 dark:text-gray-300">
                  {totalCoveredPercentage.toFixed(0)}%
                </span>
              </div>
            )}
          </div>

          {/* Compact Summary - 2 Columns */}
          <div className="grid grid-cols-2 gap-2 text-center text-xs sm:text-sm">
            <div>
              <span className="text-gray-600 dark:text-gray-400">Deine Auswahl: </span>
              <span className="font-bold text-green-600 dark:text-green-400">{formatEUR(ownActiveAmount)}</span>
            </div>
            <div className={`font-bold ${
              remainingAmount === 0 && totalPaidAmount > 0
                ? 'text-green-600 dark:text-green-400'
                : remainingAmount > 0
                ? 'text-orange-600 dark:text-orange-400'
                : 'text-red-600 dark:text-red-400'
            }`}>
              {remainingAmount === 0 && totalPaidAmount > 0
                ? '✓ Vollständig aufgeteilt!'
                : remainingAmount > 0
                ? `Noch offen: ${formatEUR(remainingAmount)} / ${formatEUR(totalAmount)}`
                : `❗ Überbucht: ${formatEUR(Math.abs(remainingAmount))}`
              }
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
