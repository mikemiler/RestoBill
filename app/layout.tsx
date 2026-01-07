import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RestoBill - Rechnung einfach teilen",
  description: "Teile Restaurant-Rechnungen einfach mit deinen Freunden. Foto hochladen, Items auswählen, per PayPal bezahlen.",
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
