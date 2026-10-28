/**
 * Das Register der Menschen — als eigene Datei, nicht im Dokument.
 *
 * Der Chip „DenkerVita" auf der Startseite legt alle Vitas nach
 * Nachnamen aus, jede mit Bild, einem Satz und den Notes ihres Menschen.
 * Das sind vierhundert Einträge für eine Geste, die die meisten nie
 * auslösen — also liegt es daneben und wird beim ersten Klick geholt
 * (oder wenn das Sieb einen Namen trifft).
 *
 * Kurze Schlüssel, weil die Liste lang ist: `n` Name, `u` Adresse,
 * `b` Bild, `t` Satz, `w` Buchstabe im Register, `z` die Notes (Adressen,
 * neueste zuerst). Die Notes selbst stehen als Karten schon im Feld; hier
 * steht nur, welche gemeint sind.
 */
import { menschen, registerBuchstabe } from "../lib/rubriken.mjs";

export function GET() {
  const liste = menschen().map((m) => ({
    n: m.name,
    u: m.url,
    b: m.bild,
    t: m.teaser ?? "",
    w: registerBuchstabe(m.name),
    z: m.notes.map((n) => n.url),
  }));
  return new Response(JSON.stringify(liste), {
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
