'use client'

import { useState, useEffect } from 'react'
import { formatEUR } from '@/lib/utils'
import VerticalWheel from './VerticalWheel'

interface BillItem {
  id: string
  name: string
  quantity: number
  pricePerUnit: number
  totalPrice: number
}

interface PersonSelection {
  name: string
  amount: number
  color: string
  isMe: boolean
}

interface BillItemCardProps {
  item: BillItem
  selectedQuantity: number
  onQuantityChange: (quantity: number) => void
  friendName: string
  otherSelections: Array<{ guestName: string; quantity: number }>
  remainingQuantity: number
  isOwner?: boolean
  onEdit?: () => void
  onDelete?: () => void
}

export default function BillItemCard({
  item,
  selectedQuantity,
  onQuantityChange,
  friendName,
  otherSelections,
  remainingQuantity,
  isOwner = false,
  onEdit,
  onDelete
}: BillItemCardProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [showBadges, setShowBadges] = useState(false)
  const [showFraction, setShowFraction] = useState(false)
  const [numerator, setNumerator] = useState(1)
  const [denominator, setDenominator] = useState(2)
  const [showMenu, setShowMenu] = useState(false)

  // Calculate whole number and fractional part
  const wholeNumber = Math.floor(selectedQuantity)
  const fractionalPart = selectedQuantity - wholeNumber

  // Update numerator/denominator when fraction panel opens with existing fractional selection
  useEffect(() => {
    if (showFraction) {
      if (fractionalPart > 0.01) {
        console.log('[BillItemCard] Fraction panel opened with existing fractional selection:', fractionalPart)

        // Try to find matching fraction (all denominators 2-30)
        // DON'T simplify - take first match to preserve user's denominator choice
        for (let den = 2; den <= 30; den++) {
          for (let num = 1; num < den; num++) {
            const fracValue = num / den
            if (Math.abs(fractionalPart - fracValue) < 0.01) {
              // Found a match - use as-is WITHOUT simplifying
              console.log('[BillItemCard] Auto-populated fraction (not simplified):', num, '/', den)
              setNumerator(num)
              setDenominator(den)
              return
            }
          }
        }
        console.log('[BillItemCard] No matching fraction found for:', fractionalPart)
      } else {
        // No fractional part - reset to 0
        console.log('[BillItemCard] No fractional part, resetting numerator to 0')
        setNumerator(0)
      }
    }
  }, [showFraction]) // Only trigger when panel opens, not on fractionalPart changes!

  // Calculate totals
  const myAmount = selectedQuantity
  const othersTotal = otherSelections.reduce((sum, sel) => sum + sel.quantity, 0)
  const totalAssigned = myAmount + othersTotal
  const actualOpen = Math.max(0, item.quantity - totalAssigned)
  const isComplete = actualOpen <= 0
  const isOverselected = totalAssigned > item.quantity
  const overselection = Math.max(0, totalAssigned - item.quantity)

  // Progress percentage
  const progress = Math.min(100, (totalAssigned / item.quantity) * 100)
  const overProgress = isOverselected ? ((totalAssigned - item.quantity) / item.quantity) * 100 : 0

  // Detect if current selection is a fraction
  const isFractionalSelection = fractionalPart > 0.01

  // Build people list for badge section
  const assignedPeople: PersonSelection[] = [
    { name: friendName, amount: myAmount, color: '#10b981', isMe: true },
    ...otherSelections.map((sel, idx) => ({
      name: sel.guestName,
      amount: sel.quantity,
      color: ['#a855f7', '#3b82f6', '#f97316', '#ec4899'][idx % 4],
      isMe: false
    }))
  ].filter(p => p.amount > 0)

  // Format quantity as fraction or decimal
  function formatQuantity(qty: number): string {
    if (qty % 1 === 0) return qty.toString()

    // Try to find the simplest fraction representation
    // Check all denominators from 2 to 30 (matches VerticalWheel max)
    for (let den = 2; den <= 30; den++) {
      for (let num = 1; num < den; num++) {
        const fracValue = num / den
        if (Math.abs(qty - fracValue) < 0.01) {
          // Found a matching fraction - check if it's in simplest form
          const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b)
          const divisor = gcd(num, den)
          const simpleNum = num / divisor
          const simpleDen = den / divisor
          return `${simpleNum}/${simpleDen}`
        }
      }
    }

    // Fallback to decimal if no fraction found (should rarely happen)
    return qty.toFixed(2)
  }

  // Handle stepper increment (only whole numbers)
  function handleIncrement() {
    const newQty = Math.min(item.quantity, wholeNumber + 1 + fractionalPart)
    onQuantityChange(newQty)
  }

  // Handle stepper decrement (only whole numbers)
  function handleDecrement() {
    const newQty = Math.max(0, wholeNumber - 1 + fractionalPart)
    onQuantityChange(newQty)
  }

  // Live update when numerator or denominator changes
  useEffect(() => {
    if (showFraction) {
      // If numerator is 0, just use whole number (no fraction)
      const fractionValue = numerator === 0 ? wholeNumber : wholeNumber + (numerator / denominator)
      console.log('[BillItemCard] Live fraction update:', {
        wholeNumber,
        numerator,
        denominator,
        fractionValue,
        noFraction: numerator === 0
      })
      onQuantityChange(fractionValue)
    }
  }, [numerator, denominator]) // Only trigger on numerator/denominator changes, not wholeNumber

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl overflow-hidden shadow-lg border-2 border-gray-200 dark:border-gray-700">
      {/* Accordion Header - Clickable */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-gray-800 dark:bg-gray-800 p-4 hover:bg-gray-750 dark:hover:bg-gray-750 transition-colors relative"
      >
        <div className="flex items-start justify-between gap-4">
          {/* Left: Name */}
          <div className="flex-1 text-left">
            <div className="text-white font-medium text-base pr-10 capitalize">{item.name.toLowerCase()}</div>
          </div>

          {/* Owner Menu Button */}
          {isOwner && onEdit && onDelete && (
            <div className="absolute top-2 right-2" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setShowMenu(!showMenu)
                }}
                className="p-1.5 hover:bg-gray-700 dark:hover:bg-gray-600 rounded-lg transition-colors"
                title="Aktionen"
              >
                <svg className="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                </svg>
              </button>
              {showMenu && (
                <div className="absolute right-0 mt-1 w-40 bg-white dark:bg-gray-700 rounded-lg shadow-lg border border-gray-200 dark:border-gray-600 overflow-hidden z-20">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setShowMenu(false)
                      onEdit()
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                  >
                    ✏️ Bearbeiten
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setShowMenu(false)
                      onDelete()
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    🗑️ Löschen
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Right: Badges + Chevron */}
          <div className="flex items-center gap-2">
            {/* Avatar stack */}
            {assignedPeople.length > 0 && (
              <div className="flex -space-x-3">
                {assignedPeople.slice(0, 4).map((p, i) => (
                  <div
                    key={p.name}
                    className={`relative ${p.isMe ? 'ring-2 ring-emerald-400 dark:ring-emerald-500 rounded-full' : ''}`}
                    style={{ zIndex: 10 - i }}
                  >
                    <div
                      className="w-8 h-8 rounded-full border-2 border-gray-800 dark:border-gray-700 flex items-center justify-center text-xs font-bold text-white"
                      style={{ backgroundColor: p.isMe ? p.color : '#6b7280' }}
                    >
                      {p.name[0]}
                    </div>
                    <div className="absolute -bottom-1 -right-1 bg-gray-900 dark:bg-gray-800 text-[9px] text-white px-1 rounded-full border border-gray-700 dark:border-gray-600 font-medium">
                      {formatQuantity(p.amount)}
                    </div>
                  </div>
                ))}
                {assignedPeople.length > 4 && (
                  <div className="w-8 h-8 rounded-full border-2 border-gray-800 dark:border-gray-700 bg-gray-700 dark:bg-gray-600 flex items-center justify-center text-xs text-gray-400 dark:text-gray-300">
                    +{assignedPeople.length - 4}
                  </div>
                )}
              </div>
            )}

            {/* Chevron */}
            <div className={`text-gray-400 dark:text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}>
              ▼
            </div>
          </div>
        </div>

        {/* Progress bar in header - clickable to show "Wer hatte das" */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            setShowBadges(!showBadges)
          }}
          className="w-full mt-3 group"
        >
          <div className="relative">
            <div className="h-6 bg-gray-700 dark:bg-gray-600 rounded-full overflow-hidden group-hover:opacity-80 transition-opacity">
              <div
                className={`h-full transition-all duration-500 ${
                  isOverselected
                    ? 'bg-gradient-to-r from-red-600 to-red-400 dark:from-red-700 dark:to-red-500'
                    : isComplete
                    ? 'bg-gradient-to-r from-emerald-600 to-emerald-400 dark:from-emerald-700 dark:to-emerald-500'
                    : 'bg-gradient-to-r from-orange-600 to-orange-400 dark:from-orange-700 dark:to-orange-500'
                }`}
                style={{ width: `${Math.min(100, progress)}%` }}
              />
            </div>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span className={`text-sm font-medium text-white`}>
                {isOverselected ? (
                  `❗ Überbucht: ${formatQuantity(overselection)}× zu viel`
                ) : isComplete ? (
                  '✓ Vollständig aufgeteilt'
                ) : (
                  `Noch ${formatQuantity(actualOpen)}× offen`
                )}
              </span>
            </div>
          </div>
        </button>
      </button>

      {/* Accordion Body - Collapsible */}
      <div className={`overflow-hidden transition-all duration-300 ${isOpen ? 'max-h-[2000px]' : 'max-h-0'}`}>
        <div className="bg-gray-800 dark:bg-gray-800 p-4 pt-2">

        {/* Expandable badge list */}
        <div className={`overflow-hidden transition-all duration-300 ${showBadges ? 'max-h-64 mb-4' : 'max-h-0'}`}>
          <div className="bg-gray-900 dark:bg-gray-800 rounded-xl p-3 space-y-2">
            <div className="text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide mb-2">Wer hatte das</div>
            {[
              { name: friendName, amount: myAmount, color: '#10b981', isMe: true },
              ...otherSelections.map((sel, idx) => ({
                name: sel.guestName,
                amount: sel.quantity,
                color: ['#a855f7', '#3b82f6', '#f97316', '#ec4899'][idx % 4],
                isMe: false
              }))
            ].map(p => (
              <div
                key={p.name}
                className={`flex items-center justify-between py-2 px-3 rounded-lg transition-all ${
                  p.amount > 0 ? 'bg-gray-800 dark:bg-gray-700' : 'opacity-40'
                } ${p.isMe ? 'ring-1 ring-emerald-500/50 dark:ring-emerald-400/50' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white"
                    style={{ backgroundColor: p.color }}
                  >
                    {p.name[0]}
                  </div>
                  <span className={`font-medium ${p.amount > 0 ? 'text-white' : 'text-gray-500 dark:text-gray-400'}`}>
                    {p.name}
                    {p.isMe && <span className="text-emerald-400 dark:text-emerald-500 text-xs ml-2">(Du)</span>}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`font-bold ${p.amount > 0 ? 'text-white' : 'text-gray-600 dark:text-gray-500'}`}>
                    {p.amount > 0 ? `${formatQuantity(p.amount)}×` : '–'}
                  </span>
                  <span className={`text-sm ${p.amount > 0 ? 'text-gray-400 dark:text-gray-500' : 'text-gray-600 dark:text-gray-500'}`}>
                    {formatEUR(p.amount * item.pricePerUnit)}
                  </span>
                </div>
              </div>
            ))}

            {/* Open row */}
            {actualOpen > 0 && (
              <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gray-600 dark:bg-gray-700 flex items-center justify-center text-sm text-gray-400 dark:text-gray-500">
                    ?
                  </div>
                  <span className="font-medium text-amber-400 dark:text-amber-500">Noch offen</span>
                </div>
                <span className="font-bold text-amber-400 dark:text-amber-500">
                  {formatQuantity(actualOpen)}×
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Stepper */}
        <div className="flex items-center justify-center gap-6 mb-4">
          <button
            type="button"
            onClick={handleDecrement}
            disabled={wholeNumber === 0}
            className="w-16 h-16 rounded-full bg-gray-700 dark:bg-gray-600 hover:bg-gray-600 dark:hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed text-3xl text-white font-bold transition-all active:scale-95"
          >
            −
          </button>

          <div className="text-center min-w-[120px]">
            {isFractionalSelection ? (
              <div className="flex items-center justify-center gap-2">
                {wholeNumber > 0 && <span className="text-5xl font-bold text-white">{wholeNumber}</span>}
                {wholeNumber > 0 && <span className="text-3xl font-bold text-purple-400 dark:text-purple-500">+</span>}
                <span className={`${wholeNumber > 0 ? 'text-3xl' : 'text-5xl'} font-bold text-purple-400 dark:text-purple-500`}>{formatQuantity(fractionalPart)}</span>
              </div>
            ) : (
              <div className="text-5xl font-bold text-white">{wholeNumber}</div>
            )}
          </div>

          <button
            type="button"
            onClick={handleIncrement}
            className="w-16 h-16 rounded-full text-3xl text-white font-bold transition-all active:scale-95 bg-blue-500 hover:bg-blue-400 dark:bg-blue-600 dark:hover:bg-blue-500"
          >
            +
          </button>
        </div>

        {/* Fraction toggle */}
        <button
          type="button"
          onClick={() => setShowFraction(!showFraction)}
          className={`w-full py-3 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 ${
            showFraction || isFractionalSelection
              ? 'bg-purple-500/20 text-purple-400 dark:text-purple-500 border border-purple-500 dark:border-purple-400'
              : 'bg-gray-700 dark:bg-gray-600 text-gray-300 dark:text-gray-400 hover:bg-gray-600 dark:hover:bg-gray-500 hover:text-white dark:hover:text-white'
          }`}
        >
          {showFraction ? '▼' : '▶'} Anteilige Menge
        </button>

        {/* Vertical wheel sliders for fractions */}
        <div className={`overflow-hidden transition-all duration-300 ${showFraction ? 'max-h-[280px] mt-4' : 'max-h-0'}`}>
          <div className="bg-gray-900 dark:bg-gray-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-center gap-6">
              <VerticalWheel
                value={numerator}
                onChange={(v) => {
                  const newNum = Math.min(v, denominator - 1)
                  console.log('[BillItemCard] Numerator changed:', v, '→', newNum, '(max:', denominator - 1, ')')
                  setNumerator(newNum)
                }}
                min={0}
                max={denominator - 1}
                label="Für mich"
              />

              <div className="flex flex-col items-center justify-center h-full">
                <div className="text-4xl mt-6 text-gray-500 dark:text-gray-400 font-light">/</div>
              </div>

              <VerticalWheel
                value={denominator}
                onChange={(v) => {
                  console.log('[BillItemCard] Denominator changed:', v, '(numerator:', numerator, ')')
                  setDenominator(v)
                  if (numerator >= v) {
                    const newNum = v - 1
                    console.log('[BillItemCard] Numerator auto-adjusted:', numerator, '→', newNum)
                    setNumerator(newNum)
                  }
                }}
                min={2}
                max={30}
                label="Personen"
              />
            </div>

            {/* Fraction preview */}
            <div className="text-center text-purple-400 dark:text-purple-500 text-sm font-medium">
              {numerator === 0 ? (
                wholeNumber > 0 ? `= ${wholeNumber}× (keine Bruchteile)` : '= 0× (nichts ausgewählt)'
              ) : (
                `= ${wholeNumber > 0 ? `${wholeNumber} + ` : ''}${numerator}/${denominator}× (${((numerator / denominator) * 100).toFixed(1)}% einer Portion)`
              )}
            </div>
          </div>
        </div>

      </div>
      </div>
    </div>
  )
}
