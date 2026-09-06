/**
 * Was die Seite über sich selbst weiß — an einem Ort.
 */
/* Eine Marke je Build, hinten an den Skripten in public/ (`/leser.js?v=…`).
   Cloudflare hält JS vier Stunden im Cache — ohne die Marke sieht der
   Leser nach einem Deploy noch stundenlang das alte Verhalten zu neuem
   HTML (06.09.2026: die Schriftgrad-Knöpfe standen da, taten aber nichts).
   Die Astro-Bündel tragen ihren Hash selbst; nur das Handgeschriebene
   in public/ braucht diese Hilfe. */
export const BUILD = Date.now().toString(36);

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
