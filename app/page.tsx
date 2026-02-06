'use client'

import Link from "next/link";
import Image from "next/image";
import BillsList from "@/components/BillsList";
import { useTranslation } from "@/lib/i18n";

export default function Home() {
  const { t } = useTranslation()

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800">
      <main className="max-w-2xl text-center">
        <div className="mb-6 flex justify-center">
          <Image
            src="/logo.png"
            alt="WerHatteWas Logo"
            width={150}
            height={150}
            priority
            className="app-logo"
          />
        </div>
        <h1 className="text-5xl font-bold mb-4 text-gray-900 dark:text-gray-50">
          WerHatteWas
        </h1>
        <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">
          {t.home.tagline}
        </p>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg dark:shadow-gray-900/30 p-8 mb-8">
          <h2 className="text-2xl font-semibold mb-4 text-gray-800 dark:text-gray-100">
            {t.home.howItWorks}
          </h2>

          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
            <p className="text-sm text-blue-800 dark:text-blue-300">
              <strong>&#x1F4A1;</strong> {t.home.importantNote}
            </p>
          </div>

          <ol className="text-left space-y-4 text-gray-700 dark:text-gray-200">
            <li className="flex items-start">
              <span className="font-bold text-blue-600 dark:text-blue-400 mr-3">1.</span>
              <span>{t.home.step1}</span>
            </li>
            <li className="flex items-start">
              <span className="font-bold text-blue-600 dark:text-blue-400 mr-3">2.</span>
              <span>{t.home.step2}</span>
            </li>
            <li className="flex items-start">
              <span className="font-bold text-blue-600 dark:text-blue-400 mr-3">3.</span>
              <span>{t.home.step3}</span>
            </li>
            <li className="flex items-start">
              <span className="font-bold text-blue-600 dark:text-blue-400 mr-3">4.</span>
              <span>{t.home.step4}</span>
            </li>
            <li className="flex items-start">
              <span className="font-bold text-blue-600 dark:text-blue-400 mr-3">5.</span>
              <span>{t.home.step5}</span>
            </li>
          </ol>
        </div>

        <Link
          href="/create"
          className="inline-block bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white font-semibold px-8 py-4 rounded-lg text-lg transition-colors"
        >
          {t.home.ctaButton}
        </Link>

        <p className="mt-6 text-sm text-gray-500 dark:text-gray-400">
          {t.home.freeInfo}
        </p>

        <BillsList />
      </main>
    </div>
  );
}
