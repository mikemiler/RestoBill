'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { formatEUR, generatePayPalUrlWithoutAmount, formatAmountForPayPal } from '@/lib/utils'
import { getOrCreateSessionId } from '@/lib/sessionStorage'
import { useRealtimeSubscription, useDebounce } from '@/lib/hooks'
import { debugLog, debugError } from '@/lib/debug'
import { useTranslation, interpolate } from '@/lib/i18n'
import EditableGuestName from './EditableGuestName'
import EditablePayerName from './EditablePayerName'
import BillItemCard from './BillItemCard'

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
  // DIAGNOSTIC: Verify component is rendering
  console.log('🚀 [SplitForm] Component rendering/re-rendering')

  const { t } = useTranslation()
  const router = useRouter()
  const [friendName, setFriendName] = useState('')
  const [sessionId, setSessionId] = useState('')
  const [nameConfirmed, setNameConfirmed] = useState(false)
  const [selectedItems, setSelectedItems] = useState<Record<string, number>>({})
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
  const [expandedButtons, setExpandedButtons] = useState<Record<string, boolean>>({}) // Track which items have expanded quantity buttons
  const [pulsingBadge, setPulsingBadge] = useState<string | null>(null) // Track which item badge should pulse
  const [isBottomBarExpanded, setIsBottomBarExpanded] = useState(false) // Expandable bottom summary bar - initially collapsed
  const [showBottomBarSummary, setShowBottomBarSummary] = useState(true) // Show summary in bottom bar (vs. in page flow)

  // Track if we've restored selections yet
  const hasRestoredSelections = useRef(false)

  // Ref for the anchor point where summary appears in normal flow
  const summaryAnchorRef = useRef<HTMLDivElement>(null)

  // Initialize sessionId on mount
  useEffect(() => {
    const sid = getOrCreateSessionId()
    setSessionId(sid)
  }, [])

  // IntersectionObserver to switch summary from bottom bar to page flow
  // IMPORTANT: Runs after nameConfirmed changes (when main form is rendered)
  useEffect(() => {
    console.log('🔵 [SplitForm] IntersectionObserver useEffect RUNNING', {
      nameConfirmed,
      isOwner,
      showingWelcomeScreen: !isOwner && !nameConfirmed
    })

    // Skip if showing welcome screen (anchor element not in DOM yet)
    if (!isOwner && !nameConfirmed) {
      console.log('⏭️ [SplitForm] Skipping observer setup - welcome screen is showing')
      return
    }

    console.log('[SplitForm] summaryAnchorRef:', summaryAnchorRef)
    console.log('[SplitForm] summaryAnchorRef.current:', summaryAnchorRef.current)

    const anchorElement = summaryAnchorRef.current

    if (!anchorElement) {
      console.error('❌ [SplitForm] summaryAnchorRef.current is NULL - cannot observe!')
      console.log('[SplitForm] This might be a timing issue - trying with timeout...')

      // Try again after a short delay to ensure DOM is ready
      const timeoutId = setTimeout(() => {
        const retryElement = summaryAnchorRef.current
        if (!retryElement) {
          console.error('❌ [SplitForm] Retry failed - anchor element still NULL')
          return
        }

        console.log('✅ [SplitForm] Retry successful! Setting up observer')
        const retryObserver = new IntersectionObserver(
          ([entry]) => {
            console.log('⚡⚡⚡ [SplitForm] IntersectionObserver CALLBACK FIRED:', {
              isIntersecting: entry.isIntersecting,
              intersectionRatio: entry.intersectionRatio,
              boundingTop: entry.boundingClientRect.top,
              willShowBottomBar: !entry.isIntersecting,
              willShowInPage: entry.isIntersecting
            })

            // Only show bottom bar when scrolling UP (anchor becomes invisible from below)
            // When isIntersecting = false AND top < 0, user scrolled past anchor going down → hide bar
            // When isIntersecting = true, anchor is visible → hide bar (show in page)
            if (entry.isIntersecting) {
              // Anchor visible → Hide bottom bar (show in page flow)
              setShowBottomBarSummary(false)
            } else if (entry.boundingClientRect.top < 0) {
              // Anchor above viewport (scrolled past going down) → Keep bar hidden
              setShowBottomBarSummary(false)
            } else {
              // Anchor below viewport (scrolling back up) → Show bar
              setShowBottomBarSummary(true)
            }
          },
          { threshold: 0, rootMargin: '0px' }
        )
        retryObserver.observe(retryElement)
      }, 100)

      return () => clearTimeout(timeoutId)
    }

    console.log('✅ [SplitForm] Anchor element found! Setting up IntersectionObserver')
    console.log('[SplitForm] Anchor element details:', {
      tagName: anchorElement.tagName,
      className: anchorElement.className,
      offsetHeight: anchorElement.offsetHeight,
      offsetTop: anchorElement.offsetTop,
      boundingRect: anchorElement.getBoundingClientRect()
    })

    const observer = new IntersectionObserver(
      ([entry]) => {
        console.log('⚡⚡⚡ [SplitForm] IntersectionObserver CALLBACK FIRED:', {
          isIntersecting: entry.isIntersecting,
          intersectionRatio: entry.intersectionRatio,
          boundingTop: entry.boundingClientRect.top,
          boundingClientRect: entry.boundingClientRect,
          willShowBottomBar: !entry.isIntersecting && entry.boundingClientRect.top >= 0,
          willShowInPage: entry.isIntersecting
        })

        // Smart scroll-direction aware logic:
        // - When anchor visible → hide bottom bar (show in page)
        // - When anchor above viewport (top < 0) → keep bar hidden (user scrolled past)
        // - When anchor below viewport (top > 0) → show bar (user scrolling back up)
        if (entry.isIntersecting) {
          // Anchor visible → Hide bottom bar (show in page flow)
          console.log('📍 Anchor visible - hiding bottom bar')
          setShowBottomBarSummary(false)
        } else if (entry.boundingClientRect.top < 0) {
          // Anchor above viewport (scrolled past going down) → Keep bar hidden
          console.log('⬇️ Scrolled past anchor - keeping bar hidden')
          setShowBottomBarSummary(false)
        } else {
          // Anchor below viewport (scrolling back up) → Show bar
          console.log('⬆️ Scrolling back up - showing bar')
          setShowBottomBarSummary(true)
        }
      },
      {
        threshold: 0,
        rootMargin: '0px' // No margin for now - trigger when anchor enters viewport
      }
    )

    console.log('📡 [SplitForm] Starting observation on anchor element')
    observer.observe(anchorElement)
    console.log('✅ [SplitForm] Observer.observe() called successfully')

    return () => {
      console.log('🧹 [SplitForm] Cleanup: Unobserving and disconnecting observer')
      observer.unobserve(anchorElement)
      observer.disconnect()
    }
  }, [nameConfirmed, isOwner])

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
        throw new Error(data.error || t.splitForm.errorSave)
      }

      setEditingItemId(null)
      setEditForm(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : t.common.genericError)
    } finally {
      setLoading(false)
    }
  }

  async function deleteItem(itemId: string) {
    if (!confirm(t.splitForm.confirmDelete)) {
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
        throw new Error(data.error || t.splitForm.errorDelete)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t.common.genericError)
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
        throw new Error(data.error || t.splitForm.errorCreate)
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
      setError(err instanceof Error ? err.message : t.common.genericError)
    } finally {
      setLoading(false)
    }
  }

  // Format quantity as fraction if applicable
  function formatQuantity(quantity: number): string {
    if (quantity % 1 === 0) return quantity.toString()

    // Try to find the simplest fraction representation
    // Check all denominators from 2 to 30 (matches VerticalWheel max)
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

    // Fallback to decimal if no fraction found (should rarely happen)
    return (Math.round(quantity * 100) / 100).toString()
  }

  // Update live selection in database (will be debounced)
  async function updateLiveSelectionQuantity(itemId: string, quantity: number, newSelectedItems: Record<string, number>) {
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
    const currentFriendName = friendName || localStorage.getItem('friendName') || t.splitForm.guestDefault
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

  // Debounced version (waits 1000ms after last change)
  const debouncedQuantityUpdate = useDebounce((itemId: string, quantity: number, newSelectedItems: Record<string, number>) => {
    updateLiveSelectionQuantity(itemId, quantity, newSelectedItems)
  }, 1000)

  function handleItemQuantityChange(itemId: string, quantity: number) {
    // Calculate new selectedItems state
    let newSelectedItems: Record<string, number>
    if (quantity === 0) {
      const { [itemId]: _, ...rest } = selectedItems
      newSelectedItems = rest
    } else {
      newSelectedItems = { ...selectedItems, [itemId]: quantity }
    }

    // Update local state immediately (for instant UI feedback)
    setSelectedItems(newSelectedItems)

    // Trigger badge pulse animation
    setPulsingBadge(itemId)
    setTimeout(() => setPulsingBadge(null), 600) // Reset after animation (600ms)

    // Debounced database update (1 second delay)
    debouncedQuantityUpdate(itemId, quantity, newSelectedItems)
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

    // Calculate new tip amount and update live selection (debounced)
    const newTipAmount = percent === -1
      ? parseFloat(customTip) || 0
      : (subtotal * percent) / 100
    debouncedTipUpdate(newTipAmount)
  }

  // Update live selection tip (debounced to prevent API spam)
  const updateLiveSelectionTip = async (tipAmount: number) => {
    const currentSessionId = sessionId || getOrCreateSessionId()
    const currentFriendName = friendName || localStorage.getItem('friendName') || t.splitForm.guestDefault

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
              {t.splitForm.welcomeTitle}
            </h2>
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
              {interpolate(t.splitForm.welcomeSubtitle, { payerName })}
            </p>
          </div>

          {/* Name Input */}
          <div className="space-y-3">
            <label
              htmlFor="friendName"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              {t.splitForm.welcomeInputLabel}
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
              placeholder={t.splitForm.welcomePlaceholder}
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
                setError(t.splitForm.welcomeErrorEmpty)
                return
              }
              setError('')
              setNameConfirmed(true)
            }}
            disabled={!friendName.trim()}
            className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 dark:bg-green-500 dark:hover:bg-green-600 dark:disabled:bg-gray-600 text-white font-semibold py-3.5 px-6 rounded-lg transition-colors text-base flex items-center justify-center gap-2"
          >
            {t.splitForm.welcomeContinue}
          </button>

          {/* Info Text */}
          <p className="text-xs text-center text-gray-500 dark:text-gray-400">
            {t.splitForm.welcomeInfo}
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
          {t.splitForm.itemsLabel}
        </label>
        <div className="space-y-4">
          {items.map((item) => {
            const currentSessionId = sessionId || getOrCreateSessionId()

            // Get other guests' selections for this item
            const othersSelecting = liveSelections
              .filter(sel => {
                if (sel.sessionId === currentSessionId) return false
                const quantities = sel.itemQuantities as Record<string, number>
                return quantities && quantities[item.id] > 0
              })
              .map(sel => ({
                guestName: sel.friendName,
                quantity: (sel.itemQuantities as Record<string, number>)[item.id]
              }))

            const isEditingThis = editingItemId === item.id

            // If editing, show edit form
            if (isEditingThis && editForm) {
              return (
                <div key={item.id} className="border-2 border-purple-300 dark:border-purple-600 rounded-lg p-3 bg-white dark:bg-gray-800">
                  <div className="space-y-3">
                    <h3 className="font-medium text-gray-900 dark:text-gray-100 text-sm">{t.splitForm.editFormTitle}</h3>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {t.splitForm.nameLabel}
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
                          {t.splitForm.quantityLabel}
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
                          {t.splitForm.pricePerUnitLabel}
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
                      {interpolate(t.splitForm.totalPriceLabel, { amount: formatEUR(editForm.quantity * editForm.pricePerUnit) })}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => saveEditItem(item.id)}
                        disabled={loading}
                        className="flex-1 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 dark:bg-purple-500 dark:hover:bg-purple-600 dark:disabled:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors"
                      >
                        {loading ? t.common.saving : t.common.save}
                      </button>
                      <button
                        onClick={cancelEditItem}
                        disabled={loading}
                        className="flex-1 px-3 py-1.5 bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 dark:bg-gray-600 dark:hover:bg-gray-500 dark:disabled:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg text-sm font-medium transition-colors"
                      >
                        {t.common.cancel}
                      </button>
                    </div>
                  </div>
                </div>
              )
            }

            // Otherwise show new BillItemCard
            return (
              <BillItemCard
                key={item.id}
                item={item}
                selectedQuantity={selectedItems[item.id] || 0}
                onQuantityChange={(qty) => handleItemQuantityChange(item.id, qty)}
                friendName={friendName}
                otherSelections={othersSelecting}
                remainingQuantity={remainingQuantities[item.id] ?? item.quantity}
                isOwner={isOwner}
                onEdit={() => startEditItem(item)}
                onDelete={() => deleteItem(item.id)}
              />
            )
          })}
        </div>

          {/* Add New Item (Owner only) */}
          {isOwner && (
            addingNew ? (
              <div className="border-2 border-dashed border-purple-300 dark:border-purple-600 rounded-lg p-3 bg-purple-50 dark:bg-purple-900/20">
                <h3 className="font-medium text-gray-900 dark:text-gray-100 text-sm mb-3">{t.splitForm.addNewButton}</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {t.splitForm.nameLabel}
                    </label>
                    <input
                      type="text"
                      value={newItemForm.name}
                      onChange={(e) => setNewItemForm({ ...newItemForm, name: e.target.value })}
                      placeholder={t.splitForm.namePlaceholder}
                      className="w-full px-2.5 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {t.splitForm.quantityLabel}
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
                        {t.splitForm.pricePerUnitLabelAlt}
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
                    {interpolate(t.splitForm.totalPriceLabel, { amount: formatEUR(newItemForm.quantity * newItemForm.pricePerUnit) })}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={addNewItem}
                      disabled={loading || !newItemForm.name.trim() || newItemForm.quantity < 1 || newItemForm.pricePerUnit < 0.01}
                      className="flex-1 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 dark:bg-purple-500 dark:hover:bg-purple-600 dark:disabled:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      {loading ? t.common.adding : t.common.add}
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
                      {t.common.cancel}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setAddingNew(true)}
                className="w-full border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-3 text-gray-600 dark:text-gray-300 hover:border-purple-400 dark:hover:border-purple-500 hover:text-purple-600 dark:hover:text-purple-400 transition-colors text-sm font-medium"
              >
                {t.splitForm.addNewItemButton}
              </button>
            )
          )}
      </div>

      {/* Tip Calculator */}
      <div>
        <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 sm:mb-3">
          {t.splitForm.tipLabel}
        </label>
        <div className="grid grid-cols-4 gap-1.5 sm:gap-2 mb-2">
          {[0, 7, 10, 15].map((percent) => (
            <button
              key={percent}
              type="button"
              onClick={() => handleTipChange(percent)}
              className={`px-2.5 sm:px-3 py-2.5 sm:py-3 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
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
          className={`w-full px-2.5 sm:px-3 py-2.5 sm:py-3 rounded-lg text-xs sm:text-sm font-medium transition-colors mb-2 ${
            tipPercent === -1
              ? 'bg-green-600 text-white dark:bg-green-500'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500'
          }`}
        >
          {t.splitForm.customAmount}
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
            placeholder={t.splitForm.tipPlaceholder}
            className="w-full px-3 sm:px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 dark:focus:ring-green-400 focus:border-transparent text-sm sm:text-base dark:bg-gray-700 dark:text-gray-100"
          />
        )}
      </div>

      {/* Anchor point for IntersectionObserver - invisible */}
      <div ref={summaryAnchorRef} className="h-1 w-full" />

      {/* Summary in normal page flow (visible when scrolled down) */}
      <div className={`transition-all duration-300 ${
        showBottomBarSummary ? 'opacity-0 max-h-0 overflow-hidden' : 'opacity-100 max-h-[500px]'
      }`}>
          <div className="border-t dark:border-gray-600 pt-3 sm:pt-4 space-y-1.5 sm:space-y-2 mb-4">
            {/* Selected Items Details */}
            {Object.keys(selectedItems).length > 0 && (
              <div className="space-y-1.5 pb-2 border-b dark:border-gray-600">
                <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  {t.splitForm.yourItemsLabel}
                </div>
                {items
                  .filter(item => selectedItems[item.id] > 0)
                  .map((item) => {
                    const quantity = selectedItems[item.id]
                    const itemTotal = item.pricePerUnit * quantity
                    // Format quantity as fraction or decimal
                    const formatQuantity = (qty: number): string => {
                      if (qty % 1 === 0) return qty.toString()
                      for (let den = 2; den <= 30; den++) {
                        for (let num = 1; num < den; num++) {
                          const fracValue = num / den
                          if (Math.abs(qty - fracValue) < 0.01) {
                            const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b)
                            const divisor = gcd(num, den)
                            return `${num / divisor}/${den / divisor}`
                          }
                        }
                      }
                      return qty.toFixed(2)
                    }
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

            {/* Summary */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs sm:text-sm">
                <span className="text-gray-600 dark:text-gray-400">{t.splitForm.subtotalLabel}</span>
                <span className="font-medium text-gray-900 dark:text-gray-200">{formatEUR(subtotal)}</span>
              </div>
              {tipAmount > 0 && (
                <div className="flex justify-between text-xs sm:text-sm">
                  <span className="text-gray-600 dark:text-gray-400">{t.splitForm.tipAmountLabel}</span>
                  <span className="font-medium text-gray-900 dark:text-gray-200">{formatEUR(tipAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-base sm:text-lg font-bold pt-1 border-t dark:border-gray-600">
                <span className="text-gray-900 dark:text-gray-100">{t.splitForm.totalLabel}</span>
                <span className="text-green-600 dark:text-green-400">{formatEUR(total)}</span>
              </div>
            </div>
          </div>
        </div>

      {/* Payment Info - In normal content flow (appears when scrolling down) */}
      {!isOwner && total > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 sm:p-4 space-y-3">
          <div className="flex items-start gap-2">
            <span className="text-blue-600 dark:text-blue-400 text-lg">ℹ️</span>
            <div className="flex-1 space-y-3">
              <p className="text-xs sm:text-sm text-blue-800 dark:text-blue-300">
                {interpolate(t.splitForm.paymentInstruction, { payerName, amount: formatEUR(total) })}
              </p>

              {/* PayPal Payment Flow */}
              {paypalHandle && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-base">💳</span>
                    <h4 className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {t.splitForm.paypalHeader}
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
                        <span>{interpolate(t.splitForm.amountCopied, { amount: formatAmountForPayPal(total) })}</span>
                      </>
                    ) : (
                      <>
                        <span>📋</span>
                        <span>{interpolate(t.splitForm.copyAmount, { amount: formatAmountForPayPal(total) })}</span>
                      </>
                    )}
                  </button>

                  {/* Step 2: Open PayPal Button */}
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
                    <span>{t.splitForm.openPaypal}</span>
                  </button>

                  {!amountCopied && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                      {t.splitForm.copyFirstHint}
                    </p>
                  )}
                </div>
              )}

              {/* Cash Payment Option */}
              <div className="pt-2 border-t border-blue-200 dark:border-blue-800">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-base">💵</span>
                  <h4 className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {t.splitForm.cashHeader}
                  </h4>
                </div>
                <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 ml-6">
                  {interpolate(t.splitForm.cashInstruction, { payerName })}
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

      {/* Add bottom padding to prevent content from being hidden behind fixed bar */}

      {/* Fixed Bottom Bar - TWO SECTIONS */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-gray-800 border-t-2 border-gray-200 dark:border-gray-600 shadow-lg pb-safe pb-4">

        {/* SECTION 1: Personal Selection (expandable, hides when scrolled down) */}
        <div className={`transition-all duration-300 border-b border-gray-200 dark:border-gray-600 ${
          showBottomBarSummary ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'
        }`}>
          {/* Expandable Details Section */}
          <div className={`overflow-hidden transition-all duration-300 ${isBottomBarExpanded ? 'max-h-[400px]' : 'max-h-0'}`}>
            <div className="px-4 sm:px-5 md:px-6 py-3 space-y-3 max-h-[400px] overflow-y-auto">
              {/* Selected Items Details */}
              {Object.keys(selectedItems).length > 0 && (
                <div className="space-y-1.5 pb-2 border-b dark:border-gray-600">
                  <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    {t.splitForm.yourItemsLabel}
                  </div>
                  {items
                    .filter(item => selectedItems[item.id] > 0)
                    .map((item) => {
                      const quantity = selectedItems[item.id]
                      const itemTotal = item.pricePerUnit * quantity
                      // Format quantity as fraction or decimal
                      const formatQuantity = (qty: number): string => {
                        if (qty % 1 === 0) return qty.toString()
                        for (let den = 2; den <= 30; den++) {
                          for (let num = 1; num < den; num++) {
                            const fracValue = num / den
                            if (Math.abs(qty - fracValue) < 0.01) {
                              const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b)
                              const divisor = gcd(num, den)
                              return `${num / divisor}/${den / divisor}`
                            }
                          }
                        }
                        return qty.toFixed(2)
                      }
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

              {/* Summary */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs sm:text-sm">
                  <span className="text-gray-600 dark:text-gray-400">{t.splitForm.subtotalLabel}</span>
                  <span className="font-medium text-gray-900 dark:text-gray-200">{formatEUR(subtotal)}</span>
                </div>
                {tipAmount > 0 && (
                  <div className="flex justify-between text-xs sm:text-sm">
                    <span className="text-gray-600 dark:text-gray-400">{t.splitForm.tipAmountLabel}</span>
                    <span className="font-medium text-gray-900 dark:text-gray-200">{formatEUR(tipAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-base sm:text-lg font-bold pt-1 border-t dark:border-gray-600">
                  <span className="text-gray-900 dark:text-gray-100">{t.splitForm.totalLabel}</span>
                  <span className="text-green-600 dark:text-green-400">{formatEUR(total)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Compact Header - Always Visible (Clickable to Expand) */}
          <button
            onClick={() => setIsBottomBarExpanded(!isBottomBarExpanded)}
            className="w-full px-4 sm:px-5 md:px-6 py-2.5 sm:py-3 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <div className="space-y-2">
              {/* Chevron + Title */}
              <div className="flex items-center justify-center gap-2">
                <span className={`text-gray-400 transition-transform text-base ${isBottomBarExpanded ? 'rotate-180' : ''}`}>
                  ▲
                </span>
                <span className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {interpolate(t.splitForm.selectionTotal, { amount: formatEUR(total) })}
                </span>
                <span className={`text-gray-400 transition-transform text-base ${isBottomBarExpanded ? 'rotate-180' : ''}`}>
                  ▲
                </span>
              </div>
            </div>
          </button>
        </div>

        {/* SECTION 2: Overall Bill Status (ALWAYS visible) */}
        <div className="px-4 sm:px-5 md:px-6 py-2.5 sm:py-3">
          {/* Progress Bar with Overall Status */}
          <div className="relative w-full bg-gray-200 dark:bg-gray-700 rounded-full h-7 sm:h-8 overflow-hidden shadow-inner">
            <div
              className={`h-full transition-all duration-500 ${
                totalCoveredPercentage >= 99.9
                  ? 'bg-gradient-to-r from-green-500 to-green-600 dark:from-green-600 dark:to-green-700'
                  : 'bg-gradient-to-r from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700'
              }`}
              style={{ width: `${totalCoveredPercentage}%` }}
            />
            {/* Status Text Overlay */}
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-sm sm:text-base font-bold text-white drop-shadow-md">
                {Math.abs(remainingAmount) < 0.01 && Math.abs(totalAmount - totalPaidAmount) < 0.01
                  ? t.splitForm.progressComplete
                  : Math.abs(remainingAmount) < 0.01
                  ? t.splitForm.progressFullyAllocated
                  : remainingAmount > 0
                  ? interpolate(t.splitForm.progressRemaining, { remaining: formatEUR(Math.round(remainingAmount * 100) / 100), total: formatEUR(totalAmount) })
                  : interpolate(t.splitForm.progressOverbooked, { amount: formatEUR(Math.round(Math.abs(remainingAmount) * 100) / 100) })
                }
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
