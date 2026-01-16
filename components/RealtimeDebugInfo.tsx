'use client'

import { useState, useEffect } from 'react'

/**
 * Debug Component for Realtime Diagnostics
 *
 * Shows:
 * - Environment variables status
 * - Browser info
 * - WebSocket support
 * - Current URL
 * - Network status
 */
export default function RealtimeDebugInfo() {
  const [isExpanded, setIsExpanded] = useState(false)
  const [networkStatus, setNetworkStatus] = useState<'online' | 'offline'>('online')

  useEffect(() => {
    const handleOnline = () => setNetworkStatus('online')
    const handleOffline = () => setNetworkStatus('offline')

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Log everything to console on mount
  useEffect(() => {
    const timestamp = new Date().toISOString()
    console.log(`🔧 [DEBUG ${timestamp}] ===== ENVIRONMENT DIAGNOSTICS =====`)
    console.log('[DEBUG] 🌍 Environment:', {
      NODE_ENV: process.env.NODE_ENV,
      isProduction: process.env.NODE_ENV === 'production',
      isVercel: !!process.env.NEXT_PUBLIC_VERCEL_URL
    })
    console.log('[DEBUG] 🔐 Supabase Config:', {
      SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅ Set' : '❌ Missing',
      SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✅ Set' : '❌ Missing',
      SUPABASE_URL_VALUE: process.env.NEXT_PUBLIC_SUPABASE_URL,
      ANON_KEY_LENGTH: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.length || 0
    })
    console.log('[DEBUG] 🌐 Browser Info:', {
      userAgent: navigator.userAgent,
      language: navigator.language,
      platform: navigator.platform,
      cookiesEnabled: navigator.cookieEnabled,
      onLine: navigator.onLine
    })
    console.log('[DEBUG] 📡 WebSocket Support:', {
      webSocketAvailable: 'WebSocket' in window,
      webSocketConstructor: typeof WebSocket
    })
    console.log('[DEBUG] 🔗 Current Page:', {
      href: window.location.href,
      hostname: window.location.hostname,
      protocol: window.location.protocol,
      pathname: window.location.pathname
    })
    console.log('[DEBUG] 💾 LocalStorage:', {
      available: !!window.localStorage,
      sessionIdExists: !!localStorage.getItem('userSessionId'),
      sessionId: localStorage.getItem('userSessionId')
    })
    console.log('[DEBUG] ===== ENVIRONMENT DIAGNOSTICS END =====')
  }, [])

  const envVars = {
    'Supabase URL': process.env.NEXT_PUBLIC_SUPABASE_URL || '❌ MISSING',
    'Supabase Anon Key': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      ? `✅ Set (${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.substring(0, 20)}...)`
      : '❌ MISSING',
    'Environment': process.env.NODE_ENV || 'unknown',
    'Vercel': process.env.NEXT_PUBLIC_VERCEL_URL ? '✅ Yes' : '❌ No (localhost)'
  }

  const browserInfo = typeof window !== 'undefined' ? {
    'User Agent': navigator.userAgent,
    'Online': navigator.onLine ? '✅ Yes' : '❌ No',
    'WebSocket': 'WebSocket' in window ? '✅ Supported' : '❌ Not Supported',
    'Current URL': window.location.href,
    'Protocol': window.location.protocol
  } : {}

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 text-sm font-medium"
      >
        🔧 Debug Info
        {networkStatus === 'offline' && <span className="text-red-300">⚠️ OFFLINE</span>}
      </button>

      {isExpanded && (
        <div className="absolute bottom-14 right-0 bg-gray-900 text-gray-100 rounded-lg shadow-2xl p-4 w-[500px] max-h-[600px] overflow-y-auto text-xs">
          <div className="flex justify-between items-center mb-3 pb-2 border-b border-gray-700">
            <h3 className="font-bold text-sm">🔧 Realtime Diagnostics</h3>
            <button
              onClick={() => setIsExpanded(false)}
              className="text-gray-400 hover:text-white"
            >
              ✕
            </button>
          </div>

          <div className="space-y-4">
            {/* Environment Variables */}
            <div>
              <h4 className="font-semibold text-green-400 mb-2">🔐 Environment Variables</h4>
              <div className="space-y-1 bg-gray-800 p-2 rounded">
                {Object.entries(envVars).map(([key, value]) => (
                  <div key={key} className="flex justify-between">
                    <span className="text-gray-400">{key}:</span>
                    <span className="font-mono text-xs">{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Browser Info */}
            <div>
              <h4 className="font-semibold text-blue-400 mb-2">🌐 Browser Info</h4>
              <div className="space-y-1 bg-gray-800 p-2 rounded">
                {Object.entries(browserInfo).map(([key, value]) => (
                  <div key={key} className="flex flex-col gap-1">
                    <span className="text-gray-400">{key}:</span>
                    <span className="font-mono text-xs break-all text-gray-300">{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Instructions */}
            <div className="bg-yellow-900/30 border border-yellow-600 rounded p-3">
              <h4 className="font-semibold text-yellow-400 mb-2">📋 Debug Instructions</h4>
              <ol className="list-decimal list-inside space-y-1 text-gray-300">
                <li>Open Browser Console (F12)</li>
                <li>Look for <code className="bg-gray-800 px-1 rounded">⚡ [Realtime]</code> messages</li>
                <li>Check for WebSocket in Network tab (filter: WS)</li>
                <li>Watch for connection status changes</li>
                <li>Look for <code className="bg-gray-800 px-1 rounded">SELECTION CHANGE EVENT</code> blocks</li>
              </ol>
            </div>

            {/* Quick Checks */}
            <div className="bg-purple-900/30 border border-purple-600 rounded p-3">
              <h4 className="font-semibold text-purple-400 mb-2">✅ Quick Checks</h4>
              <div className="space-y-1 text-gray-300">
                <div>
                  {process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅' : '❌'} Supabase URL configured
                </div>
                <div>
                  {process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✅' : '❌'} Supabase Anon Key configured
                </div>
                <div>
                  {'WebSocket' in window ? '✅' : '❌'} WebSocket supported
                </div>
                <div>
                  {navigator.onLine ? '✅' : '❌'} Browser online
                </div>
                <div>
                  {localStorage.getItem('userSessionId') ? '✅' : '⚠️'} Session ID exists
                </div>
              </div>
            </div>

            {/* Console Hint */}
            <div className="text-center text-gray-500 text-xs border-t border-gray-700 pt-2">
              Check browser console for detailed logs 👆
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
