import Link from "next/link";

export default function Datenschutz() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800 p-8">
      <div className="max-w-4xl mx-auto bg-white dark:bg-gray-800 rounded-lg shadow-lg dark:shadow-gray-900/30 p-8">
        <h1 className="text-4xl font-bold mb-8 text-gray-900 dark:text-gray-50">
          Datenschutzerklärung
        </h1>

        <div className="space-y-6 text-gray-700 dark:text-gray-300">
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-gray-800 dark:text-gray-100">
              1. Datenschutz auf einen Blick
            </h2>
            <h3 className="text-xl font-semibold mb-2 text-gray-800 dark:text-gray-100">
              Allgemeine Hinweise
            </h3>
            <p className="mb-4">
              Die folgenden Hinweise geben einen einfachen Überblick darüber, was mit Ihren
              personenbezogenen Daten passiert, wenn Sie diese Website besuchen. Personenbezogene
              Daten sind alle Daten, mit denen Sie persönlich identifiziert werden können.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-gray-800 dark:text-gray-100">
              2. Datenerfassung auf dieser Website
            </h2>

            <h3 className="text-xl font-semibold mb-2 text-gray-800 dark:text-gray-100">
              Wer ist verantwortlich für die Datenerfassung auf dieser Website?
            </h3>
            <p className="mb-4">
              Die Datenverarbeitung auf dieser Website erfolgt durch den Websitebetreiber.
              Dessen Kontaktdaten können Sie dem Impressum dieser Website entnehmen.
            </p>

            <h3 className="text-xl font-semibold mb-2 text-gray-800 dark:text-gray-100">
              Wie erfassen wir Ihre Daten?
            </h3>
            <p className="mb-4">
              Ihre Daten werden zum einen dadurch erhoben, dass Sie uns diese mitteilen.
              Hierbei kann es sich z.B. um Daten handeln, die Sie in ein Formular eingeben
              (Name, PayPal-Handle, hochgeladene Rechnungsbilder).
            </p>
            <p className="mb-4">
              Andere Daten werden automatisch oder nach Ihrer Einwilligung beim Besuch der
              Website durch unsere IT-Systeme erfasst. Das sind vor allem technische Daten
              (z.B. Internetbrowser, Betriebssystem oder Uhrzeit des Seitenaufrufs). Die
              Erfassung dieser Daten erfolgt automatisch, sobald Sie diese Website betreten.
            </p>

            <h3 className="text-xl font-semibold mb-2 text-gray-800 dark:text-gray-100">
              Wofür nutzen wir Ihre Daten?
            </h3>
            <p className="mb-4">
              Die Daten werden erhoben, um eine fehlerfreie Bereitstellung der Website zu
              gewährleisten und um die Funktionalität der Rechnungsteilung zu ermöglichen.
              Andere Daten können zur Analyse Ihres Nutzerverhaltens verwendet werden.
            </p>

            <h3 className="text-xl font-semibold mb-2 text-gray-800 dark:text-gray-100">
              Welche Rechte haben Sie bezüglich Ihrer Daten?
            </h3>
            <p className="mb-4">
              Sie haben jederzeit das Recht, unentgeltlich Auskunft über Herkunft, Empfänger
              und Zweck Ihrer gespeicherten personenbezogenen Daten zu erhalten. Sie haben
              außerdem ein Recht, die Berichtigung oder Löschung dieser Daten zu verlangen.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-gray-800 dark:text-gray-100">
              3. Hosting und Content Delivery Networks (CDN)
            </h2>

            <h3 className="text-xl font-semibold mb-2 text-gray-800 dark:text-gray-100">
              Vercel
            </h3>
            <p className="mb-4">
              Wir hosten unsere Website bei Vercel Inc., 440 N Barranca Ave #4133, Covina,
              CA 91723, USA. Vercel verarbeitet Daten im Auftrag und hat sich verpflichtet,
              für ausreichenden Datenschutz zu sorgen.
            </p>

            <h3 className="text-xl font-semibold mb-2 text-gray-800 dark:text-gray-100">
              Supabase
            </h3>
            <p className="mb-4">
              Wir nutzen Supabase (Supabase Inc.) für Datenbank- und Speicherdienste.
              Ihre hochgeladenen Rechnungsbilder und eingegebenen Daten werden auf
              Servern von Supabase gespeichert.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-gray-800 dark:text-gray-100">
              4. Analyse-Tools und Werbung
            </h2>

            <h3 className="text-xl font-semibold mb-2 text-gray-800 dark:text-gray-100">
              Google Analytics
            </h3>
            <p className="mb-4">
              Diese Website nutzt Funktionen des Webanalysedienstes Google Analytics.
              Anbieter ist die Google Ireland Limited („Google"), Gordon House, Barrow Street,
              Dublin 4, Irland.
            </p>
            <p className="mb-4">
              Google Analytics ermöglicht es dem Websitebetreiber, das Verhalten der
              Websitebesucher zu analysieren. Hierbei erhält der Websitebetreiber verschiedene
              Nutzungsdaten, wie z.B. Seitenaufrufe, Verweildauer, verwendete Betriebssysteme
              und Herkunft des Nutzers. Diese Daten werden in einer User-ID zusammengefasst
              und dem jeweiligen Endgerät des Websitebesuchers zugeordnet.
            </p>
            <p className="mb-4">
              Google Analytics verwendet Technologien, die die Wiedererkennung des Nutzers
              zum Zwecke der Analyse des Nutzerverhaltens ermöglichen (z.B. Cookies oder
              Device-Fingerprinting). Die von Google erfassten Informationen über die Benutzung
              dieser Website werden in der Regel an einen Server von Google in den USA übertragen
              und dort gespeichert.
            </p>
            <p className="mb-4">
              Die Nutzung dieses Analyse-Tools erfolgt auf Grundlage von Art. 6 Abs. 1 lit. f
              DSGVO. Der Websitebetreiber hat ein berechtigtes Interesse an der Analyse des
              Nutzerverhaltens, um sowohl sein Webangebot als auch seine Werbung zu optimieren.
              Sofern eine entsprechende Einwilligung abgefragt wurde, erfolgt die Verarbeitung
              ausschließlich auf Grundlage von Art. 6 Abs. 1 lit. a DSGVO und § 25 Abs. 1 TTDSG,
              soweit die Einwilligung die Speicherung von Cookies oder den Zugriff auf
              Informationen im Endgerät des Nutzers (z.B. Device-Fingerprinting) im Sinne des
              TTDSG umfasst.
            </p>

            <h3 className="text-xl font-semibold mb-2 text-gray-800 dark:text-gray-100">
              IP-Anonymisierung
            </h3>
            <p className="mb-4">
              Die IP-Anonymisierung ist aktiv. Ihre IP-Adresse wird von Google innerhalb von
              Mitgliedstaaten der Europäischen Union oder in anderen Vertragsstaaten des
              Abkommens über den Europäischen Wirtschaftsraum gekürzt. Nur in Ausnahmefällen
              wird die volle IP-Adresse an einen Server von Google in den USA übertragen und
              dort gekürzt.
            </p>

            <h3 className="text-xl font-semibold mb-2 text-gray-800 dark:text-gray-100">
              Browser Plugin
            </h3>
            <p className="mb-4">
              Sie können die Erfassung und Verarbeitung Ihrer Daten durch Google verhindern,
              indem Sie das unter dem folgenden Link verfügbare Browser-Plugin herunterladen
              und installieren:{" "}
              <a
                href="https://tools.google.com/dlpage/gaoptout?hl=de"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 hover:underline"
              >
                https://tools.google.com/dlpage/gaoptout?hl=de
              </a>
            </p>

            <h3 className="text-xl font-semibold mb-2 text-gray-800 dark:text-gray-100">
              Widerspruch gegen Datenerfassung
            </h3>
            <p className="mb-4">
              Sie können die Erfassung Ihrer Daten durch Google Analytics verhindern, indem
              Sie auf folgenden Link klicken. Es wird ein Opt-Out-Cookie gesetzt, der die
              Erfassung Ihrer Daten bei zukünftigen Besuchen dieser Website verhindert.
            </p>

            <h3 className="text-xl font-semibold mb-2 text-gray-800 dark:text-gray-100">
              Auftragsverarbeitung
            </h3>
            <p className="mb-4">
              Wir haben mit Google einen Vertrag zur Auftragsverarbeitung abgeschlossen und
              setzen die strengen Vorgaben der deutschen Datenschutzbehörden bei der Nutzung
              von Google Analytics vollständig um.
            </p>

            <h3 className="text-xl font-semibold mb-2 text-gray-800 dark:text-gray-100">
              Speicherdauer
            </h3>
            <p className="mb-4">
              Bei Google gespeicherte Daten auf Nutzer- und Ereignisebene, die mit Cookies,
              Nutzerkennungen (z.B. User ID) oder Werbe-IDs (z.B. DoubleClick-Cookies,
              Android-Werbe-ID) verknüpft sind, werden nach 14 Monaten anonymisiert bzw. gelöscht.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-gray-800 dark:text-gray-100">
              5. Externe Dienste
            </h2>

            <h3 className="text-xl font-semibold mb-2 text-gray-800 dark:text-gray-100">
              Claude AI (Anthropic)
            </h3>
            <p className="mb-4">
              Wir nutzen die Claude Vision API von Anthropic PBC zur automatischen Analyse
              hochgeladener Rechnungsbilder. Die Bilder werden zur Verarbeitung an Server
              von Anthropic übermittelt und dort analysiert. Anthropic verarbeitet diese
              Daten ausschließlich zur Bereitstellung der Analysefunktion und speichert
              die Bilder nicht dauerhaft.
            </p>

            <h3 className="text-xl font-semibold mb-2 text-gray-800 dark:text-gray-100">
              PayPal
            </h3>
            <p className="mb-4">
              Unsere Website bietet die Möglichkeit, PayPal.me Links zu generieren. Wenn Sie
              einen solchen Link nutzen, werden Sie zur PayPal-Website weitergeleitet. Die
              Verarbeitung der Zahlungsdaten erfolgt ausschließlich bei PayPal (PayPal (Europe)
              S.à r.l. et Cie, S.C.A., 22-24 Boulevard Royal, L-2449 Luxembourg).
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-gray-800 dark:text-gray-100">
              6. Ihre Daten bei Nutzung der Rechnungsteilung
            </h2>
            <p className="mb-4">
              Bei der Nutzung unseres Dienstes zur Rechnungsteilung werden folgende Daten erfasst:
            </p>
            <ul className="list-disc list-inside mb-4 space-y-2">
              <li>Name des Bezahlers und der Gäste</li>
              <li>PayPal-Handle (optional)</li>
              <li>Hochgeladene Rechnungsbilder</li>
              <li>Ausgewählte Positionen und Beträge</li>
              <li>Browser-Session-ID (technisch erforderlich)</li>
            </ul>
            <p className="mb-4">
              Diese Daten werden für 30 Tage gespeichert und anschließend automatisch gelöscht.
              Sie dienen ausschließlich der Abwicklung der Rechnungsteilung zwischen Ihnen und
              Ihren Gästen.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-gray-800 dark:text-gray-100">
              7. Cookies
            </h2>
            <p className="mb-4">
              Unsere Website verwendet Cookies. Das sind kleine Textdateien, die auf Ihrem
              Endgerät gespeichert werden. Ihr Browser greift auf diese Dateien zu. Durch
              den Einsatz von Cookies erhöht sich die Benutzerfreundlichkeit und Sicherheit
              dieser Website.
            </p>
            <p className="mb-4">
              Wir verwenden folgende Arten von Cookies:
            </p>
            <ul className="list-disc list-inside mb-4 space-y-2">
              <li>
                <strong>Technisch notwendige Cookies:</strong> Zur Speicherung von Session-IDs
                und Theme-Präferenzen (localStorage)
              </li>
              <li>
                <strong>Analyse-Cookies:</strong> Google Analytics zur Verbesserung unseres Angebots
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-gray-800 dark:text-gray-100">
              8. Ihre Rechte
            </h2>
            <p className="mb-4">
              Sie haben jederzeit das Recht auf:
            </p>
            <ul className="list-disc list-inside mb-4 space-y-2">
              <li>Auskunft über Ihre bei uns gespeicherten Daten</li>
              <li>Berichtigung unrichtiger personenbezogener Daten</li>
              <li>Löschung Ihrer bei uns gespeicherten Daten</li>
              <li>Einschränkung der Datenverarbeitung</li>
              <li>Datenübertragbarkeit</li>
              <li>Widerspruch gegen die Verarbeitung</li>
              <li>Beschwerde bei einer Aufsichtsbehörde</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-gray-800 dark:text-gray-100">
              9. SSL-/TLS-Verschlüsselung
            </h2>
            <p className="mb-4">
              Diese Seite nutzt aus Sicherheitsgründen und zum Schutz der Übertragung
              vertraulicher Inhalte eine SSL-/TLS-Verschlüsselung. Eine verschlüsselte
              Verbindung erkennen Sie daran, dass die Adresszeile des Browsers von „http://"
              auf „https://" wechselt und an dem Schloss-Symbol in Ihrer Browserzeile.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-gray-800 dark:text-gray-100">
              10. Änderungen dieser Datenschutzerklärung
            </h2>
            <p className="mb-4">
              Wir behalten uns vor, diese Datenschutzerklärung anzupassen, damit sie stets
              den aktuellen rechtlichen Anforderungen entspricht oder um Änderungen unserer
              Leistungen in der Datenschutzerklärung umzusetzen.
            </p>
          </section>

          <p className="text-sm text-gray-500 dark:text-gray-400 mt-8">
            Stand: {new Date().toLocaleDateString('de-DE', { year: 'numeric', month: 'long' })}
          </p>
        </div>

        <div className="mt-8">
          <Link
            href="/"
            className="inline-block bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white font-semibold px-6 py-3 rounded-lg transition-colors"
          >
            ← Zurück zur Startseite
          </Link>
        </div>
      </div>
    </div>
  );
}
