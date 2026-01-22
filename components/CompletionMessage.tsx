'use client'

interface CompletionMessageProps {
  onDismiss: () => void
}

export default function CompletionMessage({ onDismiss }: CompletionMessageProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-gradient-to-br from-green-900/90 to-emerald-900/90 border border-green-500/50 rounded-lg shadow-2xl p-6 max-w-md w-full relative animate-in zoom-in duration-300">
        {/* Close Button */}
        <button
          onClick={onDismiss}
          className="absolute top-3 right-3 text-green-200 hover:text-white transition-colors"
          aria-label="Schließen"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Success Icon */}
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center">
            <svg
              className="w-10 h-10 text-green-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
        </div>

        {/* Message */}
        <h2 className="text-2xl font-bold text-center text-white mb-3">
          Alles aufgeteilt!
        </h2>
        <p className="text-center text-green-100 text-lg">
          Vergiss nicht zu zahlen, falls du es nicht schon getan hast.
        </p>

        {/* Dismiss Button */}
        <button
          onClick={onDismiss}
          className="mt-6 w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
        >
          Alles klar!
        </button>
      </div>
    </div>
  )
}
