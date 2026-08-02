/**
 * Der Faden — ein Weg durch den Bestand statt einer Liste.
 *
 * Das Problem der alten Startseite ist nicht ihr Aussehen, sondern ihre
 * Achse. Ein Raster nach Datum begräbt strukturell alles, was älter als
 * eine Woche ist: 748 Notes, davon 740 unerreichbar. Andreas' Wunsch —
 * *beiläufig über ältere Artikel stolpern* — ist in einem Datumsraster
 * gar nicht erfüllbar. Über einen Artikel stolpert man nicht, weil er
 * neu ist, sondern weil etwas anderes zu ihm führt.
 *
 * Also führt die Startseite. Sie beginnt bei etwas Frischem — Neuheit
 * zählt schon, sie ist nur nicht die Achse — und geht dann Schritt für
 * Schritt an echten Verbindungen entlang immer tiefer ins Archiv. Jeder
 * Schritt sagt, warum er gemacht wird. Nach sieben Stationen ist man im
 * April, ohne einmal gesucht zu haben.
 *
 * Drei Dinge hat der Stern dafür beigebracht:
 *   1. Die Ordnung muss gesetzt werden, das Verfahren darf sie nur füllen.
 *   2. Der Titel ist die Fläche — 600 der 748 Notes haben keinen Teaser,
 *      die Seite muss aus Titeln und Verbindungen bestehen können.
 *   3. Das Seltene braucht einen reservierten Platz, kein besseres
 *      Ranking. Hier: Die gestrichelte Kante gewinnt jeden Schritt, an
 *      dem sie überhaupt zur Wahl steht.
 */
import { ladeGraph } from "./graph.mjs";
import { ladeIndex } from "./notizen.mjs";

const MONAT = 30.44 * 24 * 3600 * 1000;
const alter = (a, b) => (a && b ? (Date.parse(a) - Date.parse(b)) / MONAT : 0);

/** Wieviel ein Schritt von A nach B wert ist. */
function bewerte(a, b, kante, lage) {
  let s = 0;

  // 1. Die Art der Verbindung. Die geteilte Quelle steht obenan — sie ist
  //    das Einzige auf dieser Seite, das noch niemand gesehen hat.
  if (kante.art === "quelle") s += 3;
  else if (kante.richtung === "beide") s += 1.6;
  else s += 1.2;

  // 2. Ein geschriebener Grund schlägt einen erzeugten. „Der theoretische
  //    Unterbau zur Doku …" ist eine Einladung; „verweisen aufeinander"
  //    ist eine Auskunft.
  if (kante.satz) s += 2.4;

  // 3. Naben meiden.
  //    Mausfeld, Fromm, Rosa hängen an achtzig Notes. Genau darum sagt
  //    ein Schritt zu ihnen nichts: Wer neben allem steht, steht neben
  //    nichts im Besonderen. Ohne diese Bremse endet jeder Weg nach zwei
  //    Schritten bei denselben drei Notes — dieselbe Logik, mit der schon
  //    die geteilte Quelle nach Seltenheit gewichtet wird.
  s -= Math.max(0, Math.log2((lage.grad(b.id) || 1) / 8)) * .8;

  // 4. Rubrikwechsel — der Faden soll durch den Bestand wandern, nicht
  //    ein Regal hinunter.
  if (a.rubrik !== b.rubrik) s += .6;

  // 5. Eine Vita ist ein Steckbrief, kein Gedanke: als Station taugt sie
  //    einmal, als Kette nicht. (Und sie hat nie einen Teaser.)
  if (b.rubrik === "DenkerVita") s -= lage.schonVita ? 6 : 1.4;

  // 6. Wo ein Teaser steht, liest sich die Station besser.
  if (b.beschreibung) s += .45;

  // 7. Ein Nachbar, der selbst einen Fund trägt, ist ein guter nächster
  //    Standort — auch wenn dieser Schritt noch keiner ist.
  if (lage.hatFund(b.id)) s += .5;

  // 8. Nicht bei einer Stimme hängenbleiben. Wer vier Notes im Bestand
  //    hat, zieht den Faden sonst in seine eigene Ecke und der Weg endet
  //    als Werkschau statt als Wanderung.
  if (lage.stimmen.has(stimme(b.titel))) s -= 1.4;

  return s;
}

/** „Markus Gabriel — Ethischer Kapitalismus" → „markus gabriel". */
function stimme(titel) {
  return (/^(.{2,42}?)\s+[—–]\s+/.exec(titel)?.[1] ?? titel).toLowerCase();
}

/**
 * Vom Absatz zum Anreißer.
 *
 * Die Begründungen im Bestand sind gründlich — vierhundert Zeichen sind
 * keine Seltenheit, und für eine Note ist das genau richtig. Zwischen zwei
 * Stationen einer Startseite steht aber kein Aufsatz, sondern ein Wink.
 * Fast alle diese Absätze setzen ihre These in den ersten Satz („Derselbe
 * Mechanismus in zwei Rechtsordnungen, und die Spiegelung ist das
 * Aufschlussreiche."); den nehmen wir, den zweiten nur, wenn der erste
 * sehr kurz ausfiel.
 */
function anreisser(text, grenze = 215) {
  const saetze = text.match(/[^.!?]+[.!?]+(?:["»“]?)/g) ?? [text];
  let s = saetze[0].trim();
  if (s.length < 90 && saetze[1]) s += " " + saetze[1].trim();
  if (s.length > grenze) s = s.slice(0, grenze - 1).replace(/[\s,;:—-]+\S*$/, "") + " …";
  return s;
}

/** Warum dieser Schritt — der Satz, der unter der Linie steht. */
function begruendung(kante) {
  if (kante.satz) return { wie: anreisser(kante.satz), satz: true, fund: kante.art === "quelle" };
  if (kante.art === "quelle") {
    const q = kante.quellen?.[0];
    return { wie: q ? `beide berufen sich auf ${q.titel}` : "dieselbe Quelle", fund: true };
  }
  if (kante.richtung === "beide") return { wie: "verweisen aufeinander" };
  if (kante.richtung === "hin")   return { wie: "diese Note verweist dorthin" };
  return { wie: "von dort führt ein Verweis hierher" };
}

/**
 * Ein Faden ab einer Startnote.
 * @param {string} start   Note-Kennung
 * @param {number} laenge  Zahl der Stationen
 */
export function spinne(start, laenge = 7) {
  const g = ladeGraph();
  const idx = ladeIndex();
  const nach = new Map(idx.alle.map((n) => [n.id, n]));

  const stationen = [];
  const benutzt = new Set();
  let hier = nach.get(start);
  let grund = null;

  while (hier && stationen.length < laenge) {
    benutzt.add(hier.id);
    stationen.push({
      id: hier.id,
      url: hier.url,
      titel: hier.titel,
      rubrik: hier.rubrik,
      datum: hier.datum,
      banner: hier.vorschau,
      teaser: hier.beschreibung,
      grund,
    });

    // Die Nachbarn dieser Station, mit der Kante, über die man hinkäme
    const stern = g.katalog.has(hier.id) ? null : nachbarnVon(g, hier.id);
    if (!stern) break;

    const lage = {
      // Zwei Steckbriefe hintereinander sind kein Weg mehr, sondern ein
      // Register. Nach einer Vita geht es zurück in den Text.
      vitaVerboten: hier.rubrik === "DenkerVita",
      schonVita: stationen.some((s) => s.rubrik === "DenkerVita"),
      stimmen: new Set(stationen.map((s) => stimme(s.titel))),
      grad: (id) => (g.hinaus.get(id)?.size ?? 0) + (g.herein.get(id)?.size ?? 0),
      hatFund: (id) => (g.quellNachbarn.get(id)?.size ?? 0) > 0,
    };

    /* Der reservierte Platz.
       Zuerst hatte auch dieser Schritt nur eine höhere Punktzahl für den
       Fund — und in neun Fäden kam kein einziger vor. Kein Wunder: Eine
       ungezogene Verbindung hat per Definition keinen geschriebenen Grund,
       und der wiegt hier zu Recht schwer. Wer selten ist, gewinnt kein
       Rennen nach Punkten. Also bekommt er kein besseres Ranking, sondern
       einen eigenen Durchgang: Steht an dieser Station ein Fund zur Wahl,
       wird er gegangen. Bei 62 Funden im ganzen Bestand passiert das
       höchstens ein-, zweimal je Weg — selten genug, dass es zählt. */
    let bester = null, bestwert = -Infinity;
    const gibtFund = [...stern].some(([nid, k]) =>
      k.art === "quelle" && !benutzt.has(nid) && !g.katalog.has(nid)
      && nach.get(nid)?.datum <= hier.datum);

    for (const [nid, kante] of stern) {
      if (gibtFund && kante.art !== "quelle") continue;
      if (benutzt.has(nid) || g.katalog.has(nid)) continue;
      const kandidat = nach.get(nid);
      if (!kandidat) continue;

      /* Der Faden läuft rückwärts durch die Zeit — das ist sein Zweck.
         Als weicher Bonus taugt das nicht: Die ältesten Notes sind
         zugleich die am dichtesten verlinkten, der Weg schlug bei jedem
         Versuch sofort in den März und von dort wieder nach vorn. Also
         eine harte Schranke. Wo sie in eine Sackgasse führt, endet der
         Faden lieber früher, als vorzugeben, er ginge weiter. */
      if (kandidat.datum && hier.datum && kandidat.datum > hier.datum) continue;
      if (lage.vitaVerboten && kandidat.rubrik === "DenkerVita") continue;

      const w = bewerte(hier, kandidat, kante, lage);
      if (w > bestwert) { bestwert = w; bester = { kandidat, kante }; }
    }
    if (!bester) break;

    grund = begruendung(bester.kante);
    hier = bester.kandidat;
  }

  return stationen;
}

/** Nachbarn einer Note als Map id → Kantenbeschreibung. */
function nachbarnVon(g, id) {
  const m = new Map();
  for (const n of g.hinaus.get(id) ?? []) m.set(n, { art: "wikilink", richtung: "hin" });
  for (const n of g.herein.get(id) ?? []) {
    const alt = m.get(n);
    m.set(n, { art: "wikilink", richtung: alt ? "beide" : "her" });
  }
  for (const [n, qs] of g.quellNachbarn.get(id) ?? []) {
    // Eine geteilte Quelle ist nur dann ein Fund, wenn niemand die
    // Verbindung schon gezogen hat. Sonst bestätigt sie nur Bekanntes.
    if (!m.has(n)) m.set(n, { art: "quelle", quellen: qs });
  }
  // Wo einer der beiden den Grund aufgeschrieben hat, hängt er an die
  // Kante. Der Satz aus dieser Note zuerst — er ist aus der Richtung
  // geschrieben, aus der man kommt.
  for (const [n, kante] of m) {
    kante.satz = g.begruendung.get(`${id}\u0000${n}`) ?? g.begruendung.get(`${n}\u0000${id}`) ?? null;
  }
  return m;
}

/**
 * Sieben Fäden, sieben Türen.
 *
 * Als Startpunkte nicht die sieben jüngsten Notes — die stammen im Zweifel
 * alle aus derselben Sitzung und liefen dann dreimal denselben Weg. Statt
 * dessen die jüngste Note **je Rubrik**: Wer die Seite noch einmal
 * anstößt, betritt den Bestand durch eine andere Tür.
 */
export function alleFaeden(laenge = 7) {
  const idx = ladeIndex();
  const g = ladeGraph();

  const juengste = new Map();
  for (const n of idx.alle) {
    if (!n.datum || g.katalog.has(n.id)) continue;
    // Vitas sind zeitlos und taugen nicht als Auftakt
    if (n.rubrik === "DenkerVita") continue;
    const bisher = juengste.get(n.rubrik);
    if (!bisher || n.datum > bisher.datum) juengste.set(n.rubrik, n);
  }

  return [...juengste.values()]
    .sort((a, b) => (a.datum < b.datum ? 1 : -1))
    .map((n) => spinne(n.id, laenge))
    .filter((f) => f.length >= 3);
}
