/**
 * Ein Blick in die Note, bevor man hingeht — die Karte beim Überfahren
 * eines Links (`public/blick.js`).
 *
 * Quartz hatte das eingebaut: Es holte beim Hover die ganze Zielseite und
 * schnitt den Anfang heraus. Hier stünde am Anfang oft der 🎨-Block, und
 * 294 von 307 Vitas haben keine `description:` — aus dem HTML geschnitten
 * wäre das brüchig. Der Index kennt die Antwort längst: Beschreibung, sonst
 * der Auszug (der „Worum es geht"-Callout, bei Vitas der Anfang der
 * Biografie), dazu die verkleinerte Fassung des Banners.
 *
 * Eine Datei für alle, geholt beim ersten Link, über dem die Maus
 * verweilt — nicht im Dokument, denn die meisten Leser fahren nie über
 * einen Link.
 */
import { ladeIndex } from "../lib/notizen.mjs";

export function GET() {
  const blick = {};
  for (const n of ladeIndex().alle) {
    // Kurze Felder: 847 Einträge, da wiegen Schlüssel mehr als gedacht.
    blick[n.url] = {
      t: n.titel,
      r: n.rubrik,
      x: n.beschreibung ?? n.auszug ?? null,
      b: n.vorschau ?? null,
    };
  }
  return new Response(JSON.stringify(blick), {
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
