/**
 * Die Wiederkehr — zwei reservierte Plätze für das, was trägt.
 *
 * Das Feld sortiert nach Datum und begräbt damit alles, was älter als
 * eine Woche ist. Der Faden führt zwar zurück, aber er wählt nach Graph,
 * nicht nach Urteil. Was fehlte: ein Ort, an dem Älteres nach vorn darf —
 * ohne am `aktualisiert:` zu drehen. Das Datum verspricht dem Leser, dass
 * Substanz dazukam; ein hochdatierter Lieblingstext wäre eine Lüge an die
 * paar, die das Datum lesen.
 *
 * Also Karten *im* Gitter, nie oben (sonst empfinge die Seite jeden mit
 * demselben Bild), je zwei pro Zeile, nach neun, achtzehn und
 * siebenundzwanzig Karten — das Neue dazwischen soll nicht verschwinden:
 *
 *   **Wiedergelesen** — aus dem Pool `Wiederkehr.md` im Vault, von Hand
 *   gepflegt, eine Zeile pro Note mit einem Satz, warum. Die Uhr ist die
 *   Kalenderwoche. Ein ⭐ vor dem Link heftet eine Note an.
 *
 *   **Gefunden** — was Leser in den letzten dreißig Tagen tatsächlich
 *   aufgeschlagen haben (`gelesen.json`, aus der Umami-Datenbank). Die
 *   Suche bringt sie immer wieder zu denselben älteren Notes; die
 *   sollen sichtbar sein. Vitas zählen dabei für die Note ihrer Person,
 *   nicht für sich (Andreas: „Vitas außen vor, eher die Notes der
 *   Personen"). Notes jünger als zwei Wochen sind ausgeschlossen — die
 *   stehen ohnehin oben. Unter den Meistgelesenen rotiert die Woche.
 *
 *   **Meistgelesen** — vier Zeiträume (Woche, Monat, Jahr, seit Beginn),
 *   je die eine Note mit den meisten Aufrufen, ohne Rotation; was eine
 *   frühere Karte schon zeigt, überspringt die nächste (Andreas, 13.09.:
 *   „damit haben wir 3 mal 2 notes").
 *
 * Die Maschine rotiert, der Mensch kuratiert.
 */
import fs from "node:fs";
import path from "node:path";
import { INHALT, ladeIndex, findeNote } from "./notizen.mjs";

const POOL = path.join(INHALT, "Wiederkehr.md");
const GELESEN = path.join(INHALT, "gelesen.json");
const JUNG_TAGE = 14;      // so frisch, dass es im Feld ohnehin oben steht
const KREIS = 7;           // unter wie vielen Meistgelesenen die Woche rotiert

/** ISO-Kalenderwoche als fortlaufende Zahl — stabil über Jahresgrenzen. */
function wochenzahl(d = new Date()) {
  const t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const tag = new Date(t).getUTCDay() || 7;            // Mo=1 … So=7
  const donnerstag = t + (4 - tag) * 86400000;         // ISO: die Woche gehört dem Donnerstag
  return Math.floor(donnerstag / (7 * 86400000));
}

/* ── Wiedergelesen ─────────────────────────────────────────────── */

/** Alle Einträge des Pools, in Dateireihenfolge. */
export function ladeWiederkehr() {
  if (!fs.existsSync(POOL)) return [];
  const text = fs.readFileSync(POOL, "utf8");
  const eintraege = [];
  // [ \t], nicht \s: \s fräße den Zeilenumbruch, und eine Zeile ohne Satz
  // bekäme die nächste Zeile als ihren Satz.
  for (const m of text.matchAll(/^-[ \t]*(⭐[ \t]*)?\[\[([^\]|\n]+)(?:\|[^\]\n]*)?\]\][ \t]*(?:[—–-][ \t]*(.+))?$/gm)) {
    const note = findeNote(m[2]);
    if (!note) continue;                                // ein Tippfehler darf den Build nicht kippen
    eintraege.push({
      note,
      warum: (m[3] ?? "").replace(/[*_`]/g, "").trim() || null,
      angeheftet: Boolean(m[1]),
    });
  }
  return eintraege;
}

/** Die Note dieser Woche — oder null, wenn der Pool leer ist. */
export function wiederkehrDieserWoche(heute = new Date()) {
  const alle = ladeWiederkehr();
  if (!alle.length) return null;
  const fest = alle.find((e) => e.angeheftet);
  if (fest) return fest;
  return alle[wochenzahl(heute) % alle.length];
}

/* ── Gefunden ──────────────────────────────────────────────────── */

/** Die Aufrufe je Pfad, wie `gelesen.py` sie ablegt — oder leer. */
export function ladeGelesen() {
  if (!fs.existsSync(GELESEN)) return { stand: null, tage: 0, pfade: [] };
  try { return JSON.parse(fs.readFileSync(GELESEN, "utf8")); }
  catch { return { stand: null, tage: 0, pfade: [] }; }
}

/** Die Pfade eines Zeitraums (`woche` · `monat` · `jahr` · `immer`) —
 *  eine ältere `gelesen.json` ohne Zeiträume kennt nur den Monat. */
function pfadeFuer(zeitraum) {
  const g = ladeGelesen();
  const z = g.zeitraeume?.[zeitraum];
  if (z) return { pfade: z.pfade ?? [], tage: z.tage, stand: g.stand };
  if (zeitraum === "monat") return { pfade: g.pfade ?? [], tage: g.tage, stand: g.stand };
  return { pfade: [], tage: null, stand: g.stand };
}

/**
 * Aufrufe auf Notes umlegen. Eine Vita bekommt keine eigenen Aufrufe
 * gutgeschrieben — sie gehen an die jüngste Note, die auf diese Vita
 * verweist (die Note *der Person*). Verweist keine, verfällt der Aufruf.
 */
function aufrufeJeNote(pfade) {
  const idx = ladeIndex();
  const nachUrl = new Map(idx.alle.map((n) => [n.url.normalize("NFC"), n]));
  const summe = new Map();
  const gut = (note, n) => summe.set(note.id, (summe.get(note.id) ?? 0) + n);

  // Wer verweist auf welche Vita? Einmal rechnen, nicht je Aufruf.
  let notesDerVita = null;
  const personNote = (vita) => {
    if (!notesDerVita) {
      notesDerVita = new Map();
      for (const n of idx.alle) {
        if (n.rubrik === "DenkerVita") continue;
        for (const z of n.ziele) {
          const ziel = findeNote(z);
          if (ziel?.rubrik === "DenkerVita")
            (notesDerVita.get(ziel.id) ?? notesDerVita.set(ziel.id, []).get(ziel.id)).push(n);
        }
      }
    }
    const kandidaten = notesDerVita.get(vita.id) ?? [];
    return kandidaten.sort((a, b) => String(b.datum ?? "").localeCompare(String(a.datum ?? "")))[0] ?? null;
  };

  for (const { pfad, aufrufe } of pfade) {
    const note = nachUrl.get(String(pfad).normalize("NFC"));
    if (!note) continue;
    if (note.rubrik === "DenkerVita") {
      const p = personNote(note);
      if (p) gut(p, aufrufe);
    } else gut(note, aufrufe);
  }
  return summe;
}

/** Die Meistgelesenen eines Pfad-Satzes, absteigend — ohne die Jungen,
 *  ohne die schon Gezeigten. */
function rangliste(pfade, heute, ohne) {
  const idx = ladeIndex();
  const nachId = new Map(idx.alle.map((n) => [n.id, n]));
  const grenze = new Date(heute.getTime() - JUNG_TAGE * 86400000).toISOString().slice(0, 10);
  return [...aufrufeJeNote(pfade)]
    .map(([id, aufrufe]) => ({ note: nachId.get(id), aufrufe }))
    .filter((e) => e.note && !ohne.has(e.note.id))
    .filter((e) => !e.note.datum || e.note.datum < grenze)
    .sort((a, b) => b.aufrufe - a.aufrufe);
}

/** Die gefundene Note dieser Woche — oder null, ohne Daten. */
export function gefundenDieserWoche(heute = new Date(), ohne = new Set()) {
  const { pfade, tage, stand } = pfadeFuer("monat");
  if (!pfade.length) return null;
  const reihe = rangliste(pfade, heute, ohne).slice(0, KREIS);
  if (!reihe.length) return null;
  const e = reihe[wochenzahl(heute) % reihe.length];
  return { ...e, tage, stand };
}

/** Die eine meistgelesene Note eines Zeitraums — oder null, ohne Daten. */
export function meistgelesen(zeitraum, ohne = new Set(), heute = new Date()) {
  const { pfade, tage, stand } = pfadeFuer(zeitraum);
  if (!pfade.length) return null;
  const e = rangliste(pfade, heute, ohne)[0];
  return e ? { ...e, tage, stand, zeitraum } : null;
}
