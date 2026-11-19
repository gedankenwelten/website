/**
 * Der Reigen — welcher Spruch, welche Wortmarke an einem Tag dran ist.
 *
 * Seit 19.11.2026 (Andreas: „berechenbar, aber ohne es zu wissen kann man es
 * nicht erkennen“). Vorher lief beides der Reihe nach durch die Liste; wer
 * ein paar Tage hinsah, konnte die Folge erraten. Jetzt in gemischten Runden:
 * Jedes Stück kommt in jeder Runde genau einmal, aber jede Runde in anderer
 * Reihenfolge, gemischt aus der Rundennummer. Alle Leser sehen am selben Tag
 * dasselbe, nichts fällt heraus, nichts kommt doppelt. An der Rundengrenze
 * steht nie zweimal dasselbe hintereinander.
 *
 * Im Browser darf nichts nachgerechnet werden, was nicht schon im Skript
 * steht (CSP mit Hashes, kein eval). Darum rechnet der Build eine Tabelle
 * vor — eine Woche zurück, gut ein Jahr voraus — und die Seite schlägt den
 * Tag des Lesers darin nach. Gebaut wird jede Nacht; läge ein Tag je
 * außerhalb, fällt die Seite auf die alte Reihe (Tag modulo Pool) zurück.
 *
 * Ändert sich die Länge einer Liste, beginnt eine neue Mischung. Das ist
 * gewollt: Ein neuer Spruch soll nicht erst warten, bis eine Runde vorbei ist.
 */

/** Tage seit 1970 im Ortskalender des Lesers (bzw. des Builds). */
export function tagNummer(datum = new Date()) {
  return Math.floor((datum.getTime() - datum.getTimezoneOffset() * 60000) / 86400000);
}

/* Kleiner, fester Zufallsgenerator (mulberry32): gleicher Same, gleiche Folge. */
function zufall(same) {
  let t = same >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function runde(nr, n, salz) {
  const r = zufall(Math.imul(nr + 1, 2654435761) ^ salz);
  const folge = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [folge[i], folge[j]] = [folge[j], folge[i]];
  }
  return folge;
}

/** Platz in der Liste (0 … n-1) für einen Tag. `salz` trennt Sprüche von Marken. */
export function reigen(tag, n, salz = 0) {
  if (n < 3) return ((tag % n) + n) % n;     // bei zwei oder einem gibt es nichts zu mischen
  const nr = Math.floor(tag / n), platz = tag - nr * n;
  const folge = runde(nr, n, salz);
  // An der Grenze nicht zweimal dasselbe: dann die ersten beiden tauschen.
  // (Die letzte Stelle der Vorrunde bleibt davon unberührt, weil n ≥ 3.)
  const vorher = runde(nr - 1, n, salz);
  if (folge[0] === vorher[n - 1]) [folge[0], folge[1]] = [folge[1], folge[0]];
  return folge[platz];
}

/** Die Tabelle für den Browser: { ab: Tagnummer, folge: [Platz, …] }. */
export function reigenTabelle(n, salz = 0, datum = new Date(), zurueck = 7, voraus = 400) {
  const ab = tagNummer(datum) - zurueck;
  return { ab, folge: Array.from({ length: zurueck + voraus }, (_, i) => reigen(ab + i, n, salz)) };
}

export const SALZ_SPRUCH = 0x5157;
export const SALZ_WORTMARKE = 0x574d;
