/**
 * Der Wortmarken-Pool — neun Handschriften für denselben Namen.
 *
 * Übernommen aus der Quartz-Fassung (`quartz/components/PageTitle.tsx`).
 * Die Bilder liegen in `public/wortmarke/` als `wordmark-<stil>-<hell|dunkel>.png`;
 * Quelle bleibt `~/Gedankenwelten/quartz/static/` — wer dort einen Stil
 * ergänzt, kopiert ihn herüber und trägt den Schlüssel hier nach.
 *
 * Sechs, weil der Pool durch drei teilbar sein soll: Dann geht er auf
 * dreißig Tage gleichmäßig auf. Seit 13.09.2026 sieben — die siebte
 * Hand (Matisse-Scherenschnitt) war Andreas wichtiger als die glatte
 * Teilung; im Monat kommt jede Marke jetzt vier- bis fünfmal. Seit
 * 28.09.2026 neun: Hilma af Klint (Spiralen, Schneckenhäuser, Rosetten —
 * innere Welten als Diagramm) und Hokusai (die Welle, die aus dem letzten
 * Buchstaben steigt). Neun geht wieder durch drei.
 */
export const WORTMARKEN = ["klee", "sumie", "aquarell", "aether", "buntglas", "miniatur", "scherenschnitt", "klint", "hokusai"];

/**
 * Welche Marke an einem Tag gilt — dieselbe Rechnung wie in der
 * Quartz-Fassung (`quartz/components/scripts/pageTitle.inline.ts`):
 * Tag im Monat, minus eins, modulo Poolgröße.
 *
 * Absichtlich nicht „besser": So zeigen beide Fassungen am selben Tag
 * dieselbe Hand. Der Preis ist bekannt und in Kauf genommen — am 31. fällt
 * es auf Platz 0 zurück, und der 1. des Folgemonats liegt auch dort. In
 * sieben Monaten im Jahr steht die Marke also zwei Tage hintereinander.
 * Eine Rechnung über die Tage seit der Epoche hätte das nicht, aber dann
 * liefen die beiden Seiten auseinander.
 *
 * Läuft im Build (für das erste Bild) und im Browser (für den Tag des
 * Lesers) — die Fassung im Browser steht in `components/Vorspann.astro`.
 */
export function wortmarkeDesTages(datum = new Date()) {
  return WORTMARKEN[(datum.getDate() - 1) % WORTMARKEN.length];
}
