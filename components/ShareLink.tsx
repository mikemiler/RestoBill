'use client'

import { useState } from 'react'

interface ShareLinkProps {
  shareUrl: string
  reviewUrl?: string
  restaurantName?: string
}

export default function ShareLink({ shareUrl, reviewUrl, restaurantName }: ShareLinkProps) {
  const [copied, setCopied] = useState(false)
  const [reviewCopied, setReviewCopied] = useState(false)

  async function copyToClipboard() {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  async function copyReviewLink() {
    if (!reviewUrl) return
    try {
      await navigator.clipboard.writeText(reviewUrl)
      setReviewCopied(true)
      setTimeout(() => setReviewCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  function shareViaWhatsApp() {
    let text = `Hallo! Bitte wähle deine Positionen aus der Restaurant-Rechnung aus: ${shareUrl}`

    // Add review request if restaurant found
    if (reviewUrl && restaurantName) {
      text += `\n\nWenn du zufrieden warst, hinterlasse gerne eine Google-Bewertung für ${restaurantName}: ${reviewUrl}`
    }

    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text)}`
    window.open(whatsappUrl, '_blank')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-2">
        <input
          type="text"
          value={shareUrl}
          readOnly
          className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 dark:text-gray-200 text-sm"
        />
        <button
          onClick={copyToClipboard}
          className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold whitespace-nowrap transition-colors"
        >
          {copied ? '✓ Kopiert!' : 'Kopieren'}
        </button>
      </div>

      <button
        onClick={shareViaWhatsApp}
        className="w-full bg-green-500 hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors flex items-center justify-center space-x-2"
      >
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
        </svg>
        <span>Per WhatsApp teilen</span>
      </button>

      {/* Review-Link Sektion (nur wenn Restaurant gefunden) */}
      {reviewUrl && (
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
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
              {reviewCopied ? '✓ Kopiert!' : '⭐ Kopieren'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
