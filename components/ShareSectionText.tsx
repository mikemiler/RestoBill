'use client'

import { useTranslation } from '@/lib/i18n'

export function ShareSectionHeading() {
  const { t } = useTranslation()
  return (
    <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 text-gray-800 dark:text-gray-100">
      {t.statusPage.shareLink}
    </h2>
  )
}

export function ShareSectionDescription() {
  const { t } = useTranslation()
  return (
    <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300 mb-3 sm:mb-4">
      {t.statusPage.shareLinkDescription}
    </p>
  )
}

export function QRCodeDescription() {
  const { t } = useTranslation()
  return (
    <p className="text-sm text-gray-600 dark:text-gray-300 mb-3 text-center">
      {t.statusPage.qrCodeDescription}
    </p>
  )
}
