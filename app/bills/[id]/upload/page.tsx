'use client'

import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'

export default function UploadBillPage() {
  const router = useRouter()
  const params = useParams()
  const billId = params.id as string

  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [analyzing, setAnalyzing] = useState(false)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    // Validate file
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/heic']
    if (!allowedTypes.includes(selectedFile.type)) {
      setError('Nur JPG, PNG und HEIC Dateien sind erlaubt')
      return
    }

    const maxSizeMB = 10
    const maxBytes = maxSizeMB * 1024 * 1024
    if (selectedFile.size > maxBytes) {
      setError(`Datei zu groß. Maximum: ${maxSizeMB}MB`)
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

  async function handleUpload() {
    if (!file) {
      setError('Bitte wähle eine Datei aus')
      return
    }

    setLoading(true)
    setAnalyzing(true)
    setError('')

    try {
      const formData = new FormData()
      formData.append('image', file)

      const response = await fetch(`/api/bills/${billId}/upload`, {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Fehler beim Hochladen')
      }

      // Redirect to review page
      router.push(`/bills/${billId}/review`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ein Fehler ist aufgetreten')
      setLoading(false)
      setAnalyzing(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white p-8">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Rechnung hochladen
          </h1>
          <p className="text-gray-600">
            Fotografiere die Rechnung und lade sie hoch
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-8">
          {!preview ? (
            <div className="space-y-4">
              <label
                htmlFor="file-upload"
                className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-colors"
              >
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <svg
                    className="w-12 h-12 mb-4 text-gray-400"
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
                  <p className="mb-2 text-sm text-gray-700">
                    <span className="font-semibold">Klicke hier</span> oder ziehe ein Bild
                  </p>
                  <p className="text-xs text-gray-500">
                    JPG, PNG oder HEIC (max. 10MB)
                  </p>
                </div>
                <input
                  id="file-upload"
                  type="file"
                  className="hidden"
                  accept="image/jpeg,image/png,image/jpg,image/heic"
                  onChange={handleFileChange}
                />
              </label>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={preview}
                  alt="Rechnung Vorschau"
                  className="w-full rounded-lg"
                />
                <button
                  onClick={() => {
                    setFile(null)
                    setPreview(null)
                  }}
                  className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-lg text-sm"
                >
                  Andere Datei wählen
                </button>
              </div>

              {analyzing && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center space-x-3">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                    <div>
                      <p className="font-semibold text-blue-900">
                        KI analysiert die Rechnung...
                      </p>
                      <p className="text-sm text-blue-700">
                        Das kann einen Moment dauern
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                  {error}
                </div>
              )}

              <button
                onClick={handleUpload}
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
              >
                {loading ? 'Wird analysiert...' : 'Hochladen & Analysieren'}
              </button>
            </div>
          )}
        </div>

        <div className="mt-8 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h3 className="font-semibold text-yellow-900 mb-2">
            📸 Tipps für beste Ergebnisse
          </h3>
          <ul className="text-sm text-yellow-800 space-y-1">
            <li>• Fotografiere die gesamte Rechnung</li>
            <li>• Achte auf gute Beleuchtung</li>
            <li>• Halte das Bild gerade</li>
            <li>• Stelle sicher, dass alles lesbar ist</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
