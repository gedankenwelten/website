/**
 * Der Notiz-Index — die Voraussetzung dafür, dass Wikilinks auflösen.
 *
 * Quartz löst [[Bare Name]] über den Dateinamen auf, quer durch den ganzen
 * Vault. Damit dieselben Links hier ankommen, brauchen wir dieselbe Kenntnis:
 * ein Verzeichnis aller Notes, adressierbar nach Dateiname, nach
 * Rubrik/Dateiname und nach Alias.
 */
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { slugify, noteUrl } from "./slug.mjs";
import { datumVon } from "./datum.mjs";

export const INHALT = path.join(
  process.env.HOME,
  "Gedankenwelten",
  "content",
);

export const RUBRIKEN = [
  "Zeitgeist", "Denker", "DenkerVita", "Geistesblitz",
  "Kultur", "Panorama", "Gedanken", "Spuren", "GoodNews", "Vipassana",
];

let index = null;

/* Welche Banner schon eine verkleinerte Fassung haben. Einmal einlesen —
   sonst 748 Dateisystem-Abfragen für eine Frage, die ein Verzeichnis
   beantwortet. Fehlt das Verzeichnis (noch nie `vorschau.mjs` gelaufen),
   greift überall das Original: langsamer, aber nicht kaputt. */
let vorschauen = null;
function hatVorschau(datei) {
  if (!vorschauen) {
    const ordner = path.join(import.meta.dirname, "..", "..", "public", "vorschau");
    vorschauen = new Set(fs.existsSync(ordner) ? fs.readdirSync(ordner) : []);
  }
  return vorschauen.has(datei.replace(/\.[^.]+$/, "") + ".webp");
}

export function ladeIndex() {
  if (index) return index;

  const alle = [];
  for (const rubrik of RUBRIKEN) {
    const ordner = path.join(INHALT, rubrik);
    if (!fs.existsSync(ordner)) continue;
    for (const datei of fs.readdirSync(ordner)) {
      if (!datei.endsWith(".md")) continue;
      const voll = path.join(ordner, datei);
      const basis = datei.replace(/\.md$/, "").normalize("NFC");
      let fm = {};
      let rumpf = "";
      try {
        const zerlegt = matter(fs.readFileSync(voll, "utf8"));
        fm = zerlegt.data ?? {};
        rumpf = zerlegt.content ?? "";
      } catch { /* kaputtes Frontmatter darf den Build nicht kippen */ }

      // Die rohen Wikilink-Ziele, noch unaufgelöst: Auflösen kann erst, wer
      // schon alle Notes kennt — und die kennen wir hier gerade erst. Der
      // Rumpf selbst wird nicht behalten, 748 Volltexte im Speicher wären
      // teuer bezahlt für eine Liste von Zielen.
      const ziele = [...new Set(
        [...rumpf.matchAll(/(!?)\[\[([^\]|\n]+)(?:\|[^\]\n]*)?\]\]/g)]
          .filter((m) => m[1] !== "!")          // Einbettungen sind Bilder, keine Verweise
          .map((m) => m[2].trim()),
      )];

      /* Das Banner. 515 der 748 Notes tragen eins — bei Denker (107/108)
         und DenkerVita (261/263) fast lückenlos, bei Zeitgeist nur zu
         einem Drittel. Es steht als Einbettung im Text; die Note-Seite
         zieht es beim Rendern in den Kopf, die Startseite braucht es
         schon hier. */
      const bannerEmbed = /!\[\[([^\]|\n]*banner[^\]|\n]*?)(?:\|[^\]\n]*)?\]\]/i.exec(rumpf);
      const bannerDatei = bannerEmbed ? bannerEmbed[1].split("/").pop().trim() : null;
      const banner = bannerDatei ? `/assets/${encodeURIComponent(bannerDatei)}` : null;
      // Für Streifen und Kacheln reicht die verkleinerte Fassung —
      // `scripts/vorschau.mjs` legt sie an, neunzig Prozent leichter.
      const vorschau = bannerDatei && hatVorschau(bannerDatei)
        ? `/vorschau/${encodeURIComponent(bannerDatei.replace(/\.[^.]+$/, ""))}.webp`
        : banner;

      /* Der `## Verbindungen`-Abschnitt trägt zu jedem Ziel einen Satz,
         warum es dazugehört — 4.234 solcher Sätze stehen im Bestand, von
         Hand oder von Montaigne geschrieben. Das ist die beste
         Begründung, die eine Verbindung haben kann: eine, die schon
         jemand formuliert hat. Wir müssen sie nur heben. */
      const begruendet = [];
      /* `(?![\s\S])` und nicht `\Z`: Javascript kennt diesen Anker nicht
         und liest ihn als das Zeichen „Z". Der Abschnitt endete damit am
         ersten großen Z im Text — „…an Du Bois als Zündfunken" wurde zu
         „…an Du Bois als". Von 4.234 Begründungen im Bestand kamen so
         759 an, alle angeschnitten. */
      const abschnitt = /^## Verbindungen\s*$([\s\S]*?)(?=^## |(?![\s\S]))/m.exec(rumpf);
      if (abschnitt) {
        // Der Absatz geht bis zur Leerzeile — nicht bis zum Zeilenende.
        // Diese Begründungen sind oft mehrere Zeilen lang, und wer nur die
        // erste nimmt, schneidet mitten im Satz ab.
        for (const m of abschnitt[1].matchAll(/^###\s*(?:→\s*)?(.+?)[ \t]*$\n+([^\n#>|][^\n]*(?:\n[^\n#>][^\n]*)*)/gm)) {
          const ziel = m[1].replace(/\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g, "$1")
                           .replace(/[*_`]/g, "").trim();
          const warum = m[2].replace(/\[\[([^\]|]+)(?:\|([^\]]*))?\]\]/g, (_, z, a) => a || z)
                            .replace(/[*_`]/g, "").replace(/\s+/g, " ").trim();
          /* Mindestens ein halber Satz. Manche Einträge tragen dort nur
             ein Etikett — „erster Beitrag in der Gedanken-Sektion" —, und
             als Begründung für einen Schritt gelesen behauptet das etwas,
             was es gar nicht sagt. Lieber der schlichte Hinweis, dass ein
             Verweis existiert, als ein Satz, der keiner ist. */
          if (ziel && warum.length >= 60) begruendet.push({ ziel, warum: warum.slice(0, 1200) });
        }
      }

      alle.push({
        id: `${rubrik}/${basis}`,   // wie im Content-Store
        rubrik,
        basis,
        datei,
        pfad: voll,
        slug: slugify(basis),
        url: noteUrl(rubrik, basis),
        titel: fm.title ?? basis,
        beschreibung: fm.description ?? null,
        datum: datumVon(fm, basis),
        banner,
        vorschau,
        tags: [].concat(fm.tags ?? []).filter(Boolean).map(String),
        aliase: [].concat(fm.aliases ?? []).filter(Boolean),
        ziele,
        begruendet,
      });
    }
  }

  // Nachschlagewerke. Kollisionen bei bloßem Dateinamen sind möglich —
  // dann gewinnt der erste Fund, aber wir merken uns die Dopplung.
  const nachBasis = new Map();
  const nachRubrikBasis = new Map();
  const nachAlias = new Map();
  const kollisionen = [];

  for (const n of alle) {
    const k = n.basis.toLowerCase();
    if (nachBasis.has(k)) kollisionen.push(n.basis);
    else nachBasis.set(k, n);

    nachRubrikBasis.set(`${n.rubrik}/${n.basis}`.toLowerCase(), n);
    for (const a of n.aliase) {
      const ak = String(a).toLowerCase();
      if (!nachAlias.has(ak)) nachAlias.set(ak, n);
    }
  }

  index = { alle, nachBasis, nachRubrikBasis, nachAlias, kollisionen };
  return index;
}

/**
 * Wikilink-Ziel → Note. Verträgt alle Schreibweisen, die im Bestand
 * vorkommen: mit und ohne `Gedankenwelten/`-Präfix, mit und ohne Rubrik,
 * mit Anker, über einen Alias.
 */
export function findeNote(ziel) {
  const idx = ladeIndex();
  let z = String(ziel).trim().normalize("NFC");
  z = z.split("#")[0].trim();
  z = z.replace(/^\.?\//, "").replace(/^Gedankenwelten\//i, "");
  if (!z) return null;

  const treffer =
    idx.nachRubrikBasis.get(z.toLowerCase()) ??
    idx.nachBasis.get(z.toLowerCase()) ??
    idx.nachBasis.get(z.split("/").pop().toLowerCase()) ??
    idx.nachAlias.get(z.toLowerCase()) ??
    null;

  return treffer;
}
