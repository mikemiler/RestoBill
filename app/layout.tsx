import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kill The Bill - Rechnung einfach teilen",
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
    <html lang="de">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
