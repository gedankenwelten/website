/**
 * Die Rubriken — was jede ist, und wie ihr Bestand geordnet gehört.
 *
 * Die Regale auf der Startseite zeigen drei Titel, dahinter ging es
 * bisher nicht weiter. Diese Datei ist das „dahinter": zu jeder Rubrik
 * ein Satz, der sagt, worauf man sich einlässt, und eine Ordnung, die zu
 * ihrem Inhalt passt.
 *
 * Denn eine Ordnung für alle zehn gibt es nicht. Zeitgeist ist ein
 * Verlauf — dort ist die Zeit die Achse, und ein Monatsband sagt etwas.
 * DenkerVita ist ein Register von 263 Menschen; dass Adam Tooze im Mai
 * geschrieben wurde, sagt über ihn nichts. Wer eine Person sucht, sucht
 * einen Buchstaben.
 */
import { ladeIndex } from "./notizen.mjs";
import { ladeGraph } from "./graph.mjs";

/**
 * Die Sätze stammen aus den Regeln des Hauses (`rules/gedankenwelten.md`),
 * hier aber nicht als Definition, sondern als Einladung: Sie stehen unter
 * der Überschrift und sagen einem Ankommenden, was ihn erwartet.
 */
export const RUBRIKEN_INFO = {
  Zeitgeist: {
    ordnung: "zeit",
    satz: "Der Geist der Zeit: Interviews, Vorträge, Gespräche über das, was gerade geschieht — quer durch die Spektren, jede Behauptung gegengelesen.",
  },
  Denker: {
    ordnung: "zeit",
    satz: "Eine Stimme in der Tiefe. Nicht was jemand gesagt hat, sondern wie jemand denkt — mit den eigenen Begriffen und den eigenen Brüchen.",
  },
  DenkerVita: {
    ordnung: "abc",
    satz: "Das Fenster zum Menschen hinter dem Werk: Herkunft, Bücher, Kernthesen, politische Einordnung. Ein Register, kein Weg.",
  },
  Geistesblitz: {
    ordnung: "zeit",
    satz: "Grundsätzliches Wissen und menschliche Schöpferkraft — Wissenschaft, Philosophie, Psychologie, Technik. Was das Jahr überdauert.",
  },
  Kultur: {
    ordnung: "zeit",
    satz: "Land und Leute von innen: gelebter Alltag, Begegnung, das Fremde, wie man es selten zu sehen bekommt. Erzählt, nicht analysiert.",
  },
  Panorama: {
    ordnung: "zeit",
    satz: "Der Blick über viele Fälle. Was in mehreren Notes aus verschiedenen Winkeln auftaucht, hier einmal nebeneinandergelegt.",
  },
  Gedanken: {
    ordnung: "zeit",
    satz: "Eigenes Nachdenken. Kein Referat einer fremden Position, sondern der Versuch, selbst zu Ende zu denken — mit allem Vorläufigen.",
  },
  Spuren: {
    ordnung: "zeit",
    satz: "Lebende Thesen: ein Phänomen über die Zeit verfolgt, jede mit der Bedingung versehen, unter der sie sich widerlegt. Die einzige Rubrik, die weiterwächst.",
  },
  GoodNews: {
    ordnung: "zeit",
    satz: "Was gelingt. Nicht als Trost gegen den Rest, sondern weil ein Bild ohne das Gelingende genauso schief ist wie eines ohne den Schaden.",
  },
  Vipassana: {
    ordnung: "zeit",
    satz: "Die Praxis: Übung, Begriffe und Lehre der Einsichtsmeditation — aus der Erfahrung geschrieben, nicht über sie.",
  },
};

/* Tags, die als Thema nichts austragen: das Jahr ist keine Frage an den
   Bestand, und der Autor ist bei Gedanken und Panorama fast immer
   derselbe. */
const STUMME_TAGS = new Set(["luc", "claude", "meta", "index"]);

/* Der Typ-Tag der eigenen Rubrik — er steht an jeder ihrer Notes und
   trennt darum nichts. Nur dort stumm, nicht überall: `vipassana` ist in
   der Rubrik Vipassana eine Selbstverständlichkeit und unter den Gedanken
   ein Thema. */
const EIGENER_TAG = {
  Zeitgeist: ["zeitgeist"],
  Denker: ["denker"],
  DenkerVita: ["denker-vita"],
  Geistesblitz: ["geistesblitz"],
  Kultur: ["kultur"],
  Panorama: ["panorama"],
  Gedanken: ["gedanke", "gedanken"],
  Spuren: ["spur", "spuren"],
  GoodNews: ["goodnews"],
  Vipassana: ["vipassana"],
};

/** Der Titel ohne das, was die Rubrik schon sagt. */
export function knapperTitel(titel, rubrik) {
  let t = titel;
  if (rubrik === "DenkerVita") t = t.replace(/\s*[—–-]\s*DenkerVita\s*$/i, "");
  if (rubrik === "Vipassana") t = t.replace(/^Vipassana\s*[—–-]\s*/i, "");
  if (rubrik === "GoodNews") t = t.replace(/^Good\s*News\s*[—–-]\s*/i, "");
  return t.trim() || titel;
}

/**
 * Nach welchem Wort ein Name im Register steht.
 *
 * Das letzte Wort — bei „Adriaan van Wagensveld" also Wagensveld, wie es
 * ein gedrucktes Register auch hielte. Die acht mehrteiligen Namen im
 * Bestand tragen alle ein kleingeschriebenes „van"/„von", und die stehen
 * überall unter dem Wort danach.
 */
export function registerWort(name) {
  const teile = name.trim().split(/\s+/);
  return teile[teile.length - 1] ?? name;
}

const MONATE = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli",
                "August", "September", "Oktober", "November", "Dezember"];
export const monatJahr = (d) => {
  const [j, m] = String(d).split("-");
  return `${MONATE[Number(m) - 1]} ${j}`;
};
export const langDatum = (d) => {
  if (!d) return null;
  const [j, m, t] = String(d).split("-");
  return `${Number(t)}. ${MONATE[Number(m) - 1]} ${j}`;
};

/** Alle Notes einer Rubrik — ohne die Kataloge und die alten Quartz-Deckblätter. */
export function notesDerRubrik(rubrik) {
  const g = ladeGraph();
  return ladeIndex().alle.filter(
    (n) => n.rubrik === rubrik && !g.katalog.has(n.id) && n.basis.toLowerCase() !== "index",
  );
}

/**
 * Der Bestand einer Rubrik, fertig zum Auslegen: sortiert, in Bänder
 * geteilt, mit den Themen, nach denen sich filtern lässt.
 */
export function rubrikBestand(rubrik) {
  const info = RUBRIKEN_INFO[rubrik] ?? { ordnung: "zeit", satz: "" };
  const notes = notesDerRubrik(rubrik);

  /* ── Themen ──
     Ein Tag taugt als Zugang nur, wenn er trennt. Was fast an jeder Note
     steht, sagt nichts über die einzelne; was an einer einzigen steht,
     ist kein Zugang, sondern ein Etikett. Dazwischen liegt das Brauchbare. */
  const eigene = new Set(EIGENER_TAG[rubrik] ?? []);
  const zaehlung = new Map();
  for (const n of notes) {
    for (const t of new Set(n.tags)) {
      if (STUMME_TAGS.has(t) || eigene.has(t) || /^year-\d{4}$/.test(t)) continue;
      zaehlung.set(t, (zaehlung.get(t) ?? 0) + 1);
    }
  }
  const decke = Math.max(2, Math.ceil(notes.length * 0.7));
  const mindestens = notes.length > 60 ? 4 : 2;
  const themen = [...zaehlung]
    .filter(([, c]) => c >= mindestens && c <= decke)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "de"))
    .slice(0, 26)
    .map(([name, anzahl]) => ({ name, anzahl }));

  /* ── Ordnung ── */
  const posten = notes.map((n) => ({
    id: n.id,
    url: n.url,
    titel: knapperTitel(n.titel, rubrik),
    datum: n.datum,
    teaser: n.beschreibung,
    bild: n.vorschau,
    themen: n.tags.filter((t) => zaehlung.has(t)),
  }));

  let baender;
  if (info.ordnung === "abc") {
    posten.sort((a, b) =>
      registerWort(a.titel).localeCompare(registerWort(b.titel), "de", { sensitivity: "base" }));
    baender = bündeln(posten, (p) => {
      /* Ohne Zerlegung stünde Šarčević in einem eigenen Band neben dem
         großen S — die Sortierung legt ihn richtig hin, die Marke risse
         ihn wieder heraus. Ein Register kennt kein Fach Š, und Ö steht
         unter O. */
      const b = registerWort(p.titel).normalize("NFD").replace(/\p{M}/gu, "")[0]?.toUpperCase() ?? "?";
      return /\p{L}/u.test(b) ? b : "#";
    });
  } else {
    posten.sort((a, b) => String(b.datum).localeCompare(String(a.datum)));
    baender = bündeln(posten, (p) => (p.datum ? p.datum.slice(0, 7) : "ohne"));
    for (const b of baender) b.marke = b.schluessel === "ohne" ? "ohne Datum" : monatJahr(b.schluessel + "-01");
  }

  const datiert = posten.map((p) => p.datum).filter(Boolean).sort();

  return {
    rubrik,
    ...info,
    posten,
    baender,
    themen,
    anzahl: posten.length,
    von: datiert[0] ?? null,
    bis: datiert[datiert.length - 1] ?? null,
  };
}

/* Der Bestand wird für jede der 748 Notes einmal gebraucht (die Marken
   unter dem Text fragen, welche davon in ihrer Rubrik überhaupt etwas
   filtern) — gerechnet wird er zehnmal. */
const gemerkt = new Map();
export function bestandVon(rubrik) {
  if (!gemerkt.has(rubrik)) gemerkt.set(rubrik, rubrikBestand(rubrik));
  return gemerkt.get(rubrik);
}

/**
 * Welche Marken einer Note in ihrer Rubrik als Filter taugen.
 *
 * Nicht jede: `zeitgeist` steht an allen 276, `year-2026` an fast allen,
 * `luc` an jedem eigenen Gedanken. Ein Link darauf führte zu einer Liste,
 * die entweder alles zeigt oder nichts — beides eine Enttäuschung, die
 * man dem Klick nicht ansieht.
 */
export function filterbareThemen(rubrik) {
  const b = bestandVon(rubrik);
  const alle = new Set();
  for (const p of b.posten) for (const t of p.themen) alle.add(t);
  return alle;
}

function bündeln(posten, schluesselVon) {
  const baender = [];
  for (const p of posten) {
    const k = schluesselVon(p);
    const letztes = baender[baender.length - 1];
    if (letztes && letztes.schluessel === k) letztes.posten.push(p);
    else baender.push({ schluessel: k, marke: k, posten: [p] });
  }
  return baender;
}

/** Für den Fuß jeder Rubrikseite: wohin es von hier aus weitergeht. */
export function alleRubriken() {
  return Object.keys(RUBRIKEN_INFO)
    .map((r) => ({ name: r, anzahl: notesDerRubrik(r).length }))
    .filter((r) => r.anzahl > 0);
}
