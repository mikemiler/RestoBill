'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { formatEUR, generatePayPalUrlWithoutAmount, formatAmountForPayPal } from '@/lib/utils'
import { getOrCreateSessionId } from '@/lib/sessionStorage'
import { useRealtimeSubscription, useDebounce } from '@/lib/hooks'
import { debugLog, debugError } from '@/lib/debug'
import EditableGuestName from './EditableGuestName'
import EditablePayerName from './EditablePayerName'

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
  paymentMethod: 'PAYPAL' | 'CASH' | null  // null = still selecting (live selection)
  status: 'SELECTING' | 'PAID'
  sessionId?: string  // Optional - only present for live selections
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
  const [amountCopied, setAmountCopied] = useState(false)
  const [liveSelections, setLiveSelections] = useState<LiveSelection[]>([])
  const [remainingQuantities, setRemainingQuantities] = useState<Record<string, number>>(itemRemainingQuantities)
  const [selections, setSelections] = useState<DatabaseSelection[]>(allSelections)

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
    pricePerUnit: 10
  })
  const [isItemsExpanded, setIsItemsExpanded] = useState(true) // Collapsible for items list

  // Track if we've restored selections yet
  const hasRestoredSelections = useRef(false)

  // Initialize sessionId on mount
  useEffect(() => {
    const sid = getOrCreateSessionId()
    setSessionId(sid)
  }, [])

  // DEBUG: Track items prop changes
  useEffect(() => {
    debugLog('🔍 [SplitForm DEBUG] ===== ITEMS PROP CHANGED =====')
    debugLog('[SplitForm DEBUG] Items received from parent:', {
      itemsCount: items.length,
      itemsData: items.map(item => ({
        id: item.id,
        name: item.name,
        quantity: item.quantity,
        pricePerUnit: item.pricePerUnit,
        totalPrice: item.totalPrice
      }))
    })
    debugLog('🔍 [SplitForm DEBUG] ===== ITEMS PROP CHANGED END =====')
  }, [items])

  // Sync allSelections prop with selections state
  // This is the SINGLE SOURCE OF TRUTH for PAID selections
  // SplitFormContainer fetches PAID selections via Realtime and passes them as props
  // This avoids duplicate API calls and race conditions
  useEffect(() => {
    debugLog('[SplitForm] Syncing allSelections prop to state (PAID selections):', {
      propLength: allSelections.length,
      stateLength: selections.length,
      propData: allSelections.map(s => ({
        id: s.id,
        friendName: s.friendName,
        itemCount: Object.keys(s.itemQuantities || {}).length
      }))
    })
    setSelections(allSelections)
  }, [allSelections])

  // Load friendName from localStorage on mount (or set to payerName if owner)
  useEffect(() => {
    if (isOwner) {
      setFriendName(payerName)
      setNameConfirmed(true) // Owner skips welcome screen
    } else {
      const savedFriendName = localStorage.getItem('friendName')
      if (savedFriendName) {
        setFriendName(savedFriendName)
        setNameConfirmed(true) // Returning guest skips welcome screen
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
        debugError('Error restoring selections from DB:', error)
      }
    }

    restoreFromLiveSelections()

    // Mark as restored
    hasRestoredSelections.current = true
  }, [friendName, billId, sessionId])

  // NOTE: PAID selections are fetched by SplitFormContainer and passed as props (allSelections)
  // This avoids duplicate state management and race conditions
  // We only sync the props to local state via useEffect below

  // Fetch live selections (unified Selection with status='SELECTING')
  const fetchLiveSelections = async () => {
    try {
      debugLog('[SplitForm] Fetching live selections...')
      const response = await fetch(`/api/bills/${billId}/live-selections`)
      const data: LiveSelection[] = await response.json()

      // Filter out expired selections and empty selections (no items selected)
      const now = new Date()
      const activeData = data.filter(sel => {
        const hasItems = Object.keys(sel.itemQuantities || {}).length > 0
        const notExpired = new Date(sel.expiresAt) > now
        return hasItems && notExpired
      })

      debugLog('[SplitForm] Live selections fetched:', {
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
      debugError('Error fetching live selections:', error)
    }
  }

  // Realtime subscription for live selections (SELECTING status only)
  // PAID selections are handled by SplitFormContainer's subscription
  // CRITICAL: Use unique channel suffix to avoid conflicts with StatusPageClient's subscription
  const { isConnected } = useRealtimeSubscription(billId, {
    // Initial data fetch on mount and after reconnection
    onInitialFetch: async () => {
      debugLog('[SplitForm] Initial fetch: loading live selections (SELECTING status)')
      // PAID selections come from props (SplitFormContainer fetches them)
      // We only need to fetch SELECTING selections here
      await fetchLiveSelections()
      // calculateRemainingQuantities() will be called by useEffect when selections state updates
    },

    // NO onSelectionChange - Container handles PAID updates!
    // This prevents race conditions where both components fetch simultaneously

    // onActiveSelectionChange: For SELECTING status updates only
    // The hook now intelligently routes SELECTING updates here and PAID updates to Container
    onActiveSelectionChange: async () => {
      debugLog('[SplitForm] Active selection change: updating live selections (SELECTING status)')
      await fetchLiveSelections()
    },

    // Item changes are handled by SplitFormContainer - no action needed here

    // Unique channel suffix to avoid conflicts with other subscriptions
    channelSuffix: 'form',

    // Enable debug logging in development
    debug: process.env.NODE_ENV === 'development'
  })

  // Auto-recalculate remaining quantities when selections or liveSelections change
  // This prevents race conditions by using the actual state values
  useEffect(() => {
    debugLog('🎯 [SplitForm DEBUG] ===== RECALCULATE TRIGGERED =====')
    debugLog('[SplitForm DEBUG] State values that triggered recalculation:', {
      selectionsCount: selections.length,
      liveSelectionsCount: liveSelections.length,
      itemsCount: items.length,
      itemsDetails: items.map(item => ({
        id: item.id,
        name: item.name,
        quantity: item.quantity,
        pricePerUnit: item.pricePerUnit
      }))
    })
    debugLog('[SplitForm DEBUG] Calling calculateRemainingQuantities()...')
    calculateRemainingQuantities()
    debugLog('🎯 [SplitForm DEBUG] ===== RECALCULATE TRIGGERED END =====')
  }, [selections, liveSelections, items])

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

  // Calculate total confirmed amount (paid=true only)
  // Note: All selections have status=SELECTING now
  // IMPORTANT: Only count ITEMS, not tips, because totalAmount is the bill total (no tips)
  // CRITICAL: Exclude owner's own live selection to prevent double counting
  const currentSessionId = sessionId || getOrCreateSessionId()
  const totalPaidAmount = selections
    .filter(sel => {
      // Skip owner's own live selection (paymentMethod=null means still selecting)
      const isOwnLiveSelection = sel.paymentMethod === null &&
        'sessionId' in sel &&
        (sel as any).sessionId === currentSessionId

      // Only count paid selections that are NOT owner's own live selection
      return sel.paid === true && !isOwnLiveSelection
    })
    .reduce((sum, selection) => {
      // Calculate selection subtotal from item quantities (WITHOUT tip)
      const selectionSubtotal = Object.entries(selection.itemQuantities).reduce((itemSum, [itemId, quantity]) => {
        const item = items.find(i => i.id === itemId)
        if (item) {
          return itemSum + (item.pricePerUnit * quantity)
        }
        return itemSum
      }, 0)
      // Don't add tipAmount here - we're comparing against bill total
      return sum + selectionSubtotal
    }, 0)

  // Calculate own active selection from local state (for instant feedback)
  const ownActiveAmount = items.reduce((sum, item) => {
    const quantity = selectedItems[item.id] || 0
    return sum + (item.pricePerUnit * quantity)
  }, 0)

  // Calculate other guests' active selections from liveSelections (realtime)
  // Note: currentSessionId already defined above
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

  // Calculate remaining amount (display only will be rounded)
  const remainingAmount = totalAmount - totalPaidAmount - totalActiveAmount

  // Calculate percentage for progress
  const paidPercentage = totalAmount > 0 ? (totalPaidAmount / totalAmount) * 100 : 0
  const activePercentage = totalAmount > 0 ? (totalActiveAmount / totalAmount) * 100 : 0
  const totalCoveredPercentage = Math.min(100, paidPercentage + activePercentage)

  // Calculate remaining quantities from ALL selections (both SELECTING and PAID)
  // Uses LOCAL states (selections + liveSelections) to avoid race conditions
  // EXCLUDES current user's own live selection to show what's available for them
  const calculateRemainingQuantities = () => {
    debugLog('⚙️ [SplitForm DEBUG] ===== CALCULATE REMAINING QUANTITIES START =====')
    debugLog('[SplitForm DEBUG] Input data for calculation:', {
      itemsCount: items.length,
      itemsUsedInCalc: items.map(item => ({
        id: item.id,
        name: item.name,
        quantity: item.quantity,
        pricePerUnit: item.pricePerUnit
      })),
      selectionsCount: selections.length,
      liveSelectionsCount: liveSelections.length
    })
    try {
      const currentSessionId = sessionId || getOrCreateSessionId()

      // CRITICAL: Filter out current user's own live selection from BOTH sources
      // selections prop contains ALL selections (including own live selection with paymentMethod=null)
      // We need to exclude own live selection but keep own submitted selections (paymentMethod set)
      const otherSelections = selections.filter(sel => {
        const isOwnLiveSelection = sel.paymentMethod === null &&
          'sessionId' in sel &&
          (sel as any).sessionId === currentSessionId
        return !isOwnLiveSelection
      })

      // Filter out current user's own live selection from liveSelections
      const otherLiveSelections = liveSelections.filter(sel => sel.sessionId !== currentSessionId)

      // IMPORTANT: Filter out live selections that have already been converted to PAID
      // This prevents double-counting when a selection transitions from SELECTING → PAID
      // The same Selection ID exists in both lists during the transition period
      const paidSelectionIds = new Set(otherSelections.map(s => s.id))
      const validLiveSelections = otherLiveSelections.filter(sel => !paidSelectionIds.has(sel.id))

      // Combine other selections (excluding own live) and OTHER users' live selections
      const allSelections = [...otherSelections, ...validLiveSelections]

      // Calculate claimed quantities per item from ALL selections (excluding own live)
      const claimed: Record<string, number> = {}
      allSelections.forEach((selection: any) => {
        const itemQuantities = selection.itemQuantities as Record<string, number> | null
        if (itemQuantities && typeof itemQuantities === 'object') {
          Object.entries(itemQuantities).forEach(([itemId, quantity]) => {
            // Safe access: ensure quantity is a valid number
            const qty = typeof quantity === 'number' ? quantity : 0
            claimed[itemId] = (claimed[itemId] || 0) + qty
          })
        }
      })

      // Calculate remaining for each item
      const remaining: Record<string, number> = {}
      items.forEach(item => {
        const claimedQty = claimed[item.id] || 0
        remaining[item.id] = Math.max(0, item.quantity - claimedQty)
      })

      debugLog('[SplitForm] Calculated remaining quantities:', {
        originalSelectionsCount: selections.length,
        otherSelectionsCount: otherSelections.length,
        liveSelectionsCount: liveSelections.length,
        otherLiveSelectionsCount: otherLiveSelections.length,
        validLiveSelectionsCount: validLiveSelections.length,
        filteredOutCount: otherLiveSelections.length - validLiveSelections.length,
        totalSelectionsUsed: allSelections.length,
        claimed,
        remaining
      })

      setRemainingQuantities(remaining)
      debugLog('[SplitForm DEBUG] ✅ setRemainingQuantities() called with:', remaining)
      debugLog('⚙️ [SplitForm DEBUG] ===== CALCULATE REMAINING QUANTITIES END =====')
    } catch (error) {
      debugError('❌ [SplitForm DEBUG] Error calculating remaining quantities:', error)
      debugLog('⚙️ [SplitForm DEBUG] ===== CALCULATE REMAINING QUANTITIES END (ERROR) =====')
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
      { value: 1/2, label: '1/2' },
      { value: 1/3, label: '1/3' },
      { value: 2/3, label: '2/3' },
      { value: 1/4, label: '1/4' },
      { value: 3/4, label: '3/4' },
      { value: 1/5, label: '1/5' },
      { value: 2/5, label: '2/5' },
      { value: 3/5, label: '3/5' },
      { value: 4/5, label: '4/5' },
      { value: 1/6, label: '1/6' },
      { value: 1/7, label: '1/7' },
      { value: 1/8, label: '1/8' },
      { value: 1/9, label: '1/9' },
      { value: 1/10, label: '1/10' },
    ]

    // Check if quantity matches a common fraction (with small tolerance for floating point errors)
    for (const fraction of fractions) {
      if (Math.abs(quantity - fraction.value) < 0.001) {
        return fraction.label
      }
    }

    // Return as decimal if not a common fraction (rounded to 2 decimal places for display only)
    return (Math.round(quantity * 100) / 100).toString()
  }

  // Generate all possible quantity options based on original item quantity
  // Always returns the same number of options to prevent layout shifts
  function getAllQuantityOptions(itemQuantity: number): number[] {
    const options = [0]

    // Add whole numbers up to original item quantity
    const maxWholeNumber = Math.floor(itemQuantity)
    for (let i = 1; i <= maxWholeNumber; i++) {
      options.push(i)
    }

    return options
  }

  async function handleItemQuantityChange(itemId: string, quantity: number, closeCustomMode: boolean = false) {
    // Calculate new selectedItems state
    let newSelectedItems: Record<string, number>
    if (quantity === 0) {
      const { [itemId]: _, ...rest } = selectedItems
      newSelectedItems = rest
    } else {
      newSelectedItems = { ...selectedItems, [itemId]: quantity }
    }

    setSelectedItems(newSelectedItems)

    // Only close custom mode if explicitly requested (e.g., when clicking preset buttons 0x, 1x, 2x)
    if (closeCustomMode && customQuantityMode[itemId]) {
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

    // Calculate subtotal with NEW selectedItems
    const newSubtotal = items.reduce((sum, item) => {
      const qty = newSelectedItems[item.id] || 0
      return sum + item.pricePerUnit * qty
    }, 0)

    // Calculate tip amount (including default 10%)
    const calculatedTipAmount = tipPercent === -1
      ? parseFloat(customTip) || 0
      : (newSubtotal * tipPercent) / 100

    // Update live selection WITH tipAmount
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
            quantity,
            tipAmount: calculatedTipAmount // CRITICAL: Include tip amount (default 10%)
          })
        })
      } catch (error) {
        debugError('Error updating live selection:', error)
      }
    }
  }

  function handleCustomQuantityToggle(itemId: string) {
    setCustomQuantityMode((prev) => {
      const newMode = { ...prev }
      if (newMode[itemId]) {
        // Close custom mode (toggle off)
        delete newMode[itemId]
      } else {
        // Open custom mode (toggle on)
        newMode[itemId] = true
      }
      return newMode
    })

    // When opening custom mode, populate input with current selection (if any)
    if (!customQuantityMode[itemId]) {
      setCustomQuantityInput((prev) => ({
        ...prev,
        [itemId]: selectedItems[itemId] ? selectedItems[itemId].toString() : ''
      }))
    }
  }

  async function handleCustomQuantityInputChange(itemId: string, value: string) {
    setCustomQuantityInput((prev) => ({ ...prev, [itemId]: value }))
    const numValue = parseFloat(value)
    const remainingQty = remainingQuantities[itemId]

    let finalQuantity = 0
    let newSelectedItems: Record<string, number>

    if (!isNaN(numValue) && numValue > 0) {
      // Limit to remaining quantity and round to 2 decimal places
      const clampedValue = parseFloat(Math.min(numValue, remainingQty).toFixed(2))
      newSelectedItems = { ...selectedItems, [itemId]: clampedValue }
      setSelectedItems(newSelectedItems)
      finalQuantity = clampedValue
    } else if (value === '') {
      const { [itemId]: _, ...rest } = selectedItems
      newSelectedItems = rest
      setSelectedItems(newSelectedItems)
      finalQuantity = 0
    } else {
      newSelectedItems = selectedItems
    }

    // Calculate subtotal with NEW selectedItems
    const newSubtotal = items.reduce((sum, item) => {
      const qty = newSelectedItems[item.id] || 0
      return sum + item.pricePerUnit * qty
    }, 0)

    // Calculate tip amount (including default 10%)
    const calculatedTipAmount = tipPercent === -1
      ? parseFloat(customTip) || 0
      : (newSubtotal * tipPercent) / 100

    // Update live selection WITH tipAmount
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
            quantity: finalQuantity,
            tipAmount: calculatedTipAmount // CRITICAL: Include tip amount (default 10%)
          })
        })
      } catch (error) {
        debugError('Error updating live selection:', error)
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

    handleItemQuantityChange(itemId, nextQty, true)
  }

  function handleTipChange(percent: number) {
    setTipPercent(percent)
    if (percent !== -1) {
      setCustomTip('')
    }

    // Calculate new tip amount and update live selection (debounced)
    const newTipAmount = percent === -1
      ? parseFloat(customTip) || 0
      : (subtotal * percent) / 100
    debouncedTipUpdate(newTipAmount)
  }

  // Update live selection tip (debounced to prevent API spam)
  const updateLiveSelectionTip = async (tipAmount: number) => {
    const currentSessionId = sessionId || getOrCreateSessionId()
    const currentFriendName = friendName || localStorage.getItem('friendName') || 'Gast'

    if (!currentSessionId) return

    try {
      // Use dedicated tip-update endpoint (doesn't affect item quantities)
      await fetch('/api/live-selections/update-tip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          billId,
          sessionId: currentSessionId,
          guestName: currentFriendName.trim(),
          tipAmount: tipAmount
        })
      })
    } catch (error) {
      debugError('Error updating live tip:', error)
    }
  }

  // Debounced version (waits 500ms after last change)
  const debouncedTipUpdate = useDebounce(updateLiveSelectionTip, 500)


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
    <div className="space-y-4 sm:space-y-5 md:space-y-6">

      {/* Editable Guest Name - Only for guests, not owner */}
      {friendName && !isOwner && (
        <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3 sm:p-4 border border-purple-200 dark:border-purple-700">
          <EditableGuestName
            initialName={friendName}
            onNameChange={(newName) => {
              setFriendName(newName)
              // Update live selection with new name immediately
              const currentSessionId = sessionId || getOrCreateSessionId()
              if (currentSessionId && Object.keys(selectedItems).length > 0) {
                fetch('/api/live-selections/update', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    billId,
                    itemId: Object.keys(selectedItems)[0], // Any item ID, just to trigger update
                    sessionId: currentSessionId,
                    guestName: newName,
                    quantity: selectedItems[Object.keys(selectedItems)[0]],
                    tipAmount: tipPercent === -1
                      ? parseFloat(customTip) || 0
                      : (subtotal * tipPercent) / 100
                  })
                }).catch(err => console.error('Failed to update name in live selection:', err))
              }
            }}
          />
        </div>
      )}

      {/* Owner Name Display - Editable */}
      {friendName && isOwner && (
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 sm:p-4 border border-blue-200 dark:border-blue-700">
          <EditablePayerName
            billId={billId}
            initialName={friendName}
            onNameChange={(newName) => {
              setFriendName(newName)
              // Update live selection with new name immediately
              const currentSessionId = sessionId || getOrCreateSessionId()
              if (currentSessionId && Object.keys(selectedItems).length > 0) {
                fetch('/api/live-selections/update', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    billId,
                    itemId: Object.keys(selectedItems)[0],
                    sessionId: currentSessionId,
                    guestName: newName,
                    quantity: selectedItems[Object.keys(selectedItems)[0]],
                    tipAmount: tipPercent === -1
                      ? parseFloat(customTip) || 0
                      : (subtotal * tipPercent) / 100
                  })
                }).catch(err => console.error('Failed to update name in live selection:', err))
              }
            }}
          />
        </div>
      )}

      <div>
        <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 sm:mb-3">
          Was hattest du?
        </label>
        <div className="space-y-2">
          {items.map((item) => {
            // Note: "Bereits bezahlt" badge removed - payer marks selections as paid via paid flag
            // Status never changes to PAID - it always stays SELECTING
            const remainingQty = remainingQuantities[item.id] ?? item.quantity
            // Live remaining quantity - accounts for current user's selection in real-time
            const liveRemainingQty = Math.max(0, remainingQty - (selectedItems[item.id] || 0))
            // Always show all quantity options based on original item quantity to prevent layout shifts
            const quantityOptions = getAllQuantityOptions(item.quantity)

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

            // Calculate total selections for this item (only SELECTING now)
            const ownQuantity = selectedItems[item.id] || 0
            const othersTotal = othersSelecting.reduce((sum, u) => sum + u.quantity, 0)
            const totalLiveSelected = ownQuantity + othersTotal

            // Total claimed = all SELECTING (including own)
            const totalClaimed = totalLiveSelected

            // Overselected if total claimed exceeds item quantity
            const isOverselected = totalClaimed > item.quantity
            const isFullyMarked = totalClaimed === item.quantity && totalClaimed > 0

            const isEditingThis = editingItemId === item.id

            return (
              <div
                key={item.id}
                className={`border rounded-lg p-2.5 sm:p-3 transition-colors relative ${
                  isOverselected
                    ? 'border-red-500 dark:border-red-600 bg-red-50 dark:bg-red-900/20'
                    : isEditingThis
                    ? 'border-gray-200 dark:border-gray-600 dark:bg-gray-700/50'
                    : isFullyMarked && !isOverselected
                    ? 'border-green-500 dark:border-green-600 bg-green-50 dark:bg-green-900/20'
                    : customQuantityMode[item.id]
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

                      // Note: Paid selections badges removed - no longer showing "Bereits bezahlt"

                      if (allBadges.length === 0) return null

                      const MAX_VISIBLE = 3
                      const showMore = allBadges.length > 4
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
                                <div key={`live-${idx}`} className="bg-gray-500 dark:bg-gray-600 text-white text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                                  <span className="font-medium">{badge.data.guestName}</span>
                                  <span className="opacity-90">({formatQuantity(badge.data.quantity)}×)</span>
                                </div>
                              )
                            }
                            // Note: 'paid' badge type removed - no longer showing "Bereits bezahlt"
                            return null
                          })}

                          {showMore && (
                            <div className="bg-gray-500 dark:bg-gray-600 text-white text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                              <span className="font-medium">+{remainingCount} weitere</span>
                            </div>
                          )}
                        </div>
                      )
                    })()}

                    <div className="mb-2">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className={`font-medium text-sm sm:text-base ${
                          selectedItems[item.id] > 0
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-gray-900 dark:text-gray-100'
                        }`}>
                          {selectedItems[item.id] > 0 && (
                            <span className="font-bold">{formatQuantity(selectedItems[item.id])}× </span>
                          )}
                          {item.name}
                        </h3>
                      </div>
                      <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-1">
                        {item.quantity}x à {formatEUR(item.pricePerUnit)} ={' '}
                        {formatEUR(item.totalPrice)}
                      </p>
                      <div className="text-xs sm:text-sm">
                        <span className="text-gray-600 dark:text-gray-400">Dein Anteil: </span>
                        <span className={`font-semibold ${
                          selectedItems[item.id] > 0
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-gray-500 dark:text-gray-500'
                        }`}>
                          {selectedItems[item.id] > 0
                            ? formatEUR(item.pricePerUnit * selectedItems[item.id])
                            : '—'
                          }
                        </span>
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

                {!isEditingThis && (
                  <div className="space-y-2">
                    {/* Status Info Line - always shown above buttons - fixed height to prevent layout shift */}
                    <div className="h-[28px] flex items-center">
                      {isFullyMarked && !isOverselected ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-green-600 dark:text-green-400 text-sm leading-none">✓</span>
                          <span className="text-xs sm:text-sm text-green-600 dark:text-green-400 font-medium italic leading-none">
                            Vollständig aufgeteilt
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center">
                          <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 leading-none">
                            Noch offen: {formatQuantity(liveRemainingQty)}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Quantity Buttons - always shown */}
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex gap-1.5 sm:gap-2 flex-wrap">
                        {quantityOptions.map((qty) => {
                          // Disable button if:
                          // 1. Position is fully marked by others AND this is a selection button (qty > 0) AND user hasn't selected this item
                          // 2. OR quantity exceeds what's currently available (remainingQty)
                          const isDisabled =
                            (isFullyMarked && !isOverselected && qty > 0 && selectedItems[item.id] === 0) ||
                            (qty > 0 && qty > remainingQty)

                          return (
                            <button
                              key={qty}
                              type="button"
                              onClick={() => handleItemQuantityChange(item.id, qty, true)}
                              disabled={isDisabled}
                              className={`px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg text-xs sm:text-sm font-medium transition-colors min-w-[3rem] ${
                                selectedItems[item.id] === qty && !customQuantityMode[item.id]
                                  ? 'bg-green-600 text-white dark:bg-green-500'
                                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed'
                              }`}
                            >
                              {qty === 0 ? '✗' : `${qty}x`}
                            </button>
                          )
                        })}
                        <button
                          type="button"
                          onClick={() => handleCustomQuantityToggle(item.id)}
                          disabled={
                            (isFullyMarked && !isOverselected && selectedItems[item.id] === 0) ||
                            remainingQty === 0
                          }
                          className={`px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                            customQuantityMode[item.id] || (selectedItems[item.id] > 0 && !quantityOptions.includes(selectedItems[item.id]))
                              ? 'bg-green-600 text-white dark:bg-green-500'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed'
                          }`}
                        >
                          Anteilig
                        </button>
                      </div>
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
                              { label: '1/2', value: 1/2 },
                              { label: '1/3', value: 1/3 },
                              { label: '2/3', value: 2/3 },
                              { label: '1/4', value: 1/4 },
                              { label: '3/4', value: 3/4 },
                              { label: '1/5', value: 1/5 },
                              { label: '2/5', value: 2/5 },
                              { label: '3/5', value: 3/5 },
                              { label: '4/5', value: 4/5 },
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
                                  onClick={async () => {
                                    // Update custom input display
                                    setCustomQuantityInput((prev) => ({
                                      ...prev,
                                      [item.id]: actualValue.toString()
                                    }))

                                    // Update selection with API call (triggers realtime update)
                                    await handleItemQuantityChange(item.id, actualValue)
                                  }}
                                  className="px-3 py-2 bg-purple-100 hover:bg-purple-200 dark:bg-purple-700 dark:hover:bg-purple-600 text-purple-700 dark:text-purple-100 rounded-lg text-xs sm:text-sm font-medium transition-colors"
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
                              onChange={async (e) => {
                                const persons = parseInt(e.target.value)
                                if (!isNaN(persons) && persons > 1) {
                                  // Round to 2 decimal places
                                  const value = parseFloat(Math.min(item.quantity / persons, remainingQty).toFixed(2))

                                  // Update custom input display
                                  setCustomQuantityInput((prev) => ({
                                    ...prev,
                                    [item.id]: value.toString()
                                  }))

                                  // Update selection with API call (triggers realtime update)
                                  await handleItemQuantityChange(item.id, value)
                                }
                              }}
                              className="w-36 px-2.5 py-1.5 border border-gray-300 dark:border-gray-500 rounded-lg focus:ring-2 focus:ring-green-500 dark:focus:ring-green-400 focus:border-transparent text-xs dark:bg-gray-600 dark:text-gray-100"
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
                              className="w-36 px-2.5 py-1.5 border border-gray-300 dark:border-gray-500 rounded-lg focus:ring-2 focus:ring-green-500 dark:focus:ring-green-400 focus:border-transparent text-xs dark:bg-gray-600 dark:text-gray-100"
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
                        min="1"
                        value={newItemForm.quantity}
                        onChange={(e) => setNewItemForm({ ...newItemForm, quantity: parseFloat(e.target.value) || 1 })}
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
                        min="0.01"
                        value={newItemForm.pricePerUnit}
                        onChange={(e) => setNewItemForm({ ...newItemForm, pricePerUnit: parseFloat(e.target.value) || 10 })}
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
                      disabled={loading || !newItemForm.name.trim() || newItemForm.quantity < 1 || newItemForm.pricePerUnit < 0.01}
                      className="flex-1 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 dark:bg-purple-500 dark:hover:bg-purple-600 dark:disabled:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      {loading ? 'Hinzufügen...' : 'Hinzufügen'}
                    </button>
                    <button
                      onClick={() => {
                        setAddingNew(false)
                        setNewItemForm({ name: '', quantity: 1, pricePerUnit: 10 })
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
            onChange={(e) => {
              setCustomTip(e.target.value)
              // Update live selection with custom tip (debounced)
              const newTipAmount = parseFloat(e.target.value) || 0
              debouncedTipUpdate(newTipAmount)
            }}
            placeholder="0.00"
            className="w-full px-3 sm:px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 dark:focus:ring-green-400 focus:border-transparent text-sm sm:text-base dark:bg-gray-700 dark:text-gray-100"
          />
        )}
      </div>

      {/* Total Summary */}
      <div className="border-t dark:border-gray-600 pt-3 sm:pt-4 space-y-1.5 sm:space-y-2">
        {/* Selected Items Details */}
        {Object.keys(selectedItems).length > 0 && (
          <div className="space-y-1.5 pb-2 border-b dark:border-gray-600">
            <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Deine Positionen:
            </div>
            {items
              .filter(item => selectedItems[item.id] > 0)
              .map((item) => {
                const quantity = selectedItems[item.id]
                const itemTotal = item.pricePerUnit * quantity
                return (
                  <div key={item.id} className="flex justify-between text-xs sm:text-sm">
                    <span className="text-gray-600 dark:text-gray-400">
                      {formatQuantity(quantity)}× {item.name}
                    </span>
                    <span className="font-medium text-gray-900 dark:text-gray-200">
                      {formatEUR(itemTotal)}
                    </span>
                  </div>
                )
              })}
          </div>
        )}

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

      {/* Payment Info Box - Copy Amount Flow */}
      {!isOwner && total > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 sm:p-4 space-y-3">
          <div className="flex items-start gap-2">
            <span className="text-blue-600 dark:text-blue-400 text-lg">ℹ️</span>
            <div className="flex-1 space-y-3">
              <p className="text-xs sm:text-sm text-blue-800 dark:text-blue-300">
                <span className="font-semibold">{payerName}</span> bezahlt die Gesamtrechnung. Bezahle deinen Anteil ({formatEUR(total)}) direkt an <span className="font-semibold">{payerName}</span>:
              </p>

              {/* PayPal Payment Flow */}
              {paypalHandle && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-base">💳</span>
                    <h4 className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-gray-100">
                      Per PayPal bezahlen:
                    </h4>
                  </div>

                  {/* Step 1: Copy Amount Button */}
                  <button
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(formatAmountForPayPal(total))
                        setAmountCopied(true)
                      } catch (error) {
                        console.error('Failed to copy amount:', error)
                      }
                    }}
                    className={`w-full ${
                      amountCopied
                        ? 'bg-green-600 dark:bg-green-500 hover:bg-green-700 dark:hover:bg-green-600'
                        : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600'
                    } text-gray-900 dark:text-gray-100 font-semibold py-2.5 px-4 rounded-lg transition-colors text-xs sm:text-sm flex items-center justify-center gap-2`}
                  >
                    {amountCopied ? (
                      <>
                        <span>✓</span>
                        <span>Betrag kopiert ({formatAmountForPayPal(total)} €)</span>
                      </>
                    ) : (
                      <>
                        <span>📋</span>
                        <span>Betrag kopieren ({formatAmountForPayPal(total)} €)</span>
                      </>
                    )}
                  </button>

                  {/* Step 2: Open PayPal Button (disabled until copied) */}
                  <button
                    onClick={() => {
                      if (!amountCopied) return
                      const paypalUrl = generatePayPalUrlWithoutAmount(paypalHandle)
                      window.open(paypalUrl, '_blank', 'noopener,noreferrer')
                    }}
                    disabled={!amountCopied}
                    className={`w-full ${
                      amountCopied
                        ? 'bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 cursor-pointer'
                        : 'bg-gray-300 dark:bg-gray-600 cursor-not-allowed opacity-50'
                    } text-white font-semibold py-2.5 px-4 rounded-lg transition-colors text-xs sm:text-sm flex items-center justify-center gap-2`}
                  >
                    <span>💳</span>
                    <span>PayPal öffnen & Betrag einfügen</span>
                  </button>

                  {!amountCopied && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                      ⬆️ Kopiere erst den Betrag, dann öffne PayPal
                    </p>
                  )}
                </div>
              )}

              {/* Cash Payment Option */}
              <div className="pt-2 border-t border-blue-200 dark:border-blue-800">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-base">💵</span>
                  <h4 className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-gray-100">
                    Bar bezahlen
                  </h4>
                </div>
                <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 ml-6">
                  Gib {payerName} das Geld Bar.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-3 py-2.5 sm:px-4 sm:py-3 rounded-lg text-xs sm:text-sm">
          {error}
        </div>
      )}

      {/* Fixed Bottom Summary - Bill Split Progress */}
      <div className="fixed bottom-0 left-0 right-0 z-50 px-4 sm:px-5 md:px-6 py-2.5 sm:py-3 bg-white dark:bg-gray-800 border-t-2 border-gray-200 dark:border-gray-600 shadow-lg">
        <div className="space-y-2">
          {/* Progress Bar with Percentage Inside */}
          <div className="relative w-full bg-gray-200 dark:bg-gray-700 rounded-full h-6 sm:h-7 overflow-hidden shadow-inner">
            <div
              className={`h-full transition-all duration-500 flex items-center justify-center ${
                totalCoveredPercentage >= 99.9
                  ? 'bg-gradient-to-r from-green-500 to-green-600 dark:from-green-600 dark:to-green-700'
                  : 'bg-gradient-to-r from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700'
              }`}
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
              Math.abs(remainingAmount) < 0.01 && Math.abs(totalAmount - totalPaidAmount) < 0.01
                ? 'text-green-600 dark:text-green-400'
                : Math.abs(remainingAmount) < 0.01
                ? 'text-green-600 dark:text-green-400'
                : remainingAmount > 0
                ? 'text-orange-600 dark:text-orange-400'
                : 'text-red-600 dark:text-red-400'
            }`}>
              {Math.abs(remainingAmount) < 0.01 && Math.abs(totalAmount - totalPaidAmount) < 0.01
                ? '✓ Fertig aufgeteilt!'
                : Math.abs(remainingAmount) < 0.01
                ? '✓ Vollständig aufgeteilt!'
                : remainingAmount > 0
                ? `Noch offen: ${formatEUR(Math.round(remainingAmount * 100) / 100)} / ${formatEUR(totalAmount)}`
                : `❗ Überbucht: ${formatEUR(Math.round(Math.abs(remainingAmount) * 100) / 100)}`
              }
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
