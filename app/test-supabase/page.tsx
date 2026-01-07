'use client'

import { useEffect, useState } from 'react'

interface TestResult {
  name: string
  status: 'success' | 'error' | 'warning'
  message: string
  details?: Record<string, unknown>
  error?: string
}

interface TestResponse {
  success: boolean
  timestamp: string
  results: TestResult[]
}

export default function TestSupabasePage() {
  const [testResults, setTestResults] = useState<TestResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const runTests = async () => {
    setLoading(true)
    setError(null)
    setTestResults(null)

    try {
      const response = await fetch('/api/test-supabase')
      const data = await response.json()
      setTestResults(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    runTests()
  }, [])

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return '✅'
      case 'error':
        return '❌'
      case 'warning':
        return '⚠️'
      default:
        return '❓'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'text-green-600'
      case 'error':
        return 'text-red-600'
      case 'warning':
        return 'text-yellow-600'
      default:
        return 'text-gray-600'
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-gray-900">
              Supabase Verbindungstest
            </h1>
            <button
              onClick={runTests}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {loading ? 'Teste...' : 'Erneut testen'}
            </button>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded">
              <p className="text-red-800">Fehler: {error}</p>
            </div>
          )}

          {loading && (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              <p className="mt-4 text-gray-600">Tests werden ausgeführt...</p>
            </div>
          )}

          {testResults && !loading && (
            <div>
              <div className={`mb-6 p-4 rounded ${testResults.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                <p className={`font-semibold ${testResults.success ? 'text-green-800' : 'text-red-800'}`}>
                  {testResults.success
                    ? '✅ Alle Tests erfolgreich!'
                    : '❌ Einige Tests sind fehlgeschlagen'}
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  Zeitstempel: {new Date(testResults.timestamp).toLocaleString('de-DE')}
                </p>
              </div>

              <div className="space-y-4">
                {testResults.results.map((result, index) => (
                  <div
                    key={index}
                    className="border rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start">
                      <span className="text-2xl mr-3">
                        {getStatusIcon(result.status)}
                      </span>
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900">
                          {result.name}
                        </h3>
                        <p className={`text-sm ${getStatusColor(result.status)}`}>
                          {result.message}
                        </p>

                        {result.details && (
                          <div className="mt-2 p-2 bg-gray-50 rounded text-xs">
                            <pre className="whitespace-pre-wrap text-gray-700">
                              {JSON.stringify(result.details, null, 2)}
                            </pre>
                          </div>
                        )}

                        {result.error && (
                          <div className="mt-2 p-2 bg-red-50 rounded text-xs text-red-700">
                            {result.error}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 text-sm text-gray-600 text-center">
          <p>Diese Seite testet die Verbindung zu Supabase in der Produktionsumgebung.</p>
          <p className="mt-1">Für detaillierte Logs siehe API-Route: <code className="bg-gray-100 px-2 py-1 rounded">/api/test-supabase</code></p>
        </div>
      </div>
    </div>
  )
}
