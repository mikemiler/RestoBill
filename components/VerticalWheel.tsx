'use client'

interface VerticalWheelProps {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  label: string
}

export default function VerticalWheel({
  value,
  onChange,
  min = 1,
  max = 20,
  label
}: VerticalWheelProps) {
  return (
    <div className="flex flex-col items-center">
      <div className="text-gray-500 dark:text-gray-400 text-xs mb-2">{label}</div>
      <div className="flex flex-col items-center bg-gray-800 dark:bg-gray-700 rounded-xl overflow-hidden">
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + 1))}
          className="w-14 h-12 text-gray-400 hover:bg-gray-700 dark:hover:bg-gray-600 hover:text-white text-2xl transition-colors flex items-center justify-center"
        >
          ▲
        </button>
        <div className="w-14 h-16 bg-purple-500/30 dark:bg-purple-600/30 border-y-2 border-purple-500 dark:border-purple-400 flex items-center justify-center">
          <span className="text-3xl font-bold text-white">{value}</span>
        </div>
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          className="w-14 h-12 text-gray-400 hover:bg-gray-700 dark:hover:bg-gray-600 hover:text-white text-2xl transition-colors flex items-center justify-center"
        >
          ▼
        </button>
      </div>
    </div>
  )
}
