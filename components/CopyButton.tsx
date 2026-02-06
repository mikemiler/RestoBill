'use client'

import { useState } from 'react'
import { useTranslation } from '@/lib/i18n'

interface CopyButtonProps {
  text: string
}

export default function CopyButton({ text }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)
  const { t } = useTranslation()

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleCopy}
      className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm transition-colors"
    >
      {copied ? t.copyButton.copied : t.copyButton.copy}
    </button>
  )
}
