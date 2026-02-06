'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { resizeImage } from '@/lib/imageProcessing'
import { useTranslation, interpolate } from '@/lib/i18n'

export default function CreateBillPage() {
  const router = useRouter()
  const { t } = useTranslation()
  const [analyzing, setAnalyzing] = useState(false)
  const [analysisComplete, setAnalysisComplete] = useState(false)
  const [billId, setBillId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [payerName, setPayerName] = useState('')
  const [paypalHandle, setPaypalHandle] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)

  // Load from localStorage on mount
  useEffect(() => {
    const savedPayerName = localStorage.getItem('payerName')
    const savedPaypalHandle = localStorage.getItem('paypalHandle')

    if (savedPayerName) setPayerName(savedPayerName)
    if (savedPaypalHandle) setPaypalHandle(savedPaypalHandle)
  }, [])

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    // Validate file
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/heic', 'image/webp']
    if (!allowedTypes.includes(selectedFile.type)) {
      setError(t.create.fileTypeError)
      return
    }

    const maxSizeMB = 10
    const maxBytes = maxSizeMB * 1024 * 1024
    if (selectedFile.size > maxBytes) {
      setError(interpolate(t.create.fileTooLarge, { maxSize: String(maxSizeMB) }))
      return
    }

    setFile(selectedFile)
    setError('')

    // Create preview
    const reader = new FileReader()
    reader.onloadend = () => {
      setPreview(reader.result as string)
    }
    reader.readAsDataURL(selectedFile)
  }

  // Step 1: Start analysis (create bill + upload image)
  async function handleAnalyze() {
    if (!file) {
      setError(t.create.selectReceipt)
      return
    }

    console.log('=== ANALYZE START ===')
    console.log('Original file:', {
      name: file.name,
      size: `${(file.size / 1024 / 1024).toFixed(2)}MB`,
      type: file.type,
    })

    setAnalyzing(true)
    setError('')

    // Scroll to form section after a short delay
    setTimeout(() => {
      const formSection = document.querySelector('form')
      if (formSection) {
        formSection.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }, 100)

    try {
      // CRITICAL: Compress image client-side BEFORE upload to stay under Vercel's 4.5MB limit
      console.log('🔄 Starting client-side compression...')
      const compressedFile = await resizeImage(file, {
        maxWidth: 2000,
        maxHeight: 2000,
        quality: 0.85,
        format: 'image/jpeg',
      })

      console.log('✅ Compression complete!')
      console.log(`Original: ${(file.size / 1024 / 1024).toFixed(2)}MB → Compressed: ${(compressedFile.size / 1024 / 1024).toFixed(2)}MB`)

      // CRITICAL: Abort if still too large
      if (compressedFile.size > 4.5 * 1024 * 1024) {
        throw new Error(
          interpolate(t.create.imageTooLargeAfterCompress, { size: (compressedFile.size / 1024 / 1024).toFixed(2) })
        )
      }

      // Create bill with temporary name
      const createResponse = await fetch('/api/bills/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          payerName: 'Temporary', // Will be updated later
          paypalHandle: null,
        }),
      })

      const createData = await createResponse.json()

      if (!createResponse.ok) {
        throw new Error(createData.error || t.create.errorCreating)
      }

      const newBillId = createData.billId
      setBillId(newBillId)

      console.log('📤 Uploading compressed image...')

      // Upload and analyze image (now using compressed file)
      const formData = new FormData()
      formData.append('image', compressedFile)

      const uploadResponse = await fetch(`/api/bills/${newBillId}/upload`, {
        method: 'POST',
        body: formData,
      })

      console.log('Upload response status:', uploadResponse.status)

      const uploadData = await uploadResponse.json()

      if (!uploadResponse.ok) {
        throw new Error(uploadData.error || t.create.errorUploading)
      }

      console.log('✅ Analysis complete!')
      // Analysis complete!
      setAnalysisComplete(true)
    } catch (err) {
      console.error('=== ANALYZE ERROR ===', err)
      setError(err instanceof Error ? err.message : t.common.genericError)
      setBillId(null)
    } finally {
      setAnalyzing(false)
    }
  }

  // Step 2: Submit final data and redirect
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    if (!billId || !analysisComplete) {
      setError(t.create.waitForAnalysis)
      return
    }

    if (!payerName.trim()) {
      setError(t.create.enterName)
      return
    }

    // Validate PayPal handle format (only if provided)
    if (paypalHandle.trim()) {
      const handleRegex = /^[A-Za-z0-9_-]+$/
      if (!handleRegex.test(paypalHandle)) {
        setError(t.create.paypalValidation)
        return
      }
    }

    // Save to localStorage
    localStorage.setItem('payerName', payerName.trim())
    if (paypalHandle.trim()) {
      localStorage.setItem('paypalHandle', paypalHandle.trim())
    } else {
      localStorage.removeItem('paypalHandle')
    }

    try {
      // Update bill with actual payer info
      const updateResponse = await fetch(`/api/bills/${billId}/update-payer`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          payerName: payerName.trim(),
          paypalHandle: paypalHandle.trim() || null,
        }),
      })

      if (!updateResponse.ok) {
        const data = await updateResponse.json()
        throw new Error(data.error || t.create.errorSaving)
      }

      // Redirect to status page
      router.push(`/bills/${billId}/status`)
    } catch (err) {
      setError(err instanceof Error ? err.message : t.common.genericError)
    }
  }

  function handleTestPayPalLink() {
    if (paypalHandle.trim()) {
      window.open(`https://paypal.me/${paypalHandle.trim()}`, '_blank', 'noopener,noreferrer')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800 p-8">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <div className="mb-4 flex justify-center">
            <Image
              src="/logo.png"
              alt="WerHatteWas Logo"
              width={80}
              height={80}
              className="app-logo"
            />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-50 mb-2">
            {t.create.title}
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            {t.create.subtitle}
          </p>
        </div>

        {/* Upload Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg dark:shadow-gray-900/30 p-8">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-50 mb-4">
            {t.create.uploadHeading}
          </h2>

          {!preview ? (
            <div className="space-y-4">
              {/* Camera button */}
              <label
                htmlFor="camera-upload"
                className="flex items-center justify-center gap-3 w-full bg-gradient-to-r from-blue-600 to-blue-700 dark:from-blue-500 dark:to-blue-600 hover:from-blue-700 hover:to-blue-800 dark:hover:from-blue-600 dark:hover:to-blue-700 text-white font-semibold py-4 px-6 rounded-lg cursor-pointer transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                <span>{t.create.takePhoto}</span>
                <input
                  id="camera-upload"
                  type="file"
                  className="hidden"
                  accept="image/jpeg,image/png,image/jpg,image/heic,image/webp"
                  capture="environment"
                  onChange={handleFileChange}
                  disabled={analyzing || analysisComplete}
                />
              </label>

              {/* Separator */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300 dark:border-gray-600"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                    {t.create.or}
                  </span>
                </div>
              </div>

              {/* File upload area */}
              <label
                htmlFor="file-upload"
                className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:border-blue-500 dark:hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
              >
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <svg
                    className="w-12 h-12 mb-3 text-gray-400 dark:text-gray-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                    />
                  </svg>
                  <p className="mb-2 text-sm text-gray-700 dark:text-gray-300">
                    <span className="font-semibold">{t.create.selectFile}</span>
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {t.create.fileTypes}
                  </p>
                </div>
                <input
                  id="file-upload"
                  type="file"
                  className="hidden"
                  accept="image/jpeg,image/png,image/jpg,image/heic,image/webp"
                  onChange={handleFileChange}
                  disabled={analyzing || analysisComplete}
                />
              </label>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={preview}
                  alt="Rechnung Vorschau"
                  className="w-full rounded-lg max-h-64 object-contain"
                />
                {!analyzing && !analysisComplete && (
                  <button
                    type="button"
                    onClick={() => {
                      setFile(null)
                      setPreview(null)
                      setError('')
                    }}
                    className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700 text-white px-3 py-1 rounded-lg text-sm"
                  >
                    {t.create.otherFile}
                  </button>
                )}
              </div>

              {/* Analyze Button - Always visible */}
              <button
                type="button"
                onClick={handleAnalyze}
                disabled={analyzing || analysisComplete}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 dark:bg-blue-500 dark:hover:bg-blue-600 dark:disabled:bg-gray-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
              >
                {analyzing ? t.create.analyzing : analysisComplete ? t.create.analysisComplete : t.create.analyzeButton}
              </button>
            </div>
          )}

          <div className="mt-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
            <p className="text-xs text-yellow-800 dark:text-yellow-300">
              <strong>Tipp:</strong> {t.create.photoTip}
            </p>
          </div>
        </div>

        {/* Form Section - Show during and after analysis */}
        {(analyzing || analysisComplete) && (
          <form onSubmit={handleSubmit} className="space-y-6">
            {preview && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg dark:shadow-gray-900/30 p-8">
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-50 mb-2">
                  {t.create.yourDataHeading}
                </h2>
                <p className="text-sm text-blue-600 dark:text-blue-400">
                  {t.create.whileAnalyzing}
                </p>
              </div>

              <div className="space-y-6">
                <div>
                  <label
                    htmlFor="payerName"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                  >
                    {t.create.yourName}
                  </label>
                  <input
                    type="text"
                    id="payerName"
                    name="payerName"
                    value={payerName}
                    onChange={(e) => setPayerName(e.target.value)}
                    placeholder={t.create.namePlaceholder}
                    required
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-400"
                  />
                </div>

                <div>
                  <label
                    htmlFor="paypalHandle"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                  >
                    {t.create.paypalLabel} <span className="text-gray-500 dark:text-gray-400 font-normal">{t.create.paypalOptional}</span>
                  </label>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
                    {t.create.paypalHint}
                  </p>
                  <div className="flex items-stretch">
                    <span className="px-2 sm:px-3 py-3 bg-gray-100 dark:bg-gray-600 border border-r-0 border-gray-300 dark:border-gray-500 rounded-l-lg text-gray-600 dark:text-gray-200 text-xs sm:text-sm flex items-center whitespace-nowrap">
                      paypal.me/
                    </span>
                    <input
                      type="text"
                      id="paypalHandle"
                      name="paypalHandle"
                      value={paypalHandle}
                      onChange={(e) => setPaypalHandle(e.target.value)}
                      placeholder="username"
                      pattern="[A-Za-z0-9_-]+"
                      title={t.create.titleAttr}
                      className="flex-1 min-w-0 px-3 sm:px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-r-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-400 text-sm sm:text-base"
                    />
                  </div>
                  <div className="mt-3">
                    {paypalHandle.trim() ? (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-xs text-green-700 dark:text-green-400 font-medium mb-1">
                              {t.create.paypalPaymentsGoTo}
                            </p>
                            <p className="text-sm font-semibold text-green-800 dark:text-green-300 break-all">
                              paypal.me/{paypalHandle.trim()}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={handleTestPayPalLink}
                            className="ml-2 flex-shrink-0 px-3 py-1.5 bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600 text-white text-xs font-medium rounded-lg transition-colors"
                          >
                            {t.create.paypalTest}
                          </button>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {t.create.paypalTestHint}
                        </p>
                      </div>
                    ) : (
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {t.create.paypalCashOnly}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            {/* Analysis Progress */}
            {analyzing && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div className="flex items-center space-x-3">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 dark:border-blue-400"></div>
                  <div>
                    <p className="font-semibold text-blue-900 dark:text-blue-300">
                      {t.create.aiAnalyzing}
                    </p>
                    <p className="text-sm text-blue-700 dark:text-blue-400">
                      {t.create.pleaseWait}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={analyzing || !analysisComplete || !payerName.trim()}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 dark:bg-blue-500 dark:hover:bg-blue-600 dark:disabled:bg-gray-600 text-white font-semibold py-4 px-6 rounded-lg transition-colors text-lg"
            >
              {analyzing ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {t.create.analyzing}
                </span>
              ) : !payerName.trim() ? (
                t.create.enterName
              ) : (
                t.create.submit
              )}
            </button>
          </form>
        )}

        <div className="mt-6 text-center">
          <a
            href="/"
            className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
          >
            {t.create.backToHome}
          </a>
        </div>

        {!preview && (
          <div className="mt-8 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 dark:text-blue-300 mb-2">
              {t.create.paypalSetupTitle}
            </h3>
            <p className="text-sm text-blue-800 dark:text-blue-300">
              {t.create.paypalSetupText}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
