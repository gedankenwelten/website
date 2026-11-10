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
  /* Seit 10.11.2026, von Andreas gewählt. Wortlaut an gemeinfreien Ausgaben
     geprüft (zeno.org; die ersten drei auch in der Primärtexte-Sammlung),
     Rechtschreibung behutsam heutig (daß → dass, muß → muss), wie beim
     Volkslied. */
  {
    // Fragment B 45, Übersetzung Hermann Diels
    text: "Der Seele Grenzen kannst du nicht ausfinden, und ob du jegliche Straße abschrittest; so tiefen Grund hat sie.",
    wer: "Heraklit, Fragment 45",
  },
  {
    // Apologie 21d, Übersetzung Friedrich Schleiermacher — die Stelle hinter „Ich weiß, dass ich nicht weiß“
    text: "Ich scheine also um dieses wenige doch weiser zu sein als er, dass ich, was ich nicht weiß, auch nicht glaube zu wissen.",
    wer: "Sokrates, in Platons Apologie",
  },
  {
    // Schöpferische Konfession (1920), erster Satz von Abschnitt I
    text: "Kunst gibt nicht das Sichtbare wieder, sondern macht sichtbar.",
    wer: "Paul Klee, 1920",
  },
  {
    // Wilhelm Meisters Wanderjahre (1829), Betrachtungen im Sinne der Wanderer; Berliner Ausgabe Bd. 18, S. 545
    text: "Alles Gescheite ist schon gedacht worden, man muss nur versuchen, es noch einmal zu denken.",
    wer: "Goethe, Wanderjahre, 1829",
  },
];

/** Tage seit 1970 im Ortskalender — dieselbe Rechnung wie im Browser. */
export function spruchIndex(datum = new Date()) {
  const tag = Math.floor((datum.getTime() - datum.getTimezoneOffset() * 60000) / 86400000);
  return tag % SPRUECHE.length;
}
