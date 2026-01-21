'use client'

import { useState, useEffect } from 'react'
import { getOrCreateSessionId } from '@/lib/sessionStorage'

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
      alert('Session wird geladen, bitte versuche es in einem Moment erneut.')
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
        alert(`Fehler: ${data.error || 'Unbekannter Fehler'}`)
        return
      }

      setIsSubmitted(true)
    } catch (error) {
      console.error('Fehler beim Speichern des Feedbacks:', error)
      alert('Fehler beim Speichern des Feedbacks. Bitte versuche es erneut.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSubmitFeedback = async () => {
    if (!selectedRating || (selectedRating < 3 && !feedbackText.trim())) {
      alert('Bitte gib dein Feedback ein')
      return
    }

    await saveFeedback(selectedRating, feedbackText.trim())
  }

  return (
    <div className="border border-gray-700 rounded-lg p-6 bg-gray-800/50">
      <h3 className="text-xl font-semibold mb-4 text-center">
        Wie war deine Erfahrung im Restaurant?
      </h3>

      {/* Smiley Selection */}
      <div className="flex justify-center gap-6 mb-6">
        {/* Schlecht */}
        <button
          onClick={() => handleRatingSelect(1)}
          className={`text-6xl transition-all hover:scale-110 ${
            selectedRating === 1 ? 'scale-125' : 'opacity-50 hover:opacity-100'
          }`}
          disabled={isSubmitting}
          title="Schlecht"
        >
          🤮
        </button>

        {/* Mittel */}
        <button
          onClick={() => handleRatingSelect(2)}
          className={`text-6xl transition-all hover:scale-110 ${
            selectedRating === 2 ? 'scale-125' : 'opacity-50 hover:opacity-100'
          }`}
          disabled={isSubmitting}
          title="Mittel"
        >
          😐
        </button>

        {/* Top */}
        <button
          onClick={() => handleRatingSelect(3)}
          className={`text-6xl transition-all hover:scale-110 ${
            selectedRating === 3 ? 'scale-125' : 'opacity-50 hover:opacity-100'
          }`}
          disabled={isSubmitting}
          title="Top"
        >
          🤩
        </button>
      </div>

      {/* Rating 3 (Top) - Show Google Review Link */}
      {selectedRating === 3 && reviewUrl && (
        <div className="text-center space-y-3">
          <p className="text-green-400 font-medium">
            Danke für deine positive Bewertung!
          </p>
          <div className="space-y-2">
            <p className="text-gray-300 text-sm">
              Hilf {restaurantName || 'dem Restaurant'} und hinterlasse eine Bewertung
            </p>
            <a
              href={reviewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
            >
              Google Maps Bewertung
            </a>
          </div>
          {isSubmitted && (
            <p className="text-sm text-gray-400">
              Vielen Dank für dein Feedback!
            </p>
          )}
        </div>
      )}

      {/* Rating 3 (Top) - No Review URL */}
      {selectedRating === 3 && !reviewUrl && (
        <div className="text-center">
          <p className="text-green-400 font-medium">
            Danke für deine positive Bewertung!
          </p>
          {isSubmitted && (
            <p className="text-sm text-gray-400 mt-2">
              Vielen Dank für dein Feedback!
            </p>
          )}
        </div>
      )}

      {/* Rating 1 or 2 - Show Feedback Textarea */}
      {selectedRating && selectedRating < 3 && (
        <div className="space-y-4">
          <p className="text-yellow-400 text-center font-medium">
            Danke für dein Feedback. Was kann das Restaurant verbessern?
          </p>
          <textarea
            value={feedbackText}
            onChange={(e) => setFeedbackText(e.target.value)}
            placeholder="Dein persönliches Feedback an das Restaurant..."
            className="w-full bg-gray-900 border border-gray-700 rounded-lg p-4 text-white min-h-[120px] resize-y focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isSubmitting || isSubmitted}
          />
          {!isSubmitted ? (
            <button
              onClick={handleSubmitFeedback}
              disabled={isSubmitting || !feedbackText.trim()}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition-colors"
            >
              {isSubmitting ? 'Wird gesendet...' : 'Feedback senden'}
            </button>
          ) : (
            <p className="text-green-400 text-center font-medium">
              ✓ Vielen Dank für dein Feedback! Wir werden es an das Restaurant weiterleiten.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
