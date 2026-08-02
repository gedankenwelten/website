#!/usr/bin/env node
/**
 * Findet für jedes O-Ton-Zitat das exakte Ende im Video.
 *
 * Warum: Randanker und Zitat taten bisher dasselbe — hinspringen, weiterlaufen.
 * Damit „Hören" etwas anderes bedeutet als „Einsteigen", muss das Zitat genau
 * seinen Satz spielen und dann anhalten. Dafür braucht es ein Ende, und das
 * steht nicht in der Note — aber in den Transkripten, wortgenau.
 *
 * Läuft EINMAL vorab, nicht bei jedem Build: Die Transkripte sind
 * urheberrechtlich geschützt und bleiben im privaten Vault. Ins Projekt
 * wandert nur das Ergebnis — Zahlenpaare, kein Text.
 *
 *   node scripts/zitat-enden.mjs [--nur <Suchwort>] [--laut]
 */
import fs from "node:fs";
import path from "node:path";
import { nackt, zitatSchluessel } from "../src/lib/text.mjs";

const VAULT = path.join(process.env.HOME, "Cortex", "Gedankenwelten");
const TRANSKRIPTE = path.join(VAULT, "Transkripte");
const INHALT = path.join(process.env.HOME, "Gedankenwelten", "content");
const ZIEL = path.join(process.cwd(), "src", "data", "zitat-enden.json");
const RUBRIKEN = ["Zeitgeist", "Denker", "Geistesblitz", "Kultur", "Panorama",
                  "Gedanken", "Spuren", "GoodNews", "Vipassana", "DenkerVita"];

const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
const NUR = arg("--nur");
const LAUT = process.argv.includes("--laut");

/* ── VTT → Wortstrom mit Zeiten ───────────────────────────────────────
   YouTube-Untertitel rollen: Jede Kachel wiederholt die vorige Zeile und
   hängt neue Wörter mit eigenem Zeitstempel an (<00:00:39.000><c> hat</c>).
   Wir nehmen darum nur die letzte Zeile jeder Kachel — dort steht das Neue.
   Whisper-Transkripte haben keine Wortmarken; dann reicht die Kachelgrenze. */
function sek(t) {
  const [h, m, r] = t.split(":");
  return +h * 3600 + +m * 60 + parseFloat(r);
}

function wortstrom(vttText) {
  const worte = [];
  const kacheln = vttText.split(/\r?\n\r?\n/);

  for (const kachel of kacheln) {
    const zeilen = kachel.split(/\r?\n/).filter(Boolean);
    const zi = zeilen.findIndex((z) => z.includes("-->"));
    if (zi < 0) continue;

    const [von, bis] = zeilen[zi].split("-->").map((s) => sek(s.trim().split(" ")[0]));
    if (bis - von < 0.05) continue;           // Füllkacheln der Rollanzeige
    const nutz = zeilen.slice(zi + 1);
    if (!nutz.length) continue;
    const zeile = nutz[nutz.length - 1];

    if (zeile.includes("<c>")) {
      // Erstes Wort trägt keine Marke — es beginnt mit der Kachel
      const kopf = zeile.slice(0, zeile.indexOf("<")).trim();
      if (kopf) for (const w of kopf.split(/\s+/)) worte.push({ w, von, bis: von });
      for (const m of zeile.matchAll(/<(\d\d:\d\d:\d\d\.\d+)><c>\s*([^<]+)<\/c>/g)) {
        const t = sek(m[1]);
        for (const w of m[2].trim().split(/\s+/)) {
          if (worte.length) worte[worte.length - 1].bis = t;
          worte.push({ w, von: t, bis: t });
        }
      }
      if (worte.length) worte[worte.length - 1].bis = bis;
    } else {
      // Keine Wortmarken (Whisper): Kachel gleichmäßig auf die Wörter verteilen
      const ws = zeile.replace(/<[^>]*>/g, "").trim().split(/\s+/).filter(Boolean);
      if (!ws.length) continue;
      if (worte.length && worte[worte.length - 1].bis >= von) continue;  // Wiederholung
      const schritt = (bis - von) / ws.length;
      ws.forEach((w, i) => worte.push({ w, von: von + i * schritt, bis: von + (i + 1) * schritt }));
    }
  }
  return worte;
}


/** Bester Ort für eine kurze Wortfolge in einem Fenster — Treffer zählen. */
function besterOrt(strom, von, bis, folge) {
  if (!folge.length) return -1;
  let best = -1, bestPunkte = 0;
  const spanne = folge.length + 4;
  for (let i = von; i <= bis - 1; i++) {
    let punkte = 0;
    const sicht = new Set();
    for (let j = i; j < Math.min(i + spanne, strom.length); j++) sicht.add(strom[j].n);
    for (const w of folge) if (sicht.has(w)) punkte++;
    if (punkte > bestPunkte) { bestPunkte = punkte; best = i; }
  }
  return bestPunkte >= Math.ceil(folge.length * 0.6) ? best : -1;
}

/* ── Zitate aus einer Note lesen ──
   Blockquote ohne [!callout] = gesprochenes Wort. Der zuletzt davor
   stehende Zeitstempel gehört dazu. */
function zitateAus(markdown) {
  const zeilen = markdown.split(/\r?\n/);
  const raus = [];
  let letzterT = null, sammler = null;

  const schliessen = () => {
    if (sammler && sammler.t != null) {
      const text = sammler.text.join(" ").trim();
      if (text.length > 25) raus.push({ t: sammler.t, text });
    }
    sammler = null;
  };

  for (const zeile of zeilen) {
    for (const m of zeile.matchAll(/\[▶[^\]]*\]\([^)]*[?&]t=(\d+)\)/g)) letzterT = +m[1];

    if (/^\s*>/.test(zeile)) {
      const inhalt = zeile.replace(/^\s*>\s?/, "");
      if (/^\[!/.test(inhalt)) { schliessen(); sammler = { skip: true }; continue; }
      if (sammler?.skip) continue;
      if (!sammler) sammler = { t: letzterT, text: [] };
      sammler.text.push(inhalt);
    } else if (zeile.trim() === "") {
      schliessen();
    } else {
      schliessen();
    }
  }
  schliessen();
  return raus;
}

/* ── Video-ID → Transkript ───────────────────────────────────────────
   Die VTT-Dateinamen tragen keine Video-ID, die begleitenden
   _Transkript.txt aber schon (in den Zeitstempel-Links). Darüber koppeln. */
function transkriptIndex() {
  const idx = new Map();
  if (!fs.existsSync(TRANSKRIPTE)) return idx;
  const dateien = fs.readdirSync(TRANSKRIPTE);
  const vtts = dateien.filter((d) => d.endsWith(".vtt"));

  for (const txt of dateien.filter((d) => d.endsWith("_Transkript.txt"))) {
    const roh = fs.readFileSync(path.join(TRANSKRIPTE, txt), "utf8").slice(0, 400000);
    const id = /watch\?v=([A-Za-z0-9_-]{11})/.exec(roh)?.[1];
    if (!id || idx.has(id)) continue;
    // Die VTT heißt mal `basis.de.vtt`, mal `basis_Voller Videotitel.de.vtt` —
    // also über den Präfix suchen und den kürzesten Treffer nehmen, damit
    // `NZ_Salon_Maerz2026` nicht die Datei von `…_Teil2` erwischt.
    const basis = txt.replace(/_Transkript\.txt$/, "");
    const vtt = vtts
      .filter((v) => v.startsWith(basis))
      .sort((a, b) => a.length - b.length)[0];
    if (vtt) idx.set(id, path.join(TRANSKRIPTE, vtt));
  }
  return idx;
}

/* ── Hauptlauf ──────────────────────────────────────────────────────── */
const vttNach = transkriptIndex();
console.log(`${vttNach.size} Videos mit Transkript verknüpft`);

const ergebnis = {};
const stroeme = new Map();
let notes = 0, zitate = 0, gefunden = 0, ohneTranskript = 0;

for (const rubrik of RUBRIKEN) {
  const ordner = path.join(INHALT, rubrik);
  if (!fs.existsSync(ordner)) continue;

  for (const datei of fs.readdirSync(ordner)) {
    if (!datei.endsWith(".md")) continue;
    if (NUR && !datei.includes(NUR)) continue;

    const md = fs.readFileSync(path.join(ordner, datei), "utf8");
    const videoId = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/.exec(md)?.[1];
    if (!videoId) continue;

    const zs = zitateAus(md);
    if (!zs.length) continue;
    notes++;
    zitate += zs.length;

    const vttPfad = vttNach.get(videoId);
    if (!vttPfad) { ohneTranskript += zs.length; continue; }

    if (!stroeme.has(videoId)) {
      const roh = wortstrom(fs.readFileSync(vttPfad, "utf8"));
      stroeme.set(videoId, roh.map((x) => ({ ...x, n: nackt(x.w)[0] ?? "" })).filter((x) => x.n));
    }
    const strom = stroeme.get(videoId);
    if (!strom.length) continue;

    for (const z of zs) {
      const worte = nackt(z.text);
      if (worte.length < 5) continue;

      // Suchfenster um den bekannten Anfang — klein halten, das macht es sicher
      let a = strom.findIndex((x) => x.von >= z.t - 90);
      if (a < 0) a = 0;
      let b = strom.findIndex((x) => x.von > z.t + 150);
      if (b < 0) b = strom.length;

      // Ankerpunkt über die ersten tragenden Wörter — „der/die/ist" passen
      // überall und führen die Suche in die Irre.
      const kopf = worte.slice(0, 9).filter((w) => w.length >= 5).slice(0, 5);
      if (kopf.length < 3) continue;
      const anfang = besterOrt(strom, a, b, kopf);
      if (anfang < 0) {
        if (LAUT) console.log(`  – ${z.t}s Anfang nicht gefunden „${z.text.slice(0, 45)}…"`);
        continue;
      }

      // Von dort das ganze Zitat Wort für Wort mitlaufen lassen. Das verträgt
      // beides: eingeschobene „ähs" im Transkript und Wörter, die der
      // Erkenner verschluckt hat. Und es nutzt die volle Passage als Beleg,
      // statt sich auf fünf Wörter am Rand zu verlassen.
      const LUECKE = 16;
      let qi = 0, ti = anfang, letzter = anfang, treffer = 0;
      while (qi < worte.length && ti < b) {
        let fund = -1;
        for (let j = ti; j < Math.min(ti + LUECKE, b); j++) {
          if (strom[j].n === worte[qi]) { fund = j; break; }
        }
        if (fund >= 0) { letzter = fund; ti = fund + 1; treffer++; }
        qi++;
      }

      const guete = treffer / worte.length;
      if (guete < 0.55) {
        if (LAUT) console.log(`  – ${z.t}s nur ${(guete * 100).toFixed(0)} % der Wörter wiedergefunden`);
        continue;
      }

      const bis = strom[letzter].bis;
      const dauer = bis - z.t;
      // Nur noch grobe Plausibilität — die Wortkette ist der eigentliche Beleg
      const erwartet = z.text.length / 13;
      if (dauer < 1.5 || dauer > erwartet * 2.5 || dauer > 150) {
        if (LAUT) console.log(`  ? ${z.t}s Dauer ${dauer.toFixed(1)}s (erwartet ~${erwartet.toFixed(0)}s) — verworfen`);
        continue;
      }

      const schluessel = zitatSchluessel(videoId, z.t, z.text);
      ergebnis[schluessel] = Math.round(bis * 10) / 10;
      gefunden++;
      if (LAUT) console.log(`  ✓ ${z.t}s → ${bis.toFixed(1)}s (${dauer.toFixed(1)}s) „${z.text.slice(0, 55)}…"`);
    }
  }
}

fs.mkdirSync(path.dirname(ZIEL), { recursive: true });
fs.writeFileSync(ZIEL, JSON.stringify(ergebnis, null, 0));

const quote = zitate ? ((gefunden / zitate) * 100).toFixed(1) : "0";
console.log(`
Notes mit Video und Zitat:  ${notes}
Zitate gesamt:              ${zitate}
  davon ohne Transkript:    ${ohneTranskript}
  Ende gefunden:            ${gefunden}  (${quote} %)
geschrieben:                ${path.relative(process.cwd(), ZIEL)}`);
