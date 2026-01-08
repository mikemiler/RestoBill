'use client'

import { useState } from 'react'
import Image from 'next/image'

interface CollapsibleReceiptProps {
  imageUrl: string
}

export default function CollapsibleReceipt({ imageUrl }: CollapsibleReceiptProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg dark:shadow-gray-900/30 overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="collapsible-receipt-button"
      >
        <span className="collapsible-receipt-title">
          📸 Rechnung {isOpen ? 'ausblenden' : 'anzeigen'}
        </span>
        <span className="collapsible-receipt-icon">
          {isOpen ? '▼' : '▶'}
        </span>
      </button>

      {isOpen && (
        <div className="p-3">
          <div className="relative w-full aspect-[3/4]">
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
