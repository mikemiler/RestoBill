'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = typeof window !== 'undefined'
  ? createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  : null

interface DebugRealtimePanelProps {
  billId: string
}

export default function DebugRealtimePanel({ billId }: DebugRealtimePanelProps) {
  const [activeSelections, setActiveSelections] = useState<any[]>([])
  const [selections, setSelections] = useState<any[]>([])
  const [activeStatus, setActiveStatus] = useState<string>('Not subscribed')
  const [selectionStatus, setSelectionStatus] = useState<string>('Not subscribed')
  const [events, setEvents] = useState<string[]>([])

  const addEvent = (msg: string) => {
    const timestamp = new Date().toLocaleTimeString('de-DE')
    setEvents(prev => [`[${timestamp}] ${msg}`, ...prev].slice(0, 20))
  }

  useEffect(() => {
    if (!supabase) return

    addEvent('🟢 Initializing Realtime subscriptions')

    // Fetch initial data
    const fetchData = async () => {
      try {
        const [activeRes, selectionRes] = await Promise.all([
          fetch(`/api/bills/${billId}/live-selections`),
          fetch(`/api/bills/${billId}/selections`)
        ])

        const activeData = await activeRes.json()
        const selectionData = await selectionRes.json()

        setActiveSelections(activeData)
        setSelections(selectionData)
        addEvent(`📊 Loaded ${activeData.length} active selections, ${selectionData.length} selections`)
      } catch (error) {
        addEvent(`❌ Error fetching data: ${error}`)
      }
    }

    fetchData()

    // Subscribe to ActiveSelection
    const channel1 = supabase
      .channel(`debug-active:${billId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ActiveSelection',
          filter: `billId=eq.${billId}`
        },
        (payload) => {
          addEvent(`🔵 ActiveSelection ${payload.eventType}: ${JSON.stringify(payload.new || payload.old)}`)
          fetchData()
        }
      )
      .subscribe((status) => {
        setActiveStatus(status)
        addEvent(`📡 ActiveSelection status: ${status}`)
      })

    // Subscribe to Selection
    const channel2 = supabase
      .channel(`debug-selection:${billId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'Selection',
          filter: `billId=eq.${billId}`
        },
        (payload) => {
          addEvent(`🟢 Selection ${payload.eventType}: ${JSON.stringify(payload.new || payload.old)}`)
          fetchData()
        }
      )
      .subscribe((status) => {
        setSelectionStatus(status)
        addEvent(`📡 Selection status: ${status}`)
      })

    return () => {
      addEvent('🔴 Cleaning up subscriptions')
      supabase.removeChannel(channel1)
      supabase.removeChannel(channel2)
    }
  }, [billId])

  return (
    <div className="fixed bottom-4 right-4 w-96 max-h-[600px] bg-white dark:bg-gray-800 border-2 border-purple-500 rounded-lg shadow-2xl overflow-hidden z-50">
      <div className="bg-purple-600 text-white px-4 py-2 font-bold">
        🐛 Debug Realtime Panel
      </div>

      <div className="p-4 space-y-3 max-h-[550px] overflow-y-auto">
        {/* Status */}
        <div className="space-y-1">
          <div className="text-xs font-semibold">Subscription Status:</div>
          <div className="flex gap-2 text-xs">
            <span className={`px-2 py-1 rounded ${activeStatus === 'SUBSCRIBED' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
              ActiveSelection: {activeStatus}
            </span>
            <span className={`px-2 py-1 rounded ${selectionStatus === 'SUBSCRIBED' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
              Selection: {selectionStatus}
            </span>
          </div>
        </div>

        {/* Data Counts */}
        <div className="space-y-1">
          <div className="text-xs font-semibold">Current Data:</div>
          <div className="text-xs space-y-1">
            <div>ActiveSelections: {activeSelections.length}</div>
            <div>Selections: {selections.length}</div>
          </div>
        </div>

        {/* Active Selections Detail */}
        {activeSelections.length > 0 && (
          <div className="space-y-1">
            <div className="text-xs font-semibold">Active Selections:</div>
            <div className="text-xs space-y-1">
              {activeSelections.map((sel, idx) => (
                <div key={idx} className="bg-blue-50 dark:bg-blue-900/20 p-2 rounded">
                  {sel.guestName}: {sel.quantity}× (itemId: {sel.itemId.substring(0, 8)}...)
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Event Log */}
        <div className="space-y-1">
          <div className="text-xs font-semibold">Event Log:</div>
          <div className="text-xs space-y-1 font-mono">
            {events.map((event, idx) => (
              <div key={idx} className="bg-gray-100 dark:bg-gray-700 p-1 rounded text-xs">
                {event}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
