#!/usr/bin/env node
/* ── CSP-Nachtrag (seit 14.11.2026) ──
   Astro schreibt je Seite ein <meta http-equiv="content-security-policy"> mit
   den Fingerabdrücken der Skripte und Styles, die es selbst verarbeitet. Die
   `is:inline`-Skripte rechnet es nicht mit — ohne diesen Schritt würde der
   Browser sie blockieren. Darum nach jedem Build:
   1. je Seite alle Inline-Skripte (ohne src, ohne JSON-Datenblöcke) und alle
      <style>-Blöcke hashen und fehlende Fingerabdrücke in script-src bzw.
      style-src ergänzen,
   2. das Meta-Tag direkt hinter <meta charset> rücken — eine CSP im Meta-Tag
      gilt erst ab der Stelle, an der sie steht.
   Seiten ohne CSP-Meta (Alias-Weiterleitungen) bleiben unberührt.
   Läuft im `npm run build` zwischen `astro build` und `pagefind`. */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const DIST = path.resolve(process.argv[2] || "dist");
const META = /<meta http-equiv="content-security-policy" content="([^"]*)"\s*\/?>/i;
const SKRIPT = /<script([^>]*)>([\s\S]*?)<\/script>/gi;
const STIL = /<style([^>]*)>([\s\S]*?)<\/style>/gi;
const DATEN = /type\s*=\s*["']?(application\/(ld\+)?json|text\/template)/i;  // importmap NICHT: unterliegt script-src

const fingerabdruck = (s) => `'sha256-${crypto.createHash("sha256").update(s, "utf8").digest("base64")}'`;
const entschaerfen = (s) => s.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
const verpacken = (s) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");

function* seiten(ordner) {
  for (const e of fs.readdirSync(ordner, { withFileTypes: true })) {
    const p = path.join(ordner, e.name);
    if (e.isDirectory()) yield* seiten(p);
    else if (e.name.endsWith(".html")) yield p;
  }
}

/* Fügt Quellen in eine Direktive ein (oder legt sie an). */
function ergaenzen(csp, name, neu) {
  if (!neu.size) return csp;
  const teile = csp.split(";").map((t) => t.trim()).filter(Boolean);
  const i = teile.findIndex((t) => t.split(/\s+/)[0] === name);
  if (i === -1) { teile.push(`${name} 'self' ${[...neu].join(" ")}`); return teile.join("; ") + ";"; }
  const vorhanden = new Set(teile[i].split(/\s+/));
  const dazu = [...neu].filter((q) => !vorhanden.has(q));
  if (dazu.length) teile[i] += " " + dazu.join(" ");
  return teile.join("; ") + ";";
}

let gesamt = 0, geaendert = 0, skripte = 0, stile = 0;
for (const datei of seiten(DIST)) {
  let html = fs.readFileSync(datei, "utf8");
  const m = META.exec(html);
  if (!m) continue;
  gesamt++;
  let csp = entschaerfen(m[1]);
  const s = new Set(), y = new Set();
  for (const [, attrs, inhalt] of html.matchAll(SKRIPT)) {
    if (/\ssrc\s*=/.test(attrs) || DATEN.test(attrs)) continue;
    s.add(fingerabdruck(inhalt));
  }
  for (const [, , inhalt] of html.matchAll(STIL)) y.add(fingerabdruck(inhalt));
  const vorher = csp;
  csp = ergaenzen(csp, "script-src", s);
  csp = ergaenzen(csp, "style-src", y);
  skripte += [...s].filter((h) => !vorher.includes(h)).length;
  stile += [...y].filter((h) => !vorher.includes(h)).length;

  // Meta-Tag entfernen und direkt hinter <meta charset> (sonst hinter <head>) neu setzen.
  const tag = `<meta http-equiv="content-security-policy" content="${verpacken(csp)}">`;
  html = html.replace(META, "");
  const charset = /<meta charset=[^>]*>/i.exec(html);
  if (charset) html = html.slice(0, charset.index + charset[0].length) + tag + html.slice(charset.index + charset[0].length);
  else html = html.replace(/<head([^>]*)>/i, (k) => k + tag);
  fs.writeFileSync(datei, html);
  geaendert++;
}
console.log(`csp-nachtrag: ${gesamt} Seiten mit CSP · ${skripte} Skript- und ${stile} Style-Fingerabdrücke ergänzt · Meta nach oben gerückt`);
if (!gesamt) { console.error("csp-nachtrag: keine Seite mit CSP gefunden — ist security.csp in astro.config.mjs aus?"); process.exit(1); }
