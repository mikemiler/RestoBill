'use client'

import { useTranslation } from '@/lib/i18n'

interface StatusPageHeaderProps {
  restaurantName?: string | null
}

export default function StatusPageHeader({ restaurantName }: StatusPageHeaderProps) {
  const { t } = useTranslation()

  return (
    <>
      <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 dark:text-gray-50 mb-1 md:mb-2">
        {t.statusPage.title}
      </h1>
      {restaurantName && (
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300">
          {restaurantName}
        </p>
      )}
    </>
  )
}
