'use client'

export default function DonationBanner() {
  return (
    <div className="donation-banner">
      <div className="donation-content">
        <h3 className="donation-heading">
          Eine kleine Spende?
        </h3>
        <p className="donation-text">
          💝 Diese App ist gratis, aber um meine KI-Kosten und Server-Kosten zu decken,
          würde ich mich über eine kleine Spende freuen – auch wenn diese nur 1 € ist.
        </p>
        <a
          href="https://paypal.me/mikemilermiteineml"
          target="_blank"
          rel="noopener noreferrer"
          className="donation-button"
        >
          💳 Über PayPal spenden
        </a>
      </div>
    </div>
  )
}
