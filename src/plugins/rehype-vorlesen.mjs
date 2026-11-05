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
// Immer deutsch, auch mitten in einem englischen Titel.
const leise = (wert) => ({
  type: "element", tagName: "span",
  properties: { className: ["vorlesen"], dataPagefindIgnore: "", lang: "de" },
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

/* ── 5. Englisch als Englisch ──
   Eine deutsche Stimme liest „The Coming Race“ mit deutscher Aussprache,
   und ein ganzes englisches Zitat wird Kauderwelsch. Mit `lang="en"`
   wechselt der Screenreader die Stimme. Erkannt wird an den kleinen
   Wörtern, die jede Sprache ständig braucht: Wo englische deutlich
   überwiegen und es genug davon gibt, ist der Text englisch. Kurze
   Titel aus zwei, drei Wörtern bleiben deutsch gelesen, für sie reicht
   das Zeichen nicht. Gesetzt wird es am kleinsten Element, das ganz
   englisch ist: Absatz, Listenpunkt, Link, Kursives, oder ein Zitat in
   Anführungszeichen mitten im deutschen Satz. Steht auch nur ein deutsches
   Wort darin (ab dreißig Wörtern eines je dreißig), bleibt es deutsch. */
const EN = new Set(("the and of to is are was were that this with for on you we they it be not have has had "
  + "what who how why from by our your their will would can could do does did if or at but my me "
  + "there been which when about into than them these those its just more only out up all one").split(" "));
const DE = new Set(("der die das und ist nicht ein eine einen zu den von mit sich des auf für im dem es wir "
  + "ich sie er auch als wie dass aber oder war wird sind noch nur zum zur bei hat haben werden kann "
  + "über nach einer eines wenn doch schon sein ihre ihr uns laut keine kein neue neuen gegen durch unter "
  + "vor ohne seine seit bis weil sowie sondern diese dieser dieses beim vom jetzt heute wieder immer samt "
  + "zwei drei jahre jahren sagt zitiert quelle quellen siehe vortrag notiz transkript abbildung").split(" "));

function englisch(text) {
  const woerter = text.toLowerCase().match(/[a-zäöüß']+/g) ?? [];
  if (woerter.length < 4) return false;
  let en = 0, de = 0;
  // Ein Umlaut oder ß ist eine deutsche Spur, auch in einem Namen: Dann
  // entscheidet die feinere Ebene (der Titel im Link, das Kursive).
  for (const w of woerter) { if (EN.has(w)) en++; else if (DE.has(w) || /[äöüß]/.test(w)) de++; }
  // So gut wie kein deutsches Wort: Ein deutscher Satz mit englischem Zitat
  // („Er sagt: … und lacht“) bleibt deutsch, das Zitat darin wird erkannt.
  return en >= 2 && de <= Math.floor(woerter.length / 30) && en / woerter.length >= 0.12;
}

const BLOCK = new Set(["p", "li", "blockquote", "td", "th", "figcaption", "h2", "h3", "h4", "h5", "h6", "dd", "dt"]);
const INLINE = new Set(["a", "em", "i", "strong", "b", "q", "cite", "span"]);
// Ohne das, was nur die Stimme hört („Quelle (DOI)“ ist deutsch).
function sprechtext(k) {
  if (k.type === "text") return k.value;
  if (k.type !== "element" || k.properties?.className?.includes?.("vorlesen")) return "";
  return (k.children ?? []).map(sprechtext).join("");
}

function sprachen(baum) {
  (function lauf(k) {
    if (k.type !== "element" && k.type !== "root") return;
    if (k.type === "element") {
      if (AUSSEN_VOR.has(k.tagName) || k.properties?.lang) return;
      if ((BLOCK.has(k.tagName) || INLINE.has(k.tagName)) && englisch(sprechtext(k))) {
        (k.properties ??= {}).lang = "en";
        return;
      }
    }
    // Zitate in Anführungszeichen mitten im Satz
    for (let i = 0; i < (k.children?.length ?? 0); i++) {
      const t = k.children[i];
      if (t.type !== "text") continue;
      const teile = zerlege(t.value, /([„“"»])([^„“"»«]{12,}?)([“”"«])/g, (m) =>
        englisch(m[2]) ? { knoten: [text(m[1]), { type: "element", tagName: "span", properties: { lang: "en" }, children: [text(m[2])] }, text(m[3])] } : null);
      if (teile) { k.children.splice(i, 1, ...teile); i += teile.length - 1; }
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
    sprachen(baum);
  };
}
