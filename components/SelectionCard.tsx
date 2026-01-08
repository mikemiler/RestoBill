'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatEUR } from '@/lib/utils'

interface SelectionCardProps {
  selection: {
    id: string
    friendName: string
    createdAt: string
    paid: boolean
    tipAmount: number
    itemQuantities: Record<string, number>
  }
  billItems: Array<{
    id: string
    name: string
    pricePerUnit: number
  }>
  total: number
}

export default function SelectionCard({ selection, billItems, total }: SelectionCardProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function togglePaidStatus() {
    setLoading(true)
    try {
      const method = selection.paid ? 'DELETE' : 'POST'
      const response = await fetch(`/api/selections/${selection.id}/mark-paid`, {
        method,
      })

      if (!response.ok) {
        throw new Error('Fehler beim Aktualisieren')
      }

      // Refresh the page to show updated data
      router.refresh()
    } catch (error) {
      console.error('Error toggling paid status:', error)
      alert('Fehler beim Aktualisieren')
    } finally {
      setLoading(false)
    }
  }

  const quantities = selection.itemQuantities as Record<string, number> || {}

  return (
    <div
      className={`border rounded-lg p-4 ${
        selection.paid
          ? 'border-green-300 dark:border-green-600 bg-green-50 dark:bg-green-900/20'
          : 'border-gray-200 dark:border-gray-600 dark:bg-gray-700/50'
      }`}
    >
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">
            {selection.friendName}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {new Date(selection.createdAt).toLocaleDateString('de-DE', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
            {formatEUR(total)}
          </p>
          <button
            onClick={togglePaidStatus}
            disabled={loading}
            className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
              selection.paid
                ? 'bg-green-200 dark:bg-green-700 text-green-800 dark:text-green-200 hover:bg-green-300 dark:hover:bg-green-600'
                : 'bg-yellow-200 dark:bg-yellow-700 text-yellow-800 dark:text-yellow-200 hover:bg-yellow-300 dark:hover:bg-yellow-600'
            } ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            {loading ? '...' : selection.paid ? '✓ Bezahlt' : 'Als bezahlt markieren'}
          </button>
        </div>
      </div>

      <div className="text-sm space-y-1">
        {Object.entries(quantities).map(([itemId, quantity]) => {
          const item = billItems.find((i: any) => i.id === itemId)
          if (!item || (quantity as number) === 0) return null
          return (
            <div
              key={itemId}
              className="flex justify-between text-gray-700 dark:text-gray-300"
            >
              <span>
                {item.name} ({quantity}x)
              </span>
              <span>
                {formatEUR(item.pricePerUnit * (quantity as number))}
              </span>
            </div>
          )
        })}
        {selection.tipAmount > 0 && (
          <div className="flex justify-between text-gray-700 dark:text-gray-300 font-medium">
            <span>Trinkgeld</span>
            <span>{formatEUR(selection.tipAmount)}</span>
          </div>
        )}
      </div>
    </div>
  )
}
