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
    <div className="flex flex-col items-center gap-3">
      <div className="text-gray-500 dark:text-gray-400 text-xs">{label}</div>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        className="w-12 h-12 rounded-full bg-blue-500 dark:bg-blue-600 hover:bg-blue-400 dark:hover:bg-blue-500 text-2xl text-white font-bold transition-all active:scale-95 flex items-center justify-center"
      >
        +
      </button>
      <div className="w-16 h-16 flex items-center justify-center">
        <span className="text-5xl font-bold text-purple-400 dark:text-purple-500">{value}</span>
      </div>
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        className="w-12 h-12 rounded-full bg-gray-700 dark:bg-gray-600 hover:bg-gray-600 dark:hover:bg-gray-500 text-2xl text-white font-bold transition-all active:scale-95 flex items-center justify-center"
      >
        −
      </button>
    </div>
  )
}
