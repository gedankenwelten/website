#!/usr/bin/env node
/**
 * Stichprobe: Lassen sich die Buchlinks zuverlässig auf eine ISBN auflösen?
 *
 * Die Buchquellen tragen keinen sauberen Autor — der steckt meist nur im
 * Suchstring (`?q=baberowski+raeume+der+gewalt`). Wir zerlegen ihn also und
 * fragen die Kataloge STRUKTURIERT (Titel und Autor getrennt); als freier Text
 * verwechseln beide Kataloge zu viel.
 *
 * Geprüft wird jeder Treffer gegen die Ausgangsdaten — eine falsche ISBN ist
 * schlimmer als eine Suchseite, also lieber nichts als etwas Ungeprüftes.
 *
 *   node scripts/isbn-stichprobe.mjs [anzahl]
 */
import fs from "node:fs";
import path from "node:path";

const QUELLEN = path.join(process.env.HOME, "Cortex", ".claude", "data", "sources.jsonl");
const ANZAHL = Number(process.argv[2]) || 50;

const schlaf = (ms) => new Promise((r) => setTimeout(r, ms));
const nackt = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length > 2);

/** Titel, die nichts aussagen — dann trägt allein der Suchstring. */
const PLATZHALTER = /^(buch|buch bei genialokal|bei genialokal|genialokal|link)\b/i;

/** Wörter, die nie ein Nachname sind. */
const KEIN_NAME = new Set([
  "der", "die", "das", "dem", "den", "des", "ein", "eine", "einer", "und", "oder",
  "von", "vom", "im", "in", "auf", "zur", "zum", "the", "a", "an", "of", "on",
  "buch", "warum", "wie", "was", "wer", "wir", "mein", "meine", "aus", "über",
]);

/**
 * Aus Quelleneintrag → Titel und AUTOR-KANDIDATEN.
 *
 * Der Suchstring beginnt meist mit dem Nachnamen — aber eben nicht immer:
 * „byung chul han psychopolitik" trägt den Nachnamen an dritter Stelle,
 * „vandana shiva" an zweiter. Also raten wir nicht, sondern probieren
 * mehrere Kandidaten durch und lassen die Prüfung entscheiden.
 */
/** ae/oe/ue zurück zu Umlauten — „Poerksen" findet „Pörksen" sonst nie. */
function entTranslit(w) {
  return w.replace(/ae/g, "ä").replace(/oe/g, "ö").replace(/ue/g, "ü");
}

function zerlegen(q) {
  const suche = decodeURIComponent((/[?&]q=([^&]*)/.exec(q.url) || [])[1] || "").replace(/\+/g, " ");
  const worte = suche.split(/\s+/).filter(Boolean);
  const echterTitel = (q.title || "").replace(/^Buch:\s*/i, "")
    .replace(/\s*\([^)]*\)\s*$/, "").replace(/^[^:]{0,28}:\s*\*?/, "").trim();

  /* Ein Suchstring wie „byung chul han psychopolitik" trägt Autor UND Titel,
     aber die Grenze ist unbekannt — mal ein Wort („baberowski räume der
     gewalt"), mal drei. Statt zu raten: alle plausiblen Schnitte probieren
     und die Prüfung entscheiden lassen. */
  const paare = [];
  const nimm = (titel, autor) => {
    titel = (titel || "").trim();
    if (titel.length > 2) paare.push({ titel, autor: (autor || "").trim() });
  };

  if (echterTitel && !PLATZHALTER.test(echterTitel)) {
    for (const a of [worte[0], worte.slice(0, 2).join(" "), ""]) {
      nimm(echterTitel, a);
      if (a) nimm(echterTitel, entTranslit(a));
    }
    // Untertitel abwerfen — Kataloge führen sie oft anders
    const kurz = echterTitel.split(/\s*[.—–:]\s+/)[0];
    if (kurz !== echterTitel) nimm(kurz, worte[0]);
  }

  for (let k = 1; k <= Math.min(3, worte.length - 1); k++) {
    const autor = worte.slice(0, k).join(" ");
    if (KEIN_NAME.has(worte[0]?.toLowerCase())) break;
    nimm(worte.slice(k).join(" "), autor);
    nimm(worte.slice(k).join(" "), entTranslit(autor));
  }
  nimm(worte.slice(1).join(" "), "");

  return { paare, suche, titel: echterTitel || worte.slice(1).join(" ") };
}

/* ── Kataloge ─────────────────────────────────────────────────────────── */

async function openLibrary(titel, autor) {
  const u = `https://openlibrary.org/search.json?title=${encodeURIComponent(titel)}`
          + `&author=${encodeURIComponent(autor)}&limit=3`
          + `&fields=title,author_name,isbn,first_publish_year,publisher`;
  const d = await (await fetch(u, { headers: { "User-Agent": "Gedankenwelten/1.0 (privates Wissensarchiv)" } })).json();
  return (d.docs || []).map((x) => ({
    quelle: "OpenLibrary",
    titel: x.title,
    autor: (x.author_name || [])[0] || "",
    jahr: x.first_publish_year,
    verlag: (x.publisher || [])[0],
    // ISBN-13 bevorzugen, die führt bei genialokal eindeutig zum Produkt
    isbn: (x.isbn || []).find((i) => /^97[89]\d{10}$/.test(i)) || (x.isbn || [])[0],
  }));
}

async function dnb(titel, autor) {
  const u = "https://services.dnb.de/sru/dnb?version=1.1&operation=searchRetrieve"
          + `&query=tit%3D${encodeURIComponent(titel)}%20and%20atr%3D${encodeURIComponent(autor)}`
          + "&recordSchema=oai_dc&maximumRecords=3";
  const x = await (await fetch(u)).text();
  const saetze = x.split("<dc:").length > 1 ? x.split("<record") : [];
  return saetze.slice(1).map((s) => {
    const feld = (n) => (new RegExp(`<dc:${n}[^>]*>(.*?)</dc:${n}>`, "s").exec(s) || [])[1];
    const isbns = [...s.matchAll(/97[89][\d-]{10,14}/g)].map((m) => m[0].replace(/-/g, ""));
    return {
      quelle: "DNB",
      titel: (feld("title") || "").replace(/^\[[^\]]*\]\s*;?\s*/, "").split(" / ")[0],
      autor: feld("creator") || "",
      jahr: (feld("date") || "").slice(0, 4),
      verlag: feld("publisher"),
      isbn: isbns.find((i) => i.length === 13),
    };
  });
}

/** oe/ae/ue vereinheitlichen, damit "Poerksen" und "Pörksen" dasselbe Wort sind. */
const gleichNamig = (s) => (s || "").toLowerCase()
  .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
  .replace(/[^a-z\s]/g, " ").split(/\s+/).filter((w) => w.length >= 5);

/* ── Prüfung ──
   Ein Treffer zählt nur, wenn Titel UND Autor tatsächlich passen. */
function passt(kandidat, titel, autor) {
  if (!kandidat.isbn) return false;
  const soll = nackt(titel), ist = nackt(kandidat.titel);
  if (!soll.length || !ist.length) return false;
  const deckung = soll.filter((w) => ist.includes(w)).length / soll.length;
  if (deckung < 0.6) return false;

  /* Ein Ein-Wort-Titel wie "Hartmann" steckt in jedem laengeren Titel — er
     traegt nur, wenn der gefundene Titel ebenfalls kurz ist. Sonst laesst er
     "Horses of Vengeance Hartmann" als Treffer durch. */
  if (soll.length === 1 && ist.length > 2) return false;

  /* Die Falle, an der "michael hartmann abgehobenen" auf "Hartmann World
     History" von Michael A. Bellesiles hereinfiel: Der geteilte Name war der
     VORNAME. Ein Vorname belegt nichts — es gibt tausend Michaels. */
  const gefunden = (kandidat.autor || "").replace(/\[[^\]]*\]/g, "");
  const seine = gleichNamig(gefunden);
  const unsere = gleichNamig(autor);

  // Ohne Autorbeleg nur durchlassen, wenn der Titel fuer sich schon traegt
  if (!unsere.length) return soll.length >= 3;

  const geteilt = seine.filter((w) => unsere.includes(w));
  if (!geteilt.length) return false;

  // "Nachname, Vorname" (DNB-Form) — dort steht der Nachname vorn, sonst hinten
  if (seine.length > 1) {
    const vorname = gefunden.includes(",") ? seine[seine.length - 1] : seine[0];
    if (geteilt.every((w) => w === vorname)) return false;
  }
  return true;
}

/* ── Lauf ─────────────────────────────────────────────────────────────── */
const buecher = fs.readFileSync(QUELLEN, "utf8").split("\n").filter(Boolean)
  .map((l) => JSON.parse(l)).filter((b) => b.type === "book" && b.url?.includes("genialokal"));

// Gleichmäßig über den Bestand streuen statt die ersten fünfzig nehmen
const schritt = Math.max(1, Math.floor(buecher.length / ANZAHL));
const probe = buecher.filter((_, i) => i % schritt === 0).slice(0, ANZAHL);

console.log(`${buecher.length} Buchquellen · Stichprobe ${probe.length}\n`);

const treffer = [], daneben = [];
for (const b of probe) {
  const { paare, suche, titel } = zerlegen(b);
  if (!paare.length) { daneben.push({ suche, grund: "nichts ableitbar" }); continue; }

  let fund = null, benutzt = null;
  suchen:
  for (const { titel: t, autor: a } of paare) {
    for (const katalog of [openLibrary, dnb]) {
      try {
        const kandidaten = await katalog(t, a);
        const k = kandidaten.find((x) => passt(x, t, a));
        if (k) { fund = k; benutzt = `${a || "—"} / ${t}`; break suchen; }
      } catch { /* Katalog nicht erreichbar — der nächste darf es versuchen */ }
      await schlaf(220);
    }
  }

  if (fund) treffer.push({ suche, titel, gefundenUeber: benutzt, ...fund });
  else daneben.push({ suche, titel, autoren: paare.map((p) => p.autor), grund: "kein geprüfter Treffer" });
  await schlaf(150);
}

const quote = ((treffer.length / probe.length) * 100).toFixed(0);
console.log(`✓ aufgelöst: ${treffer.length}/${probe.length}  (${quote} %)\n`);
console.log("── Treffer (Stichprobe) ──");
for (const t of treffer.slice(0, 18)) {
  console.log(`  ${t.isbn}  ${(t.titel || "").slice(0, 40).padEnd(40)} ${(t.autor || "").slice(0, 20).padEnd(20)} ${t.jahr ?? ""}  [${t.quelle}]`);
}
console.log("\n── Nicht aufgelöst ──");
for (const d of daneben.slice(0, 16)) {
  const probiert = (d.autoren || []).filter(Boolean).join(", ") || "—";
  console.log(`  „${(d.titel || d.suche).slice(0, 48)}"  · probiert: ${probiert}`);
}

fs.writeFileSync("/tmp/isbn-stichprobe.json", JSON.stringify({ treffer, daneben }, null, 2));
console.log(`\nvollständig: /tmp/isbn-stichprobe.json`);
