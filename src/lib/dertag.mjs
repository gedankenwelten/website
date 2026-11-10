/**
 * Der Tag — eine Karte in voller Breite über dem Feld, an einem besonderen Tag.
 *
 * Die Tagesnotes (`kalender`) standen bisher im Feld wie jede andere Karte;
 * wer ankam, sah nicht, dass heute ein Welttag ist und die Note dazu gehört.
 * Seit 10.11.2026 (Andreas' Idee vom 30.10.) gibt es dafür eine Karte über
 * allen Spalten: ein paar Sätze zum Tag (was · woher · wozu, wie die
 * Tag-Erzählung von /kairos), darunter die Tagesnote und Notes aus dem
 * Bestand, die dazu passen.
 *
 * Die Quelle ist `Der-Tag.md` im Vault, von Hand bzw. von /kairos am Vortag
 * gepflegt. Je Tag ein Abschnitt:
 *
 *   ## 2026-11-10 · Welttag der Wissenschaft für Frieden und Entwicklung
 *
 *   Drei, vier Sätze zum Tag.
 *
 *   - [[Tagesnote]]
 *   - [[Bestands-Note]] — optional ein Satz, warum sie hierher gehört
 *
 * Ohne Eintrag keine Karte: Nicht jeder Tag trägt, und ein leerer Platz ist
 * besser als ein dünner. Die Karte ist auch der Weg, Älteres zum Tag nach
 * vorn zu holen, ohne `aktualisiert:` zu verbiegen.
 *
 * Gebaut wird nicht am Tag selbst, sondern bei jedem Sync, und der Pi baut
 * nachts um drei nur, wenn sich etwas geändert hat. Darum kommen gestern,
 * heute und die nächsten sieben Tage ins Dokument, alle verborgen; welcher
 * gilt, entscheidet der Kalendertag des Lesers (Inline-Skript in
 * index.astro). So steht eine Karte ab Mitternacht, wenn sie irgendwann in
 * der Woche davor eingetragen und gesynct wurde (seit 10.11.2026, vorher
 * nur „morgen“ — ein Eintrag Tage im Voraus hing sonst am Zufall eines
 * Syncs am Vorabend).
 */
import fs from "node:fs";
import path from "node:path";
import { INHALT, findeNote } from "./notizen.mjs";

const QUELLE = path.join(INHALT, "Der-Tag.md");

/** YYYY-MM-DD im Ortskalender (Berlin), nicht in UTC. */
function isoTag(d) {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(d);
}

/** Alle Einträge der Datei, jeder { tag, titel, text: [Absätze], notes: [{note, satz}] }. */
export function ladeTage() {
  if (!fs.existsSync(QUELLE)) return [];
  const roh = fs.readFileSync(QUELLE, "utf8");
  const tage = [];
  const teile = roh.split(/^##[ \t]+(?=\d{4}-\d{2}-\d{2})/m).slice(1);
  for (const teil of teile) {
    const kopf = teil.match(/^(\d{4}-\d{2}-\d{2})[ \t]*[·—–-][ \t]*(.+)$/m);
    if (!kopf) continue;
    const rumpf = teil.slice(kopf[0].length);
    const text = [];
    const notes = [];
    for (const block of rumpf.split(/\n[ \t]*\n/)) {
      const b = block.trim();
      if (!b) continue;
      if (/^-[ \t]*\[\[/.test(b)) {
        for (const m of b.matchAll(/^-[ \t]*\[\[([^\]|\n]+)(?:\|[^\]\n]*)?\]\][ \t]*(?:[—–-][ \t]*(.+))?$/gm)) {
          const note = findeNote(m[1]);
          if (!note) continue;                 // ein Tippfehler darf den Build nicht kippen
          notes.push({ note, satz: (m[2] ?? "").replace(/[*_`]/g, "").trim() || null });
        }
      } else if (!b.startsWith(">") && !b.startsWith("#")) {
        // Markdown-Reste fürs Auge glätten; Links behalten ihren Text.
        text.push(b.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/\[\[(?:[^\]|]+\|)?([^\]]+)\]\]/g, "$1")
                   .replace(/[*_`]/g, "").replace(/\s*\n\s*/g, " "));
      }
    }
    if (!text.length && !notes.length) continue;
    tage.push({ tag: kopf[1], titel: kopf[2].replace(/[*_`]/g, "").trim(), text, notes });
  }
  return tage;
}

const VORAUS = 7;   // so viele Tage im Voraus darf eine Karte eingetragen werden

/** Die Einträge von gestern bis in VORAUS Tagen (vom Build aus gesehen). */
export function tageUmHeute(heute = new Date()) {
  const fenster = new Set(Array.from({ length: VORAUS + 2 }, (_, k) => k - 1)
    .map((d) => isoTag(new Date(heute.getTime() + d * 86400000))));
  return ladeTage().filter((t) => fenster.has(t.tag));
}
