'use client'

import QRCodeSVG from 'react-qr-code'

interface QRCodeProps {
  value: string
  size?: number
}

export default function QRCode({ value, size = 200 }: QRCodeProps) {
  return (
    <div className="qr-code-container">
      <QRCodeSVG
        value={value}
        size={size}
        level="H"
        className="qr-code"
      />
    </div>
  )
}
