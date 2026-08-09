/**
 * Ein Faden ab jeder einzelnen Note — als eigene Datei, nicht im Dokument.
 *
 * Die Startseite bietet auf jeder Karte an, von *dort* loszugehen. Neun
 * fertige Wege reichen dafür nicht; es braucht einen je Note. Die alle in
 * die Startseite zu schreiben wären ein paar hundert Kilobyte für eine
 * Geste, die die meisten nie auslösen — also liegt es daneben und wird
 * beim ersten Klick geholt.
 *
 * Aus den Karten im Dokument ließe sich der Weg nicht bauen: Ein Faden
 * darf durch eine Vita laufen (nur nicht bei einer anfangen), und Vitas
 * haben im Feld keine Karte. Also stehen die Stationen hier.
 *
 * Damit das nicht ausufert, sind die Notes interniert: eine Tabelle mit
 * jeder Station, die irgendwo vorkommt, und die Wege verweisen nur mit
 * Nummern darauf. Dieselbe Note taucht in vielen Wegen auf — ausgeschrieben
 * stünde sie dutzendfach da.
 */
import { alleWege } from "../lib/faden.mjs";

export function GET() {
  const nummer = new Map();     // Note-Kennung → Platz in der Tabelle
  const tabelle = [];

  const eintragen = (s) => {
    if (nummer.has(s.id)) return nummer.get(s.id);
    const i = tabelle.length;
    nummer.set(s.id, i);
    // Kurze Schlüssel: Die Tabelle wird ein paar hundert Zeilen lang, da
    // wiegen ausgeschriebene Feldnamen mehr als die Werte.
    tabelle.push({
      u: s.url, t: s.titel, r: s.rubrik,
      d: s.datum ?? null, b: s.banner ?? null,
      e: s.eigenesBild ? 1 : 0,
      x: s.teaser ?? null,
    });
    return i;
  };

  const wege = {};
  for (const [id, weg] of alleWege(7)) {
    wege[id] = weg.map((s) => [
      eintragen(s),
      // Der erste Schritt hat keinen Grund — man kommt ja von nirgends.
      s.grund?.wie ?? null,
      s.grund?.fund ? 1 : 0,
    ]);
  }

  return new Response(JSON.stringify({ n: tabelle, f: wege }), {
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
