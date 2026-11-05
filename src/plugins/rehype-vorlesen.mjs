/**
 * Was die Vorlesestimme hört.
 *
 * Wer die Seite nicht sieht, lässt sie sich vorlesen — und ein Screenreader
 * liest Zeichen für Zeichen, was für das Auge nur Beiwerk ist. Aus
 * „doi:10.1038/s41562-024-01841-8“ wird eine halbe Minute Ziffern, aus
 * „→ Faktencheck“ ein „Pfeil nach rechts“, aus „~40“ eine „Tilde 40“
 * (Andreas, 05.11.2026: „wenn dann komische sachen kommen, wird das tts
 * bissl merkwürdig“). Die Notes bleiben, wie sie sind; hier bekommt nur
 * die Stimme eine eigene Fassung: Das Zeichen wird für sie stumm
 * (`aria-hidden`), wo nötig spricht ein unsichtbares Wort an seiner
 * Stelle (`.vorlesen`). Für das Auge ändert sich nichts.
 *
 * Gezählt im Bestand am 05.11.2026: rund 1.140 Links, deren Text eine
 * nackte DOI ist, 170 DOIs ohne Link, gut 10.000 Pfeile, 5.000
 * Mittelpunkte, 850 Tilden.
 */

const AUSSEN_VOR = new Set(["code", "pre", "script", "style", "svg", "math", "kbd"]);

// Im Link: die DOI samt dem Trenner davor („Titel — doi:…“, „2024, DOI:…“).
const DOI_IM_LINK = /\s*[—–,;·]?\s*(?:doi:?\s*|https?:\/\/(?:dx\.)?doi\.org\/)?10\.\d{4,9}\/\S+/gi;
// Im Fließtext nur mit „DOI“ davor — eine nackte „10.1234/…“ könnte auch etwas anderes sein.
const DOI_IM_TEXT = /\bdoi:?\s*(10\.\d{4,9}\/[^\s<>"]+)/gi;
/* Der Mittelpunkt trennt Aufzählungen („Quelle · Transkript“): Die Stimme
   macht dort ein Komma. Der Verweispfeil — am Anfang, nach einer Klammer
   oder direkt vor einem Link — heißt „siehe“. Ein Pfeil mitten im Satz
   („Angst → Gehorsam“) bleibt ihr „Pfeil nach rechts“: Der sagt wenigstens
   die Richtung. Die Tilde vor einer Zahl ist ein „etwa“. 🎨 und ✒️ vor
   Maler- und Schreibhand sind Zier. */
const ZEICHEN = /( · )|(^\s*|\(\s*)→\s*|\s*→(\s*)$|~ ?(?=\d)|[\u{1F3A8}✒]️?/gu;

const stumm = (wert) => ({
  type: "element", tagName: "span",
  properties: { ariaHidden: "true" },
  children: [{ type: "text", value: wert }],
});
// Was nur die Stimme hört. Aus der Suche heraus, sonst stünde es in den Treffern.
const leise = (wert) => ({
  type: "element", tagName: "span",
  properties: { className: ["vorlesen"], dataPagefindIgnore: "" },
  children: [{ type: "text", value: wert }],
});
const text = (wert) => ({ type: "text", value: wert });

/** Ersetzt in einem Textknoten jeden Treffer durch die Knoten, die `aus` liefert. */
function zerlege(wert, muster, aus) {
  const teile = [];
  let rest = 0;
  for (const m of wert.matchAll(muster)) {
    const neu = aus(m);
    if (!neu) continue;
    if (m.index > rest) teile.push(text(wert.slice(rest, m.index)));
    teile.push(...neu.knoten);
    rest = m.index + (neu.laenge ?? m[0].length);
  }
  if (!teile.length) return null;
  if (rest < wert.length) teile.push(text(wert.slice(rest)));
  return teile;
}

/** Läuft durch alle Textknoten, ohne Code und ohne schon Stummes. */
function jederText(knoten, fn, imLink = false) {
  if (!knoten.children) return;
  for (let i = 0; i < knoten.children.length; i++) {
    const k = knoten.children[i];
    if (k.type === "text") {
      const neu = fn(k, i, knoten, imLink);
      if (neu) { knoten.children.splice(i, 1, ...neu); i += neu.length - 1; }
    } else if (k.type === "element") {
      if (AUSSEN_VOR.has(k.tagName) || k.properties?.ariaHidden === "true"
          || k.properties?.className?.includes?.("vorlesen")) continue;
      jederText(k, fn, imLink || k.tagName === "a");
    }
  }
}

/** Was von einem Knoten hörbar bleibt. */
function hoerbar(knoten) {
  if (knoten.type === "text") return knoten.value;
  if (knoten.properties?.ariaHidden === "true") return "";
  return (knoten.children ?? []).map(hoerbar).join("");
}

/* ── 1. DOIs in Links ──
   Die DOI bleibt sichtbar (man soll sie abschreiben können), die Stimme
   sagt nur „DOI“. Bestand der Link aus nichts als der Nummer, sagt sie,
   was dahinter liegt: eine Quelle. Die Adresse trägt die DOI ja weiter,
   für jeden, der ihr folgt. */
function doiInLinks(baum) {
  const links = [];
  (function sammle(k) {
    if (k.type !== "element" && k.type !== "root") return;
    if (k.tagName === "a") { links.push(k); return; }
    if (AUSSEN_VOR.has(k.tagName)) return;
    (k.children ?? []).forEach(sammle);
  })(baum);

  for (const a of links) {
    let getroffen = false;
    jederText(a, (t) => {
      const teile = zerlege(t.value, DOI_IM_LINK, (m) => ({ knoten: [stumm(m[0])] }));
      if (teile) getroffen = true;
      return teile;
    }, true);
    if (!getroffen) continue;
    const uebrig = hoerbar(a).replace(/[\s()[\]—–,;:.·*]/g, "");
    a.children.push(leise(uebrig ? " (DOI)" : "Quelle (DOI)"));
  }
}

/* ── 2. DOIs ohne Link ──
   170 Stellen nennen die DOI nur als Text. Sie werden zum Link — das hilft
   jedem, nicht nur der Stimme — und dann wie oben gesprochen. */
function doiOhneLink(baum) {
  jederText(baum, (t, i, eltern, imLink) => {
    if (imLink || !/doi/i.test(t.value)) return null;
    return zerlege(t.value, DOI_IM_TEXT, (m) => {
      // Satzzeichen am Ende gehören zum Satz, nicht zur DOI.
      let doi = m[1].replace(/[.,;:]+$/, "");
      while (doi.endsWith(")") && (doi.match(/\)/g).length > (doi.match(/\(/g) ?? []).length)) doi = doi.slice(0, -1);
      const ganz = m[0].slice(0, m[0].length - m[1].length) + doi;
      return {
        laenge: ganz.length,
        knoten: [{
          type: "element", tagName: "a",
          properties: { href: `https://doi.org/${doi}`, target: "_blank", rel: ["noopener"] },
          children: [stumm(ganz), leise("Quelle (DOI)")],
        }],
      };
    });
  });
}

/* ── 3. Zeichen im Fließtext ── */
function zeichen(baum) {
  jederText(baum, (t, i, eltern) => {
    const naechstes = eltern.children[i + 1];
    const vorLink = naechstes?.type === "element" && naechstes.tagName === "a";
    return zerlege(t.value, ZEICHEN, (m) => {
      if (m[1]) return { knoten: [stumm(" · "), leise(", ")] };
      if (m[2] !== undefined) return { knoten: [text(m[2]), stumm("→ "), leise("siehe ")] };
      if (m[3] !== undefined) {
        // Pfeil am Ende des Textstücks: vor einem Link ein Verweis, sonst
        // (etwa „Wie die Notes entstehen →“) nur Zier.
        return { knoten: [stumm(m[0]), ...(vorLink ? [leise(" siehe ")] : [])] };
      }
      if (m[0].startsWith("~")) return { knoten: [stumm(m[0]), leise("etwa ")] };
      return { knoten: [stumm(m[0])] };
    });
  });
}

/* ── 4. Rohes HTML ──
   Die Kästchen unter dem Banner (`<details><summary>🎨 …`) kommen als rohes
   HTML aus dem Markdown und laufen an den Textknoten vorbei. */
function rohesHtml(baum) {
  (function lauf(k) {
    if (k.type === "raw" && /<summary>/.test(k.value)) {
      k.value = k.value.replace(/(<summary>[^<]*?)([\u{1F3A8}✒]️?)/gu,
        '$1<span aria-hidden="true">$2</span>');
    }
    (k.children ?? []).forEach(lauf);
  })(baum);
}

export default function rehypeVorlesen() {
  return (baum) => {
    doiInLinks(baum);
    doiOhneLink(baum);
    zeichen(baum);
    rohesHtml(baum);
  };
}
