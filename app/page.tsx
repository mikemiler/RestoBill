import Link from "next/link";
import Image from "next/image";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-gradient-to-b from-blue-50 to-white">
      <main className="max-w-2xl text-center">
        <div className="mb-6 flex justify-center">
          <Image
            src="/logo.png"
            alt="Kill The Bill Logo"
            width={150}
            height={150}
            priority
            className="drop-shadow-lg"
          />
        </div>
        <h1 className="text-5xl font-bold mb-4 text-gray-900">
          Kill The Bill
        </h1>
        <p className="text-xl text-gray-600 mb-8">
          Restaurant-Rechnungen einfach teilen
        </p>

        <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
          <h2 className="text-2xl font-semibold mb-4 text-gray-800">
            So funktioniert&apos;s
          </h2>
          <ol className="text-left space-y-4 text-gray-700">
            <li className="flex items-start">
              <span className="font-bold text-blue-600 mr-3">1.</span>
              <span>Foto der Restaurant-Rechnung hochladen</span>
            </li>
            <li className="flex items-start">
              <span className="font-bold text-blue-600 mr-3">2.</span>
              <span>KI analysiert automatisch alle Positionen</span>
            </li>
            <li className="flex items-start">
              <span className="font-bold text-blue-600 mr-3">3.</span>
              <span>Link an Freunde teilen</span>
            </li>
            <li className="flex items-start">
              <span className="font-bold text-blue-600 mr-3">4.</span>
              <span>Jeder wählt seine Positionen aus</span>
            </li>
            <li className="flex items-start">
              <span className="font-bold text-blue-600 mr-3">5.</span>
              <span>Direkt per PayPal bezahlen - fertig!</span>
            </li>
          </ol>
        </div>

        <Link
          href="/create"
          className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-4 rounded-lg text-lg transition-colors"
        >
          Jetzt Rechnung teilen
        </Link>

        <p className="mt-6 text-sm text-gray-500">
          Kostenlos • Keine Registrierung • Einfach teilen
        </p>
      </main>
    </div>
  );
}
