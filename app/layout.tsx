import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { LanguageProvider } from "@/lib/i18n";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "WerHatteWas - Rechnung einfach teilen",
  description: "Teile Restaurant-Rechnungen einfach mit deinen Freunden. Foto hochladen, Items auswählen, per PayPal bezahlen.",
  icons: {
    icon: '/logo.png',
    apple: '/logo.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased flex flex-col min-h-screen">
        <ThemeProvider>
          <LanguageProvider>
            <div className="flex-grow">
              {children}
            </div>
            <Footer />
          </LanguageProvider>
        </ThemeProvider>

        {/* Paddle Checkout Script
            TODO: Currently not used - waiting for Paddle approval for usage-based model.
            Script remains for future integration once usage-based pricing is approved.
        */}
        <Script
          src="https://cdn.paddle.com/paddle/v2/paddle.js"
          strategy="lazyOnload"
        />
        <Script id="paddle-init" strategy="lazyOnload">
          {`
            if (window.Paddle) {
              window.Paddle.Initialize({
                token: '${process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN || ''}'
              });
            }
          `}
        </Script>
      </body>
    </html>
  );
}
