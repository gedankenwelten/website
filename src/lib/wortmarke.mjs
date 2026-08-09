/**
 * Der Wortmarken-Pool — sechs Handschriften für denselben Namen.
 *
 * Übernommen aus der Quartz-Fassung (`quartz/components/PageTitle.tsx`).
 * Die Bilder liegen in `public/wortmarke/` als `wordmark-<stil>-<hell|dunkel>.png`;
 * Quelle bleibt `~/Gedankenwelten/quartz/static/` — wer dort einen Stil
 * ergänzt, kopiert ihn herüber und trägt den Schlüssel hier nach.
 *
 * Sechs, weil der Pool durch drei teilbar sein soll: Dann geht er auf
 * dreißig Tage gleichmäßig auf.
 */
export const WORTMARKEN = ["klee", "sumie", "aquarell", "aether", "buntglas", "miniatur"];

/**
 * Welche Marke an einem Tag gilt. Über die laufende Tageszahl seit der
 * Epoche und nicht über den Tag im Jahr — sonst stünde am Jahreswechsel
 * zweimal hintereinander dieselbe.
 *
 * Dieselbe Rechnung läuft im Build (für das erste Bild) und im Browser
 * (für den Tag des Lesers). Sie muss darum an beiden Orten identisch
 * sein — die Fassung im Browser steht in `public/wortmarke.js`.
 */
export function wortmarkeDesTages(datum = new Date()) {
  const tage = Math.floor(datum.getTime() / 86_400_000);
  return WORTMARKEN[tage % WORTMARKEN.length];
}
