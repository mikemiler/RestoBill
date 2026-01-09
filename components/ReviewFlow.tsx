'use client'

import { useState } from 'react'

// Sentiment options
const SENTIMENTS = [
  { value: 'SUPER', emoji: '😍', label: 'Super' },
  { value: 'GUT', emoji: '😊', label: 'Gut' },
  { value: 'OKAY', emoji: '😐', label: 'Okay' },
  { value: 'MAESSIG', emoji: '😕', label: 'Mäßig' },
  { value: 'SCHLECHT', emoji: '😞', label: 'Schlecht' },
] as const

type SentimentValue = (typeof SENTIMENTS)[number]['value']

type ReviewFlowStep = 'sentiment' | 'feedback' | 'google' | 'thanks'

interface ReviewFlowProps {
  billId: string
  shareToken: string
  selectionId?: string
  restaurantName: string
  googlePlaceId?: string | null
  onComplete?: () => void
  onSkip?: () => void
}

export default function ReviewFlow({
  billId,
  shareToken,
  selectionId,
  restaurantName,
  googlePlaceId,
  onComplete,
  onSkip,
}: ReviewFlowProps) {
  const [step, setStep] = useState<ReviewFlowStep>('sentiment')
  const [selectedSentiment, setSelectedSentiment] = useState<SentimentValue | null>(null)
  const [internalFeedback, setInternalFeedback] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isPositiveSentiment = (sentiment: SentimentValue) => {
    return sentiment === 'SUPER' || sentiment === 'GUT'
  }

  const handleSentimentSelect = async (sentiment: SentimentValue) => {
    setSelectedSentiment(sentiment)
    setError(null)

    // Determine next step
    if (isPositiveSentiment(sentiment)) {
      // Positive: Check if Google Place ID exists
      if (googlePlaceId) {
        setStep('google')
      } else {
        // No Google Place ID, submit directly
        await submitReview(sentiment, false, null)
      }
    } else {
      // Negative: Show feedback form
      setStep('feedback')
    }
  }

  const submitReview = async (
    sentiment: SentimentValue,
    googleReviewClicked: boolean,
    feedback: string | null
  ) => {
    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          billId,
          shareToken,
          selectionId: selectionId || null,
          sentiment,
          googleReviewClicked,
          internalFeedback: feedback,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Fehler beim Speichern')
      }

      // Success - show thanks screen
      setStep('thanks')
    } catch (err: any) {
      setError(err.message || 'Ein Fehler ist aufgetreten')
      setIsSubmitting(false)
    }
  }

  const handleGoogleReviewClick = async () => {
    if (!selectedSentiment || !googlePlaceId) return

    // Submit review with Google click tracked
    await submitReview(selectedSentiment, true, null)

    // Open Google Review in new tab
    const googleReviewUrl = `https://search.google.com/local/writereview?placeid=${googlePlaceId}`
    window.open(googleReviewUrl, '_blank', 'noopener,noreferrer')
  }

  const handleSkipGoogleReview = async () => {
    if (!selectedSentiment) return
    await submitReview(selectedSentiment, false, null)
  }

  const handleFeedbackSubmit = async () => {
    if (!selectedSentiment) return
    await submitReview(selectedSentiment, false, internalFeedback || null)
  }

  const handleSkipFeedback = async () => {
    if (!selectedSentiment) return
    await submitReview(selectedSentiment, false, null)
  }

  const handleClose = () => {
    if (onComplete) {
      onComplete()
    }
  }

  // Step 1: Sentiment Picker
  if (step === 'sentiment') {
    return (
      <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
          <h2 className="text-2xl font-bold mb-2 text-gray-800 dark:text-gray-100">
            Wie war deine Erfahrung?
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Bei {restaurantName}
          </p>

          <div className="grid grid-cols-5 gap-3 mb-6">
            {SENTIMENTS.map((sentiment) => (
              <button
                key={sentiment.value}
                onClick={() => handleSentimentSelect(sentiment.value)}
                className="flex flex-col items-center gap-2 p-3 rounded-lg border-2 border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all"
              >
                <span className="text-4xl">{sentiment.emoji}</span>
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  {sentiment.label}
                </span>
              </button>
            ))}
          </div>

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400 mb-4">{error}</p>
          )}

          {onSkip && (
            <button
              onClick={onSkip}
              className="w-full text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            >
              Vielleicht später
            </button>
          )}
        </div>
      </div>
    )
  }

  // Step 2a: Google Review (Positive sentiment)
  if (step === 'google') {
    return (
      <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
          <div className="text-center mb-6">
            <span className="text-6xl mb-4 inline-block">
              {SENTIMENTS.find((s) => s.value === selectedSentiment)?.emoji}
            </span>
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
              Super, das freut uns!
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              Magst du auch eine Google-Bewertung hinterlassen?
            </p>
          </div>

          <div className="space-y-3">
            <button
              onClick={handleGoogleReviewClick}
              disabled={isSubmitting}
              className="w-full bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors disabled:opacity-50"
            >
              {isSubmitting ? 'Wird gespeichert...' : 'Ja, zu Google'}
            </button>

            <button
              onClick={handleSkipGoogleReview}
              disabled={isSubmitting}
              className="w-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-semibold py-3 px-4 rounded-lg transition-colors disabled:opacity-50"
            >
              {isSubmitting ? 'Wird gespeichert...' : 'Vielleicht später'}
            </button>
          </div>

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400 mt-4 text-center">{error}</p>
          )}
        </div>
      </div>
    )
  }

  // Step 2b: Feedback Form (Negative sentiment)
  if (step === 'feedback') {
    return (
      <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
          <div className="text-center mb-6">
            <span className="text-6xl mb-4 inline-block">
              {SENTIMENTS.find((s) => s.value === selectedSentiment)?.emoji}
            </span>
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
              Schade zu hören!
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              Möchtest du uns mehr dazu sagen?
            </p>
          </div>

          <textarea
            value={internalFeedback}
            onChange={(e) => setInternalFeedback(e.target.value)}
            placeholder="Was können wir verbessern? (optional)"
            className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg mb-4 min-h-[100px] bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
            maxLength={1000}
          />

          <div className="space-y-3">
            <button
              onClick={handleFeedbackSubmit}
              disabled={isSubmitting}
              className="w-full bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors disabled:opacity-50"
            >
              {isSubmitting ? 'Wird gespeichert...' : 'Feedback senden'}
            </button>

            <button
              onClick={handleSkipFeedback}
              disabled={isSubmitting}
              className="w-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-semibold py-3 px-4 rounded-lg transition-colors disabled:opacity-50"
            >
              {isSubmitting ? 'Wird gespeichert...' : 'Überspringen'}
            </button>
          </div>

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400 mt-4 text-center">{error}</p>
          )}
        </div>
      </div>
    )
  }

  // Step 3: Thanks
  if (step === 'thanks') {
    return (
      <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
          <div className="text-center">
            <span className="text-6xl mb-4 inline-block">🙏</span>
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">
              Vielen Dank!
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Dein Feedback hilft uns sehr.
            </p>

            <button
              onClick={handleClose}
              className="w-full bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
            >
              Schließen
            </button>
          </div>
        </div>
      </div>
    )
  }

  return null
}
