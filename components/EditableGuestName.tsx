'use client'

import { useState, useEffect } from 'react'
import { useTranslation, interpolate } from '@/lib/i18n'

interface EditableGuestNameProps {
  initialName: string
  onNameChange: (name: string) => void
}

export default function EditableGuestName({
  initialName,
  onNameChange,
}: EditableGuestNameProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [guestName, setGuestName] = useState(initialName)
  const [editValue, setEditValue] = useState(initialName)
  const [error, setError] = useState('')
  const { t } = useTranslation()

  // Update local state when initialName changes
  useEffect(() => {
    setGuestName(initialName)
    setEditValue(initialName)
  }, [initialName])

  const handleSave = () => {
    if (!editValue.trim()) {
      setError(t.editableName.nameEmpty)
      return
    }

    const trimmedName = editValue.trim()
    setGuestName(trimmedName)
    setIsEditing(false)
    setError('')

    // Update localStorage
    localStorage.setItem('friendName', trimmedName)

    // Notify parent component
    onNameChange(trimmedName)
  }

  const handleCancel = () => {
    setEditValue(guestName)
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
            className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 dark:bg-purple-500 dark:hover:bg-purple-600 text-white rounded-lg text-sm font-medium transition-colors"
          >
            ✓
          </button>
          <button
            onClick={handleCancel}
            className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200 rounded-lg text-sm font-medium transition-colors"
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
        {interpolate(t.editableName.youAre, { name: guestName })}
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
