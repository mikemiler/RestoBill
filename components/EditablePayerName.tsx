'use client'

import { useState } from 'react'
import { useTranslation, interpolate } from '@/lib/i18n'

interface EditablePayerNameProps {
  billId: string
  initialName: string
  onNameChange?: (name: string) => void
}

export default function EditablePayerName({
  billId,
  initialName,
  onNameChange,
}: EditablePayerNameProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [payerName, setPayerName] = useState(initialName)
  const [editValue, setEditValue] = useState(initialName)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { t } = useTranslation()

  const handleSave = async () => {
    if (!editValue.trim()) {
      setError(t.editableName.nameEmpty)
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await fetch(`/api/bills/${billId}/update-payer`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          payerName: editValue.trim(),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || t.editableName.errorSaving)
      }

      setPayerName(data.payerName)
      setIsEditing(false)

      // Update localStorage
      localStorage.setItem('payerName', data.payerName)

      // Notify parent component if callback is provided
      if (onNameChange) {
        onNameChange(data.payerName)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t.common.genericError)
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    setEditValue(payerName)
    setIsEditing(false)
    setError('')
  }

  if (isEditing) {
    return (
      <div className="inline-flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400 focus:border-transparent dark:bg-gray-700 dark:text-gray-100 text-sm"
            placeholder={t.editableName.namePlaceholder}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleSave()
              } else if (e.key === 'Escape') {
                handleCancel()
              }
            }}
          />
          <button
            onClick={handleSave}
            disabled={loading}
            className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 dark:bg-purple-500 dark:hover:bg-purple-600 dark:disabled:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors"
          >
            {loading ? '...' : '✓'}
          </button>
          <button
            onClick={handleCancel}
            disabled={loading}
            className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 dark:bg-gray-600 dark:hover:bg-gray-500 dark:disabled:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg text-sm font-medium transition-colors"
          >
            ✗
          </button>
        </div>
        {error && (
          <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
        )}
      </div>
    )
  }

  return (
    <div className="inline-flex items-center gap-2">
      <span className="text-sm sm:text-base text-gray-600 dark:text-gray-300">
        {interpolate(t.editableName.forMe, { name: payerName })}
      </span>
      <button
        onClick={() => setIsEditing(true)}
        className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
        title={t.editableName.editTitle}
      >
        <svg
          className="w-4 h-4 text-gray-500 dark:text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
          />
        </svg>
      </button>
    </div>
  )
}
