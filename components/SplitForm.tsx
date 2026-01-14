'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { formatEUR } from '@/lib/utils'
import { saveSelection } from '@/lib/selectionStorage'
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

interface ActiveSelection {
  id: string
  billId: string
  itemId: string
  sessionId: string
  guestName: string
  quantity: number
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
  paypalHandle: string
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
  const [selectedItems, setSelectedItems] = useState<Record<string, number>>({})
  const [customQuantityMode, setCustomQuantityMode] = useState<Record<string, boolean>>({})
  const [customQuantityInput, setCustomQuantityInput] = useState<Record<string, string>>({})
  const [tipPercent, setTipPercent] = useState(0)
  const [customTip, setCustomTip] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [liveSelections, setLiveSelections] = useState<Map<string, ActiveSelection[]>>(new Map())
  const [remainingQuantities, setRemainingQuantities] = useState<Record<string, number>>(itemRemainingQuantities)
  const [animatingItems, setAnimatingItems] = useState<Set<string>>(new Set())

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

  // Use ref to track if this is the first fetch (doesn't trigger re-renders)
  const isFirstFetch = useRef(true)
  // Store previous selections snapshot for comparison
  const prevSelectionsSnapshot = useRef<Map<string, Map<string, number>>>(new Map())
  // Track if we've restored selections yet
  const hasRestoredSelections = useRef(false)

  // LocalStorage keys for persisting selections
  const getSelectionStorageKey = () => `billSelection_${billId}_${friendName.trim()}`

  // Initialize sessionId on mount
  useEffect(() => {
    const sid = getOrCreateSessionId()
    setSessionId(sid)
  }, [])

  // Load friendName from localStorage on mount (or set to payerName if owner)
  useEffect(() => {
    if (isOwner) {
      setFriendName(payerName)
    } else {
      const savedFriendName = localStorage.getItem('friendName')
      if (savedFriendName) {
        setFriendName(savedFriendName)
      }
    }
  }, [isOwner, payerName])

  // Save friendName to localStorage whenever it changes
  useEffect(() => {
    if (friendName.trim()) {
      localStorage.setItem('friendName', friendName.trim())
    }
  }, [friendName])

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

  // Restore selections from localStorage when friendName is ready
  useEffect(() => {
    // Only run once after friendName is loaded
    if (hasRestoredSelections.current || !friendName.trim()) {
      return
    }

    try {
      const storageKey = getSelectionStorageKey()
      const savedData = localStorage.getItem(storageKey)

      if (savedData) {
        const parsed = JSON.parse(savedData)

        if (parsed.selectedItems && Object.keys(parsed.selectedItems).length > 0) {
          // Filter out items with quantity 0 (should not be restored)
          const filteredItems: Record<string, number> = {}
          Object.entries(parsed.selectedItems).forEach(([itemId, quantity]) => {
            if (typeof quantity === 'number' && quantity > 0) {
              filteredItems[itemId] = quantity
            }
          })

          // Only restore if there are valid items
          if (Object.keys(filteredItems).length > 0) {
            setSelectedItems(filteredItems)
            setCustomQuantityMode(parsed.customQuantityMode || {})
            setCustomQuantityInput(parsed.customQuantityInput || {})
          }
        }
      }
    } catch (error) {
      console.error('Error restoring selections from localStorage:', error)
    }

    // Mark as restored
    hasRestoredSelections.current = true
  }, [friendName, billId])

  // Save selections to localStorage whenever they change
  useEffect(() => {
    if (!friendName.trim()) {
      return
    }

    const storageKey = getSelectionStorageKey()

    try {
      // If no items selected, remove from localStorage
      if (Object.keys(selectedItems).length === 0) {
        localStorage.removeItem(storageKey)
        return
      }

      // Save to localStorage
      const dataToSave = {
        selectedItems,
        customQuantityMode,
        customQuantityInput,
        timestamp: new Date().toISOString()
      }
      localStorage.setItem(storageKey, JSON.stringify(dataToSave))
    } catch (error) {
      console.error('Error saving selections to localStorage:', error)
    }
  }, [selectedItems, customQuantityMode, customQuantityInput, friendName, billId])

  // Fetch live selections and detect changes
  const fetchLiveSelections = async () => {
    try {
      const response = await fetch(`/api/bills/${billId}/live-selections`)
      const data: ActiveSelection[] = await response.json()

      const currentSessionId = sessionId || getOrCreateSessionId()

      // Filter out expired selections
      const now = new Date()
      const activeData = data.filter(sel => new Date(sel.expiresAt) > now)

      // Create current snapshot: itemId -> sessionId -> quantity
      const currentSnapshot = new Map<string, Map<string, number>>()
      activeData.forEach(sel => {
        if (!currentSnapshot.has(sel.itemId)) {
          currentSnapshot.set(sel.itemId, new Map())
        }
        currentSnapshot.get(sel.itemId)!.set(sel.sessionId, sel.quantity)
      })

      // Detect changes (only after first fetch and only for other users)
      const changedKeys = new Set<string>()
      if (!isFirstFetch.current) {
        // Check for new/changed selections
        currentSnapshot.forEach((sessions, itemId) => {
          sessions.forEach((quantity, sid) => {
            // Skip current user
            if (sid === currentSessionId) return

            const prevSessions = prevSelectionsSnapshot.current.get(itemId)
            const prevQuantity = prevSessions?.get(sid)

            if (prevQuantity === undefined && quantity > 0) {
              // New selection from another user
              changedKeys.add(`${itemId}:${sid}`)
            } else if (prevQuantity !== undefined && prevQuantity !== quantity) {
              // Quantity changed
              changedKeys.add(`${itemId}:${sid}`)
            }
          })
        })

        // Check for removed selections
        prevSelectionsSnapshot.current.forEach((sessions, itemId) => {
          sessions.forEach((prevQuantity, sid) => {
            // Skip current user
            if (sid === currentSessionId) return

            const currentSessions = currentSnapshot.get(itemId)
            const currentQuantity = currentSessions?.get(sid)

            if (currentQuantity === undefined && prevQuantity > 0) {
              // Selection removed
              changedKeys.add(`${itemId}:${sid}`)
            }
          })
        })
      }

      // Update snapshot for next comparison
      prevSelectionsSnapshot.current = currentSnapshot

      // Mark first fetch as complete (restoration now happens in separate useEffect)
      if (isFirstFetch.current) {
        isFirstFetch.current = false
      }

      // Group selections by itemId for rendering (only active ones)
      const grouped = new Map<string, ActiveSelection[]>()
      activeData.forEach(sel => {
        if (!grouped.has(sel.itemId)) {
          grouped.set(sel.itemId, [])
        }
        grouped.get(sel.itemId)!.push(sel)
      })
      setLiveSelections(grouped)

      // Trigger animations
      if (changedKeys.size > 0) {
        setAnimatingItems(changedKeys)
        setTimeout(() => {
          setAnimatingItems(new Set())
        }, 1000)
      }
    } catch (error) {
      console.error('Error fetching live selections:', error)
    }
  }

  // Realtime subscription for live selections and payments
  const { isConnected } = useRealtimeSubscription(billId, {
    // Initial data fetch on mount and after reconnection
    onInitialFetch: async () => {
      await fetchLiveSelections()
      calculateRemainingQuantities()
    },

    // ActiveSelection table changes (live tracking)
    onActiveSelectionChange: () => {
      fetchLiveSelections()
    },

    // Selection table changes (final payments) - recalculate remaining quantities
    onSelectionChange: () => {
      calculateRemainingQuantities()
    },

    // Item changes broadcast from owner
    onItemChange: () => {
      // Refetch live selections when items change
      fetchLiveSelections()
      calculateRemainingQuantities()
    },

    // Enable debug logging in development
    debug: process.env.NODE_ENV === 'development'
  })

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
  const totalPaidAmount = allSelections.reduce((sum, selection) => {
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
  const othersActiveAmount = Array.from(liveSelections.values()).reduce((sum, selections) => {
    return sum + selections.reduce((itemSum, sel) => {
      // Skip current user's selections to avoid double counting
      if (sel.sessionId === currentSessionId) return itemSum
      const item = items.find(i => i.id === sel.itemId)
      if (item) {
        return itemSum + (item.pricePerUnit * sel.quantity)
      }
      return itemSum
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

  // Calculate remaining quantities from selections
  const calculateRemainingQuantities = async () => {
    try {
      const response = await fetch(`/api/bills/${billId}/selections`)
      const selections = await response.json()

      // Calculate claimed quantities per item
      const claimed: Record<string, number> = {}
      selections.forEach((selection: any) => {
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
    const currentFriendName = friendName || localStorage.getItem('friendName') || 'Gast'
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
      // Limit to remaining quantity
      const clampedValue = Math.min(numValue, remainingQty)
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
    const currentFriendName = friendName || localStorage.getItem('friendName') || 'Gast'
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

      // Save selection to localStorage for future reference
      saveSelection({
        selectionId: data.selectionId,
        billId,
        shareToken,
        friendName: friendName.trim(),
        itemQuantities: selectedItems,
        subtotal,
        tipAmount,
        totalAmount: total,
        paymentMethod,
        createdAt: new Date().toISOString(),
      })

      // Cleanup live selections and localStorage before redirecting
      await cleanupLiveSelections()

      // Clear localStorage selection after successful submit
      try {
        const storageKey = getSelectionStorageKey()
        localStorage.removeItem(storageKey)
      } catch (error) {
        console.error('Error clearing selection from localStorage:', error)
      }

      if (isOwner) {
        // Owner confirmed selection - reset form and show success
        setSelectedItems({})
        setCustomQuantityMode({})
        setCustomQuantityInput({})
        setTipPercent(0)
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
        const redirectUrl = `/payment-redirect?url=${encodeURIComponent(data.paypalUrl)}&amount=${data.totalAmount.toFixed(2)}`
        window.open(redirectUrl, '_blank', 'noopener,noreferrer')

        // Reset form after opening payment page
        setSelectedItems({})
        setCustomQuantityMode({})
        setCustomQuantityInput({})
        setTipPercent(0)
        setCustomTip('')
        setLoading(false)
        // The SelectionSummary will automatically update via Supabase realtime
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ein Fehler ist aufgetreten')
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4 sm:space-y-5 md:space-y-6 pb-32">
      {!isOwner && (
        <div>
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
      )}

      <div>
        <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 sm:mb-3">
          Was hattest du?
        </label>
        <div className="space-y-2">
          {items.map((item) => {
            const remainingQty = remainingQuantities[item.id] ?? item.quantity
            const isFullyClaimed = remainingQty === 0
            const quantityOptions = getQuantityOptions(remainingQty)

            // Get live selections for this item (excluding current user and quantity 0)
            const liveUsers = liveSelections.get(item.id) || []
            const currentSessionId = sessionId || getOrCreateSessionId()
            const othersSelecting = liveUsers.filter(u =>
              u.sessionId !== currentSessionId && u.quantity > 0
            )

            // Calculate total live selections for this item (including current user)
            const totalLiveSelected = liveUsers.reduce((sum, u) => sum + u.quantity, 0)
            const isOverselected = totalLiveSelected > remainingQty
            const isFullyMarked = totalLiveSelected === remainingQty && totalLiveSelected > 0

            const isEditingThis = editingItemId === item.id

            return (
              <div
                key={item.id}
                className={`border rounded-lg p-2.5 sm:p-3 transition-colors relative ${
                  isFullyClaimed
                    ? 'border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 opacity-60'
                    : isOverselected
                    ? 'border-red-500 dark:border-red-600 bg-red-50 dark:bg-red-900/20'
                    : isFullyMarked
                    ? 'border-green-500 dark:border-green-600 bg-green-50 dark:bg-green-900/20'
                    : 'border-gray-200 dark:border-gray-600 hover:border-green-300 dark:hover:border-green-500 dark:bg-gray-700/50 cursor-pointer'
                }`}
                onClick={(e) => {
                  // Don't auto-select if clicking on interactive elements (buttons, inputs)
                  const target = e.target as HTMLElement
                  if (target.tagName === 'BUTTON' || target.tagName === 'INPUT' || target.closest('button') || target.closest('input')) {
                    return
                  }
                  // Auto-select as 1x when clicking on unselected item
                  if ((!selectedItems[item.id] || selectedItems[item.id] === 0) && !isFullyClaimed && remainingQty >= 1) {
                    handleItemQuantityChange(item.id, 1)
                  }
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

                    {/* Live Selection Badges */}
                    {othersSelecting.length > 0 && (
                      <div className={`absolute top-2 ${isOwner ? 'right-10' : 'right-2'} flex flex-wrap gap-1 justify-end max-w-[50%]`}>
                        {othersSelecting.map((user, idx) => {
                          // Animation should only show for other guests, not for the user who made the change
                          const shouldAnimate = animatingItems.has(`${item.id}:${user.sessionId}`)
                          return (
                            <div
                              key={idx}
                              className={`bg-blue-500 dark:bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full flex items-center gap-1 ${
                                shouldAnimate ? 'animate-bounce-subtle' : ''
                              }`}
                            >
                              <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                              <span className="font-medium">{user.guestName}</span>
                              <span className="opacity-90">({user.quantity}×)</span>
                            </div>
                          )
                        })}
                      </div>
                    )}

                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1 pr-2">
                        <div className="flex items-center gap-2">
                          {isFullyMarked && !isOverselected && (
                            <span className="text-green-600 dark:text-green-400 text-lg">✓</span>
                          )}
                          <h3 className="font-medium text-gray-900 dark:text-gray-100 text-sm sm:text-base">
                            {item.name}
                          </h3>
                          {isFullyClaimed && (
                            <span className="px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-xs font-medium rounded">
                              Bereits bezahlt
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
                          {totalLiveSelected}x ausgewählt, aber nur {item.quantity}x verfügbar.
                          Bitte koordiniert euch.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {!isFullyClaimed && !isEditingThis && (
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
        <p className="text-xs text-gray-500 dark:text-gray-400 text-center pt-1">
          Zahlung an {payerName}
        </p>
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
            <div className="text-gray-600 dark:text-gray-400">
              Gesamt: <span className="font-bold text-gray-900 dark:text-gray-100">{formatEUR(totalAmount)}</span>
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
                ? `Noch offen: ${formatEUR(remainingAmount)}`
                : `❗ Überbucht: ${formatEUR(Math.abs(remainingAmount))}`
              }
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
