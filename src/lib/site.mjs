/**
 * Was die Seite über sich selbst weiß — an einem Ort.
 */
export const SITE = {
  name: "Gedankenwelten",
  url: "https://gedankenwelten.org",
  satz: "Jeder Mensch hat seine eigene Gedankenwelt. Geformt von Erlerntem und Erfahrung schaffen wir daraus unsere eigene Welt.",
  ogBild: "/og-image.png",
  umami: {
    host: "https://analytics.gedankenwelten.org",
    id: "a4a71367-eeb4-42a6-b570-ef915b848718",
  },
  /* Solange die Fassung nicht die Hauptadresse trägt, bleibt sie für
     Suchmaschinen unsichtbar — 826 Seiten doppelt wären das Gegenteil
     der Crawl-Budget-Arbeit vom Juli. Der Deploy-Weg setzt `NOINDEX=0`,
     sobald sie live geht. */
  noindex: process.env.NOINDEX !== "0",
};
