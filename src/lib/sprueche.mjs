/**
 * Die Sprüche links neben der Wortmarke — einer je Tag.
 *
 * Seit 31.10.2026 (Andreas). Der Platz links war leer; gedankenwelten.net
 * hatte an derselben Stelle einen „Zitat der Zeit“. Die ersten Sprüche
 * kommen von dort, der Satz der Seite selbst steht dazu. Neue einfach
 * hinten anhängen: `text` und `wer` — `wer` steht klein darunter, wie
 * damals in Klammern.
 *
 * Wechsel wie die Wortmarke: mit dem Kalendertag des Lesers, gesetzt im
 * Browser (`index.astro`), der Build liefert nur den Tag, an dem er lief.
 * Gezählt aber über die Tage seit der Epoche, nicht über den Tag im Monat —
 * mit einem kleinen Pool stünde sonst am 31. und am 1. derselbe Spruch,
 * und hier muss keine Quartz-Fassung im Gleichschritt bleiben.
 */
export const SPRUECHE = [
  {
    text: "Jeder Mensch hat seine eigene Gedankenwelt. Geformt von Erlerntem und Erfahrung schaffen wir daraus unsere eigene Welt.",
    wer: "Gedankenwelten",
  },
  {
    text: "Eine Welt, wie man sie sich wünscht, kann nur entstehen, wenn man sie selbst auch lebt.",
    wer: "Luc",
  },
  {
    text: "Wir nehmen nicht die Wirklichkeit wahr, sondern nur das Bild, das wir uns von der Wirklichkeit machen.",
    wer: "Luc",
  },
  {
    text: "Die Gedanken sind frei, wer kann sie erraten? Sie fliehen vorbei wie nächtliche Schatten.",
    wer: "Volkslied, um 1800",
  },
];

/** Tage seit 1970 im Ortskalender — dieselbe Rechnung wie im Browser. */
export function spruchIndex(datum = new Date()) {
  const tag = Math.floor((datum.getTime() - datum.getTimezoneOffset() * 60000) / 86400000);
  return tag % SPRUECHE.length;
}
