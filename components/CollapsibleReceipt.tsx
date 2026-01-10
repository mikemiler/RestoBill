'use client'

import { useState } from 'react'
import Image from 'next/image'

interface CollapsibleReceiptProps {
  imageUrl: string
  restaurantName?: string | null
}

export default function CollapsibleReceipt({ imageUrl, restaurantName }: CollapsibleReceiptProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg dark:shadow-gray-900/30">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors rounded-lg"
      >
        <h2 className="text-lg sm:text-xl font-semibold text-gray-800 dark:text-gray-100">
          📸 Rechnung
          {restaurantName && (
            <span className="text-sm sm:text-base font-normal text-gray-600 dark:text-gray-300 ml-2">
              📍 {restaurantName}
            </span>
          )}
        </h2>
        <svg
          className={`w-6 h-6 text-gray-600 dark:text-gray-300 transform transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {isOpen && (
        <div className="px-4 sm:px-6 pb-4 sm:pb-6">
          <div className="relative aspect-[3/4] w-full">
            <Image
              src={imageUrl}
              alt="Rechnung"
              fill
              className="object-contain rounded-lg"
            />
          </div>
        </div>
      )}
    </div>
  )
}
