/**
 * Der Wortmarken-Pool — zwölf Handschriften für denselben Namen.
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
 * Buchstaben steigt). Neun geht wieder durch drei. Seit 21.10.2026 zwölf:
 * Maria Sibylla Merian (Raupe, Puppe, Falter — Verwandlung, die zweite
 * Säule bekommt eine Hand), die Wiener Secession (Gold und Schwarz,
 * Quadrate, die strengste Marke im Pool) und Escher (das G aus Kacheln,
 * am Ende werden Vögel daraus). Zwölf geht durch drei.
 */
export const WORTMARKEN = ["klee", "sumie", "aquarell", "aether", "buntglas", "miniatur", "scherenschnitt", "klint", "hokusai", "merian", "secession", "escher"];

import { reigen, reigenTabelle, tagNummer, SALZ_WORTMARKE } from "./reigen.mjs";

/**
 * Welche Marke an einem Tag gilt. Bis 19.11.2026 dieselbe Rechnung wie in der
 * Quartz-Fassung (Tag im Monat, minus eins, modulo Pool), damit beide Seiten
 * dieselbe Hand zeigten. Seit die Astro-Fassung live ist, ist Quartz nur der
 * Rückweg; der Gleichlauf ist aufgegeben zugunsten gemischter Runden
 * (`reigen.mjs`) — die Folge soll sich nicht erraten lassen (Andreas).
 * Nebenbei fällt die doppelte Marke am Monatswechsel weg.
 *
 * Läuft im Build (für das erste Bild) und im Browser (für den Tag des
 * Lesers) — dort nach der Tabelle in `components/Vorspann.astro`.
 */
export function wortmarkeDesTages(datum = new Date()) {
  return WORTMARKEN[reigen(tagNummer(datum), WORTMARKEN.length, SALZ_WORTMARKE)];
}

export const wortmarkeTabelle = () => reigenTabelle(WORTMARKEN.length, SALZ_WORTMARKE);
