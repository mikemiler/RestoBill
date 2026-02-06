'use client'

import { useTranslation, interpolate } from '@/lib/i18n'

interface SplitPageHeaderProps {
  payerName: string
  restaurantName?: string | null
}

export default function SplitPageHeader({ payerName, restaurantName }: SplitPageHeaderProps) {
  const { t } = useTranslation()

  return (
    <>
      <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 dark:text-gray-50 mb-1 md:mb-2">
        {t.splitPage.title}
      </h1>
      <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300">
        {interpolate(t.splitPage.from, { payerName })}
        {restaurantName && ` • ${restaurantName}`}
      </p>
    </>
  )
}
