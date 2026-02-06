'use client'

import { useState, useEffect } from 'react'
import { getOrCreateSessionId } from '@/lib/sessionStorage'
import { useTranslation, interpolate } from '@/lib/i18n'

interface RestaurantFeedbackProps {
  billId: string
  reviewUrl?: string | null
  restaurantName?: string | null
}

export default function RestaurantFeedback({
  billId,
  reviewUrl,
  restaurantName
}: RestaurantFeedbackProps) {
  const [selectedRating, setSelectedRating] = useState<number | null>(null)
  const [feedbackText, setFeedbackText] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [sessionId, setSessionId] = useState<string>('')
  const { t } = useTranslation()

  useEffect(() => {
    setSessionId(getOrCreateSessionId())
  }, [])

  const handleRatingSelect = async (rating: number) => {
    setSelectedRating(rating)
    setIsSubmitted(false)

    // For rating 3 (top), immediately save feedback
    if (rating === 3) {
      await saveFeedback(rating, null)
    }
  }

  const saveFeedback = async (rating: number, text: string | null) => {
    if (!sessionId) {
      alert(t.feedback.sessionLoading)
      return
    }

    setIsSubmitting(true)
    try {
      console.log('Sending feedback:', { billId, sessionId, rating, feedbackText: text })

      const response = await fetch('/api/feedback/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          billId,
          sessionId,
          rating,
          feedbackText: text
        })
      })

      const data = await response.json()
      console.log('API response:', data)

      if (!response.ok) {
        console.error('API error:', data)
        alert(`${t.common.error}: ${data.error || t.feedback.errorUnknown}`)
        return
      }

      setIsSubmitted(true)
    } catch (error) {
      console.error('Error saving feedback:', error)
      alert(t.feedback.errorSaving)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSubmitFeedback = async () => {
    if (!selectedRating || (selectedRating < 3 && !feedbackText.trim())) {
      alert(t.feedback.enterFeedback)
      return
    }

    await saveFeedback(selectedRating, feedbackText.trim())
  }

  return (
    <div className="border border-gray-700 rounded-lg p-6 bg-gray-800/50">
      <h3 className="text-xl font-semibold mb-4 text-center">
        {t.feedback.title}
      </h3>

      {/* Smiley Selection */}
      <div className="flex justify-center gap-6 mb-6">
        <button
          onClick={() => handleRatingSelect(1)}
          className={`text-6xl transition-all hover:scale-110 ${
            selectedRating === 1 ? 'scale-125' : 'opacity-50 hover:opacity-100'
          }`}
          disabled={isSubmitting}
          title={t.feedback.bad}
        >
          🤮
        </button>

        <button
          onClick={() => handleRatingSelect(2)}
          className={`text-6xl transition-all hover:scale-110 ${
            selectedRating === 2 ? 'scale-125' : 'opacity-50 hover:opacity-100'
          }`}
          disabled={isSubmitting}
          title={t.feedback.medium}
        >
          😐
        </button>

        <button
          onClick={() => handleRatingSelect(3)}
          className={`text-6xl transition-all hover:scale-110 ${
            selectedRating === 3 ? 'scale-125' : 'opacity-50 hover:opacity-100'
          }`}
          disabled={isSubmitting}
          title={t.feedback.top}
        >
          🤩
        </button>
      </div>

      {/* Rating 3 (Top) - Show Google Review Link */}
      {selectedRating === 3 && reviewUrl && (
        <div className="text-center space-y-3">
          <p className="text-green-400 font-medium">
            {t.feedback.thanksPositive}
          </p>
          <div className="space-y-2">
            <p className="text-gray-300 text-sm">
              {interpolate(t.feedback.helpReview, { restaurant: restaurantName || 'Restaurant' })}
            </p>
            <a
              href={reviewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
            >
              {t.feedback.googleReview}
            </a>
          </div>
          {isSubmitted && (
            <p className="text-sm text-gray-400">
              {t.feedback.thanksFeedback}
            </p>
          )}
        </div>
      )}

      {/* Rating 3 (Top) - No Review URL */}
      {selectedRating === 3 && !reviewUrl && (
        <div className="text-center">
          <p className="text-green-400 font-medium">
            {t.feedback.thanksPositive}
          </p>
          {isSubmitted && (
            <p className="text-sm text-gray-400 mt-2">
              {t.feedback.thanksFeedback}
            </p>
          )}
        </div>
      )}

      {/* Rating 1 or 2 - Show Feedback Textarea */}
      {selectedRating && selectedRating < 3 && (
        <div className="space-y-4">
          <p className="text-yellow-400 text-center font-medium">
            {t.feedback.whatCanImprove}
          </p>
          <textarea
            value={feedbackText}
            onChange={(e) => setFeedbackText(e.target.value)}
            placeholder={t.feedback.feedbackPlaceholder}
            className="w-full bg-gray-900 border border-gray-700 rounded-lg p-4 text-white min-h-[120px] resize-y focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isSubmitting || isSubmitted}
          />
          {!isSubmitted ? (
            <button
              onClick={handleSubmitFeedback}
              disabled={isSubmitting || !feedbackText.trim()}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition-colors"
            >
              {isSubmitting ? t.feedback.sending : t.feedback.sendFeedback}
            </button>
          ) : (
            <p className="text-green-400 text-center font-medium">
              {t.feedback.feedbackSent}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
