'use client'

import { useState } from 'react'

interface ReviewLinkSectionProps {
  reviewUrl: string
}

export default function ReviewLinkSection({ reviewUrl }: ReviewLinkSectionProps) {
  const [copied, setCopied] = useState(false)

  async function copyReviewLink() {
    try {
      await navigator.clipboard.writeText(reviewUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  return (
    <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
        ⭐ Bitte deine Freunde, eine Google-Bewertung zu hinterlassen:
      </p>
      <div className="flex items-center space-x-2">
        <input
          type="text"
          value={reviewUrl}
          readOnly
          className="flex-1 px-3 sm:px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 dark:text-gray-200 text-xs sm:text-sm"
        />
        <button
          onClick={copyReviewLink}
          className="bg-yellow-500 hover:bg-yellow-600 dark:bg-yellow-600 dark:hover:bg-yellow-700 text-white px-4 sm:px-6 py-2 rounded-lg font-semibold whitespace-nowrap transition-colors text-sm sm:text-base"
        >
          {copied ? '✓ Kopiert!' : '⭐ Kopieren'}
        </button>
      </div>
    </div>
  )
}
