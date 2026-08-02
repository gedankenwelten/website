/**
 * Der Bestand als Netz — zwei Arten von Kante.
 *
 *   durchgezogen  ein Wikilink. Jemand hat die Verbindung gedacht und
 *                 hingeschrieben; sie steht schon im Text.
 *   gestrichelt   dieselbe Quelle, in beiden Notes zitiert, ohne dass sie
 *                 je jemand miteinander verbunden hätte.
 *
 * Die zweite Sorte ist der eigentliche Grund für dieses Modul. Sie ist
 * nichts, was jemand behauptet hat — sie liegt im Bestand und war bisher
 * nur nicht sichtbar, weil niemand 5.393 Quellenangaben quer liest.
 *
 * Sie ist auch selten: von 748 Notes finden sich am Ende 67 Paare, die eine
 * Quelle teilen, ohne verlinkt zu sein. Das ist keine Schwäche des
 * Verfahrens, sondern sein Maß — fiele die gestrichelte Linie überall,
 * hieße sie nichts.
 */
import fs from "node:fs";
import path from "node:path";
import { ladeIndex, findeNote } from "./notizen.mjs";

const QUELLEN = path.join(process.env.HOME, "Cortex", ".claude", "data", "sources.jsonl");

/* ══ Was als geteilte Quelle zählt ═══════════════════════════════════════
   Der Quellen-Index erntet auch die Videobeschreibung mit ab, und dort
   steht neben dem Buch, um das es geht, immer auch der Spendenlink, das
   Forum und der Instagram-Kanal. Acht Notes, die alle „Jung & Naiv Forum"
   zitieren, verbindet nichts — sie kommen nur vom selben Kanal.
   Das ist kein Fund, das ist ein Briefkopf. */

const BEIWERK =
  /paypal|patreon|steady\.page|betterplace|unterst(ue|ü)tz|spenden|donate|\/shop\b|abonn|instagram\.com|facebook\.com|(?:twitter|x)\.com\/|tiktok|bsky\.app|linktr\.ee|\/impressum|\/newsletter|\/playlist\?|forum\./i;

function istQuelle(q) {
  let u;
  try { u = new URL(q.url); } catch { return false; }
  if (BEIWERK.test(q.url)) return false;
  const pfad = u.pathname.replace(/\/+$/, "");
  // Eine Startseite ist eine Adresse, keine Fundstelle. „apnews.com" sagt
  // nicht, was zwei Notes gemeinsam gelesen haben.
  if (!pfad && !u.search) return false;
  if (/^\/(suche|search)$/i.test(pfad)) return false;
  return true;
}

// Wie schwer eine geteilte Quelle wiegt. Ein DOI ist ein Beleg, den beide
// Seiten geprüft haben; eine Linkliste unter einem Video ist ein Zufall.
const NACH_ART = { study: 1, book: .85, "official-data": .85, video: .8, podcast: .8, wikipedia: .5, article: .65 };
const NACH_HERKUNFT = {
  faktencheck: 1, sherlock: 1, weiterfuehrend: .9, primary: .85, "in-video": .85,
  "denkervita-book": .7, "denkervita-video": .7, "video-description": .45,
};

let graph = null;

export function ladeGraph() {
  if (graph) return graph;

  const idx = ladeIndex();
  const knoten = new Map(idx.alle.map((n) => [n.id, n]));

  /* ── Wikilinks ──────────────────────────────────────────────────── */
  const hinaus = new Map();
  for (const n of idx.alle) {
    const s = new Set();
    for (const ziel of n.ziele) {
      const t = findeNote(ziel);
      if (t && t.id !== n.id) s.add(t.id);
    }
    hinaus.set(n.id, s);
  }
  const herein = new Map(idx.alle.map((n) => [n.id, new Set()]));
  for (const [von, ziele] of hinaus) for (const nach of ziele) herein.get(nach)?.add(von);

  /* ── Die geschriebenen Begründungen ─────────────────────────────────
     Aus dem `## Verbindungen`-Abschnitt: zu jeder Kante der Satz, der
     schon dasteht. Er schlägt jede Formulierung, die wir hier erzeugen
     könnten — „verweisen aufeinander" sagt, *dass* etwas verbunden ist,
     dieser Satz sagt *warum*.
     Gerichtet gespeichert: A begründet B, das ist nicht dasselbe wie
     umgekehrt, und beide Sätze sind lesenswert. */
  const begruendung = new Map();   // "von\0nach" → Satz
  for (const n of idx.alle) {
    for (const { ziel, warum } of n.begruendet) {
      const t = findeNote(ziel);
      if (t && t.id !== n.id) begruendung.set(`${n.id}\u0000${t.id}`, warum);
    }
  }

  /* ── Kataloge aussortieren ──────────────────────────────────────────
     „Zeitgeist — Übersicht" verweist auf 276 Notes, „Alle Denker" auf 237.
     Das sind Inhaltsverzeichnisse, keine Gedanken: Sie stünden im Stern
     jeder zweiten Note und sagten dort nichts, weil sie neben allem
     stehen. Der Bestand trennt sie selbst deutlich ab — nach den beiden
     kommt lange nichts, die dritthäufigste Note verweist auf 73. */
  const katalog = new Set(
    idx.alle
      .filter((n) => n.tags.includes("meta") || (hinaus.get(n.id)?.size ?? 0) > 120)
      .map((n) => n.id),
  );
  for (const id of katalog) {
    for (const s of hinaus.values()) s.delete(id);
    for (const s of herein.values()) s.delete(id);
  }

  /* ── Geteilte Quellen ───────────────────────────────────────────── */
  // Schlüssel: beide Kennungen sortiert, getrennt durch \0 — ein Leerzeichen
  // taugt nicht, Dateinamen enthalten selbst welche.
  const geteilt = new Map();   // "a\0b" → [{titel, art, url, gewicht}]
  let gelesen = 0, verworfen = 0;

  if (fs.existsSync(QUELLEN)) {
    for (const zeile of fs.readFileSync(QUELLEN, "utf8").split("\n")) {
      if (!zeile.trim()) continue;
      let q;
      try { q = JSON.parse(zeile); } catch { continue; }

      const ids = [...new Set(
        (q.notes ?? [])
          .map((p) => p.replace(/^Gedankenwelten\//, "").replace(/\.md$/, "").normalize("NFC"))
          .map((p) => idx.nachRubrikBasis.get(p.toLowerCase())?.id)
          .filter(Boolean),
      )];
      if (ids.length < 2) continue;
      if (!istQuelle(q)) { verworfen++; continue; }
      gelesen++;

      // Je mehr Notes dieselbe Quelle nennen, desto weniger sagt sie über
      // zwei davon aus — dieselbe Logik, die eine Suchmaschine seltene
      // Wörter höher gewichtet als häufige.
      const seltenheit = 1 / Math.log2(ids.length + 1);
      const gewicht = (NACH_ART[q.type] ?? .6) * (NACH_HERKUNFT[q.origin] ?? .6) * seltenheit;

      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          const k = [ids[i], ids[j]].sort().join("\u0000");
          if (!geteilt.has(k)) geteilt.set(k, []);
          // Quellentitel tragen oft noch Markdown aus der Note, in der sie
          // geerntet wurden („Hoffman et al. 2016, *PNAS*"). In eine
          // Bildunterschrift gehören keine Sternchen.
          const titel = q.title.replace(/[*_`]/g, "").replace(/\s{2,}/g, " ").trim();
          geteilt.get(k).push({ titel, art: q.type, url: q.url, gewicht });
        }
      }
    }
  }

  // Nach Knoten aufgeschlüsselt — sonst liest jede der 748 Seiten die
  // gesamte Paarliste mehrfach durch.
  const quellNachbarn = new Map();
  for (const [k, qs] of geteilt) {
    const [a, b] = k.split("\u0000");
    if (!quellNachbarn.has(a)) quellNachbarn.set(a, new Map());
    if (!quellNachbarn.has(b)) quellNachbarn.set(b, new Map());
    quellNachbarn.get(a).set(b, qs);
    quellNachbarn.get(b).set(a, qs);
  }

  graph = { knoten, hinaus, herein, geteilt, quellNachbarn, katalog, begruendung, statistik: { gelesen, verworfen } };
  return graph;
}

/** Der Titel zerlegt: „Clara Mattei — Geschichte der Austeritätspolitik". */
function zweiteilen(titel) {
  const m = /^(.{2,42}?)\s+[—–]\s+(.+)$/.exec(titel);
  return m ? { kopf: m[1], schwanz: m[2] } : { kopf: titel, schwanz: null };
}

const kurz = (s, n) => (s && s.length > n ? s.slice(0, n - 1).replace(/\s\S*$/, "") + "…" : s);

/**
 * Das Sternbild um eine Note: ihre Nachbarn und — entscheidend für die
 * Gestalt — die Kanten, die zwischen den Nachbarn laufen. Ohne die wäre es
 * ein Fächer; mit ihnen sieht man, welche Nachbarn zusammengehören.
 *
 * @param {string} id     Note-Kennung, `Rubrik/Dateiname`
 * @param {number} kappe  Höchstzahl Nachbarn (eine Note hat bis zu 277)
 */
export function sternFuer(id, kappe = 20) {
  const g = ladeGraph();
  const selbst = g.knoten.get(id);
  // Ein Inhaltsverzeichnis hat keine Nachbarschaft, es hat einen Inhalt.
  if (!selbst || g.katalog.has(id)) return null;

  /* ── Nachbarn sammeln und gewichten ─────────────────────────────── */
  const kandidaten = new Map();   // id → {raus, rein, quellen:[], gewicht}
  const nimm = (nid) => {
    if (!kandidaten.has(nid)) kandidaten.set(nid, { raus: false, rein: false, quellen: [] });
    return kandidaten.get(nid);
  };
  for (const n of g.hinaus.get(id) ?? []) nimm(n).raus = true;
  for (const n of g.herein.get(id) ?? []) nimm(n).rein = true;
  for (const [nid, qs] of g.quellNachbarn.get(id) ?? []) {
    if (!g.katalog.has(nid)) nimm(nid).quellen = qs;
  }

  const bewertet = [...kandidaten].map(([nid, e]) => {
    const q = e.quellen.reduce((s, x) => s + x.gewicht, 0);
    return {
      nid, ...e, quellgewicht: q,
      // Beidseitig gedachte Verbindungen zuerst, dann einseitige; die reine
      // Quellen-Nachbarschaft nach ihrem Gewicht. Wer nur über eine dünne
      // Quelle hängt, fällt bei knappem Platz zuerst heraus.
      rang: (e.raus && e.rein ? 3 : e.raus || e.rein ? 2 : 0) + Math.min(q, 1.4),
    };
  }).sort((x, y) => y.rang - x.rang);

  /* Die gestrichelte Kante bekommt ihren Platz zuerst.
     Sortierte man einfach nach Rang, verlöre sie jedes Mal: ein
     Wikilink ist eine geschriebene Verbindung und wiegt schwerer als eine
     bloß geteilte Fußnote. Bei einer Note mit 37 Nachbarn hieße das, dass
     die eine unentdeckte Nähe von zwanzig längst bekannten verdrängt wird
     — die Kappung würde genau das wegschneiden, wofür es den Stern gibt.
     Also: erst alle Funde, dann die Verweise auffüllen. */
  const funde = bewertet.filter((x) => x.quellen.length && !x.raus && !x.rein);
  const rest = bewertet.filter((x) => !funde.includes(x));
  const gewaehlt = [...funde.slice(0, kappe), ...rest].slice(0, Math.max(kappe, funde.length))
    .sort((x, y) => y.rang - x.rang);
  const weitere = bewertet.length - gewaehlt.length;
  const dabei = new Set(gewaehlt.map((x) => x.nid));

  /* ── Knoten ─────────────────────────────────────────────────────── */
  const bau = (n, mitte) => {
    const { kopf, schwanz } = zweiteilen(n.titel);
    return {
      id: n.id, url: n.url, rubrik: n.rubrik, mitte,
      kopf: kurz(kopf, mitte ? 46 : 30),
      schwanz: mitte ? schwanz : kurz(schwanz, 34),
      titel: n.titel,
    };
  };
  const nodes = [bau(selbst, true), ...gewaehlt.map((x) => bau(g.knoten.get(x.nid), false))];

  /* ── Kanten: zur Mitte und untereinander ────────────────────────── */
  const links = [];
  const gesehen = new Set();
  const kante = (a, b, e) => {
    const k = [a, b].sort().join("\u0000");
    if (gesehen.has(k)) return;
    gesehen.add(k);
    links.push({ source: a, target: b, ...e });
  };

  for (const x of gewaehlt) {
    if (x.raus || x.rein) {
      kante(id, x.nid, {
        art: "wikilink",
        richtung: x.raus && x.rein ? "beide" : x.raus ? "hin" : "her",
        warum: x.raus && x.rein
          ? "verweisen aufeinander"
          : x.raus ? "diese Note verweist dorthin" : "verweist auf diese Note",
      });
    }
    if (x.quellen.length) {
      // Wo schon ein Wikilink läuft, ist die geteilte Quelle keine
      // Entdeckung mehr, sondern die Bestätigung einer bekannten Nähe.
      // Sie bekommt keine eigene Linie, sondern hängt sich an die alte.
      const alt = links.find((l) => l.source === id && l.target === x.nid || l.source === x.nid && l.target === id);
      const q = [...x.quellen].sort((a, b) => b.gewicht - a.gewicht);
      if (alt) { alt.quellen = q; }
      else kante(id, x.nid, {
        art: "quelle", quellen: q,
        warum: q.length === 1 ? "beide zitieren dieselbe Quelle" : `${q.length} gemeinsame Quellen`,
      });
    }
  }

  // Kanten unter den Nachbarn — sie machen aus dem Fächer ein Gefüge
  for (const a of dabei) {
    for (const b of g.hinaus.get(a) ?? []) {
      if (dabei.has(b)) kante(a, b, { art: "wikilink", rand: true });
    }
    for (const [b, qs] of g.quellNachbarn.get(a) ?? []) {
      if (dabei.has(b)) kante(a, b, { art: "quelle", rand: true, quellen: qs });
    }
  }

  return { nodes, links, weitere };
}
