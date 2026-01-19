export default function Footer() {
  return (
    <footer className="w-full py-6 px-4 mb-28 bg-gray-100 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-gray-600 dark:text-gray-300">
        <div className="flex flex-wrap justify-center gap-4">
          <a
            href="https://werhattewas.de/nutzungsbedingungen/"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            Nutzungsbedingungen
          </a>
          <a
            href="https://werhattewas.de/rueckerstattungsrichtlinie/"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            Rückerstattung
          </a>
          <a
            href="https://werhattewas.de/datenschutz/"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            Datenschutz
          </a>
          <a
            href="https://werhattewas.de/impressum/"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            Impressum
          </a>
        </div>
        <div className="text-center sm:text-right">
          <p>© {new Date().getFullYear()} WerHatteWas</p>
        </div>
      </div>
    </footer>
  );
}
