/**
 * Obsidian-Markdown → Gedankenwelten-Form.
 *
 * Vier Umbauten in einem Durchgang, in Dokumentreihenfolge (die Reihenfolge
 * zählt: der O-Ton erbt den Zeitstempel des Absatzes, der ihn einleitet):
 *
 *   1. Zeitstempel  [▶ 3:34](…&t=214)   → Randanker, aus dem Satz in die Marge
 *   2. Wikilinks    [[Ziel|Text]]        → aufgelöster Link
 *      Einbettungen ![[…/bild.jpg|1200]] → Bild
 *   3. Callouts     > [!abstract] Titel  → gestaltete Blöcke statt Kästen
 *   4. O-Ton        > „…"                → hörbares Zitat
 *
 * Statt roher HTML-Knoten setzen wir `data.hName`/`data.hProperties` — dann
 * bleibt der Baum ein Baum und rehype macht daraus sauberes Markup.
 */
import { visit, SKIP } from "unist-util-visit";
import { findeNote } from "../lib/notizen.mjs";
import { zitatSchluessel } from "../lib/text.mjs";
import ZITAT_ENDEN from "../data/zitat-enden.json" with { type: "json" };

const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/** Nackter Text eines Teilbaums — für Überschriften-Vergleiche. */
function text(node) {
  let s = "";
  visit(node, (n) => { if (n.type === "text" || n.type === "inlineCode") s += n.value; });
  return s;
}

/** Callout-Typ → Gestalt. Kästen gibt es hier keine mehr. */
const CALLOUT = {
  abstract:  ["vorspann"],
  summary:   ["vorspann"],
  info:      ["kopfnote"],
  important: ["kopfnote"],
  tip:       ["kopfnote"],
  question:  ["frage"],
  note:      ["eigen"],
  success:   ["befund", "befund--ja"],
  warning:   ["befund", "befund--hm"],
  danger:    ["befund", "befund--nein"],
  quote:     ["oton"],
};

const BILD = /\.(jpe?g|png|webp|gif|svg|avif)$/i;

/* Reiner Text einer mdast-Zelle (Links, Betonung usw. durchlaufen). */
function zellenText(node) {
  if (node.type === "text" || node.type === "inlineCode") return node.value;
  return (node.children || []).map(zellenText).join("");
}

export default function remarkGedankenwelten() {
  return (tree, file) => {
    const fm = file.data?.astro?.frontmatter ?? {};
    let letzterT = null;
    const fehlLinks = [];

    // Die Video-Kennung muss VOR den Zitaten feststehen — ohne sie lässt sich
    // kein Zitat-Ende nachschlagen.
    visit(tree, "link", (node) => {
      if (fm.video) return;
      const id = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/.exec(node.url ?? "");
      if (id) fm.video = id[1];
    });

    /* ── 1. Zeitstempel in den Rand ─────────────────────────────────
       Auch aus Überschriften, nicht nur aus Absätzen: Im Bestand stehen
       elf verlinkte und einundfünfzig unverlinkte Zeitstempel in einer
       Überschrift. Blieben sie dort, hieße ein Abschnitt „Einleitung und
       Grundsatzkritik [▶ 0:00]" — die Marke gehört in den Rand, auch wenn
       sie neben einer Überschrift steht. */
    visit(tree, ["paragraph", "heading"], (absatz) => {
      let n = 0;
      visit(absatz, "link", (node) => {
        const erstes = node.children?.[0];
        if (erstes?.type !== "text" || !erstes.value.trimStart().startsWith("▶")) return;
        const t = Number(/[?&]t=(\d+)/.exec(node.url ?? "")?.[1]);
        if (!Number.isFinite(t)) return;

        const eigen = { className: ["ts"], "data-t": String(t) };
        // Mehrere Zeitstempel im selben Absatz stapeln sich, statt sich zu decken
        if (n > 0) eigen.style = `top:calc(.5em + ${(n * 1.55).toFixed(2)}em)`;
        // Der Knoten hört auf, ein Link zu sein — sonst greift der HTML-Wandler
        // weiter auf `url` zu, und `hName` allein hindert ihn nicht daran.
        node.type = "emphasis";
        node.data = { hName: "span", hProperties: eigen };
        node.children = [{ type: "text", value: erstes.value.replace("▶", "").trim() }];
        delete node.url;
        n++;
      });
    });

    /* ── 1b. Zeitstempel ohne Ziel ──────────────────────────────────
       Podcast-Notes tragen `[▶ 12:34]` ohne Link. Das ist kein Fehler,
       sondern der Normalfall dort: Die Folge liegt hinter einer
       Steady-Schranke, es gibt keine Adresse, auf die man zeigen könnte —
       `vtt_to_txt.py` schreibt für Podcasts darum nur die Marke.

       Ohne diesen Schritt blieben sie als rohe Klammern mitten im Satz
       stehen (275 Stück in zehn Notes), während ihre verlinkten
       Geschwister in den Rand wandern. Sie bekommen dieselbe Form, nur
       ohne Klick: Wo eine Passage im Gespräch sitzt, ist auch ohne Ziel
       eine Auskunft — und die Zeitleiste am linken Rand lebt davon. */
    const OHNE_ZIEL = /\[▶\s*(\d{1,3}):(\d{2})(?::(\d{2}))?\]/g;
    visit(tree, ["paragraph", "heading"], (absatz) => {
      let n = 0;
      visit(absatz, "text", (node, i, eltern) => {
        if (!eltern || !node.value.includes("▶")) return;
        const teile = [];
        let rest = 0, m;
        OHNE_ZIEL.lastIndex = 0;
        while ((m = OHNE_ZIEL.exec(node.value))) {
          if (m.index > rest) teile.push({ type: "text", value: node.value.slice(rest, m.index) });
          const [, a, b, c] = m;
          // `12:34` sind Minuten und Sekunden, `1:02:03` Stunden dazu.
          const t = c ? +a * 3600 + +b * 60 + +c : +a * 60 + +b;
          const eigen = { className: ["ts", "ts--stumm"], "data-t": String(t) };
          if (n > 0) eigen.style = `top:calc(.5em + ${(n * 1.55).toFixed(2)}em)`;
          teile.push({
            type: "emphasis",
            data: { hName: "span", hProperties: eigen },
            children: [{ type: "text", value: m[0].slice(1, -1).replace("▶", "").trim() }],
          });
          n++;
          rest = m.index + m[0].length;
        }
        if (!teile.length) return;
        if (rest < node.value.length) teile.push({ type: "text", value: node.value.slice(rest) });
        eltern.children.splice(i, 1, ...teile);
        return i + teile.length;
      });
    });

    /* ── 2. Wikilinks und Einbettungen ──────────────────────────────── */
    visit(tree, "text", (node, i, eltern) => {
      if (!eltern || !/!?\[\[/.test(node.value)) return;

      const teile = [];
      let rest = 0;
      const muster = /(!?)\[\[([^\]|]+)(?:\|([^\]]*))?\]\]/g;
      let m;
      while ((m = muster.exec(node.value))) {
        if (m.index > rest) {
          teile.push({ type: "text", value: node.value.slice(rest, m.index) });
        }
        const [, ruf, ziel, zusatz] = m;
        const eingebettet = ruf === "!";

        if (eingebettet && BILD.test(ziel)) {
          const datei = ziel.split("/").pop();
          const breite = /^\d+$/.test(zusatz ?? "") ? zusatz : null;
          teile.push({
            type: "image",
            url: `/assets/${encodeURIComponent(datei)}`,
            alt: "",
            data: {
              hProperties: {
                loading: "lazy",
                ...(breite ? { width: breite } : {}),
              },
            },
          });
        } else {
          const note = findeNote(ziel);
          const anker = ziel.includes("#") ? "#" + ziel.split("#")[1] : "";
          const text = zusatz || note?.titel || ziel.split("/").pop();
          if (note) {
            teile.push({
              type: "link",
              url: note.url + anker,
              data: {
                hProperties: {
                  className: ["wikilink"],
                  "data-note": note.url,
                },
              },
              children: [{ type: "text", value: text }],
            });
          } else {
            fehlLinks.push(ziel);
            teile.push({
              type: "emphasis",
              data: { hName: "span", hProperties: { className: ["link-tot"], title: `Ziel nicht gefunden: ${ziel}` } },
              children: [{ type: "text", value: text }],
            });
          }
        }
        rest = m.index + m[0].length;
      }
      if (rest < node.value.length) {
        teile.push({ type: "text", value: node.value.slice(rest) });
      }
      eltern.children.splice(i, 1, ...teile);
      return [SKIP, i + teile.length];
    });

    /* ── 2b. Tabellen bekommen einen Rahmen zum Schieben ────────────── */
    /* Eine vierspaltige Tabelle in einer 41-rem-Spalte bricht jede Zelle
       in drei Zeilen um und wird unlesbar. Der Umschlag darf im Notfall
       waagerecht scrollen — und trägt die Gestalt (Kopfzeile, Linien,
       Ziffern) über die CSS-Klasse. */
    visit(tree, "table", (node, i, eltern) => {
      if (!eltern || eltern.type === "tabelle") return;
      /* Eine reine Nummernspalte („#", „1", leer) soll nicht breiter sein
         als ihr Kopf; eine „Titel"-Spalte dagegen braucht den meisten
         Platz. Das entscheidet sich am Kopftext — CSS kann ihn nicht
         lesen, also markieren wir es hier. */
      const kopf = node.children?.[0]?.children?.[0];
      const kopfText = (kopf ? zellenText(kopf) : "").trim();
      const klassen = ["tabelle"];
      if (/^(#|nr\.?|№|\d+)$/i.test(kopfText)) klassen.push("tabelle--nr");
      eltern.children[i] = {
        type: "tabelle",
        data: { hProperties: { className: klassen } },
        children: [node],
      };
      return SKIP;
    });

    /* ── 2c. Quellen-Verzeichnisse bekommen ihr eigenes Register ────── */
    /* Alles zwischen „## (Weiterführende) Quellen" und der nächsten
       Überschrift gleicher Stufe ist ein Verzeichnis, kein Fließtext. */
    {
      const kinder = tree.children;
      for (let i = 0; i < kinder.length; i++) {
        const k = kinder[i];
        if (k.type !== "heading" || k.depth !== 2) continue;
        if (!/quellen/i.test(zellenText(k))) continue;
        let j = i + 1;
        while (j < kinder.length && !(kinder[j].type === "heading" && kinder[j].depth <= 2)
               && kinder[j].type !== "thematicBreak") j++;
        if (j === i + 1) continue;
        const block = {
          type: "quellen",
          data: { hName: "div", hProperties: { className: ["quellen"] } },
          children: kinder.slice(i + 1, j),
        };
        kinder.splice(i + 1, j - i - 1, block);
        i += 1;
      }
    }

    /* ── 3. + 4. Callouts und O-Ton, in Dokumentreihenfolge ─────────── */
    visit(tree, (node) => {
      // Zeitstempel merken, während wir durchlaufen — der O-Ton erbt ihn
      if (node.data?.hProperties?.["data-t"]) {
        letzterT = Number(node.data.hProperties["data-t"]);
        return;
      }
      if (node.type !== "blockquote") return;

      const ersterAbsatz = node.children?.[0];
      const ersterText = ersterAbsatz?.children?.[0];
      const roh = ersterText?.type === "text" ? ersterText.value : "";
      const kopf = /^\[!(\w+)\][+-]?\s*(.*)/.exec(roh);

      if (kopf) {
        const [, art, titel] = kopf;
        const klassen = CALLOUT[art.toLowerCase()] ?? ["kopfnote"];
        ersterText.value = roh.slice(kopf[0].length).replace(/^\n/, "");
        if (!ersterText.value.trim() && ersterAbsatz.children.length === 1) {
          node.children.shift();
        }
        node.data = { hName: "div", hProperties: { className: klassen } };
        if (titel?.trim()) {
          node.children.unshift({
            type: "paragraph",
            data: { hName: "span", hProperties: { className: ["block-label"] } },
            children: [{ type: "text", value: titel.trim() }],
          });
        }
        return SKIP;
      }

      // Kein Callout → gesprochenes Wort. Hörbar machen.
      const eigen = { className: ["oton"] };
      if (letzterT != null) eigen["data-t"] = String(letzterT);

      // Kennen wir das Ende der Passage, spielt das Zitat genau seinen Satz
      // und hält an — dann heißt es „Hören". Kennen wir es nicht, steigt man
      // ins Gespräch ein und es läuft weiter. Die Beschriftung sagt, was
      // wirklich passiert; sie verspricht nie mehr, als sie kann.
      let ende = null;
      if (letzterT != null && fm.video) {
        const roh = text(node).replace(/^\s*/, "");
        ende = ZITAT_ENDEN[zitatSchluessel(fm.video, letzterT, roh)] ?? null;
        if (ende != null) eigen["data-ende"] = String(ende);
      }

      node.data = { hName: "blockquote", hProperties: eigen };
      if (letzterT != null) {
        node.children.push({
          type: "paragraph",
          data: { hName: "span", hProperties: { className: ["oton__horen"] } },
          children: [{
            type: "text",
            value: ende != null
              ? `Hören — ${mmss(letzterT)}`
              : `Im Gespräch — ${mmss(letzterT)}`,
          }],
        });
      }
      return SKIP;
    });

    /* ── Verbindungen ernten ────────────────────────────────────────
       Der `## Verbindungen`-Abschnitt trägt schon beides: das Ziel und den
       Grund, in ganzen Sätzen. Genau der Stoff für die Rand-Karten — wir
       müssen ihn nur heben, nicht erfinden. */
    fm.verbindungen = [];
    {
      const k = tree.children;
      let i = k.findIndex(
        (n) => n.type === "heading" && n.depth === 2 && text(n).toLowerCase().startsWith("verbindungen"),
      );
      if (i >= 0) {
        for (i++; i < k.length; i++) {
          const n = k[i];
          if (n.type === "heading" && n.depth <= 2) break;
          if (n.type !== "heading" || n.depth !== 3) continue;
          let link = null;
          visit(n, "link", (l) => { link ??= l; });
          const warum = k[i + 1]?.type === "paragraph" ? text(k[i + 1]) : "";
          fm.verbindungen.push({
            url: link?.url ?? null,
            titel: text(n).replace(/^→\s*/, "").trim(),
            warum: warum.replace(/\s+/g, " ").trim(),
          });
        }
      }
    }

    /* ── Kopf-Elemente aus dem Fließtext ziehen ─────────────────────── */

    // Das <h1> doppelt den Titel — das Layout setzt ihn selbst
    if (tree.children[0]?.type === "heading" && tree.children[0].depth === 1) {
      tree.children.shift();
    }

    // `## Inhalt` ist reines Gerüst und benennt nichts — raus damit
    tree.children = tree.children.filter(
      (n) => !(n.type === "heading" && n.depth === 2 && text(n).trim().toLowerCase() === "inhalt"),
    );

    // Das Banner gehört in den Kopf, nicht in den Text
    for (let i = 0; i < Math.min(4, tree.children.length); i++) {
      const k = tree.children[i];
      const bild = k.type === "paragraph" && k.children?.length === 1 && k.children[0].type === "image"
        ? k.children[0] : (k.type === "image" ? k : null);
      if (bild && /banner/i.test(bild.url)) {
        fm.banner = bild.url;
        tree.children.splice(i, 1);
        break;
      }
    }

    fm.zeitstempel = [];
    visit(tree, (n) => {
      const t = n.data?.hProperties?.["data-t"];
      if (t && !fm.zeitstempel.includes(Number(t))) fm.zeitstempel.push(Number(t));
    });
    fm.fehlLinks = [...new Set(fehlLinks)];
  };
}
