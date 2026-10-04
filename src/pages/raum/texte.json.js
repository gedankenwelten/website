/**
 * Die Saaltexte des Gedankenraums: was das Wandschild neben dem großen Bild
 * erzählt, wenn man es antippt — die Beschreibung der Note, sonst ihr Auszug
 * (der „Worum es geht"-Aufmacher, bei Vitas „Wer spricht?"), etwas länger als
 * auf den Karten. Getrennt von `daten.json`, weil die meisten Besucher nie ein
 * Schild antippen.
 */
import fs from "node:fs";
import matter from "gray-matter";
import { ladeIndex, auszugVon } from "../../lib/notizen.mjs";

export function GET() {
  const texte = {};
  for (const n of ladeIndex().alle) {
    if (!n.banner) continue;
    let z = null;
    try { z = auszugVon(matter(fs.readFileSync(n.pfad, "utf8")).content, 560); } catch {}
    texte[n.url] = z ?? n.beschreibung ?? null;
  }
  return new Response(JSON.stringify(texte), {
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
