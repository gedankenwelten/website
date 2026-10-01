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

/* Der Markdown-Pool. Auf dem Mac liegt er unter ~/Gedankenwelten/content,
   auf dem Pi unter ~/services/gedankenwelten/content — `GW_INHALT` sagt
   es, wenn es woanders ist. */
/* Ein Auszug für Karten, wenn `description:` fehlt (327 ältere Notes,
   Stand 09/2026): der „Worum es geht"-Callout, sonst der erste Absatz
   Prosa — keine Überschrift, kein Callout, kein Bild, keine Quelle-Zeile,
   nichts aus <details>. Gekürzt am Satzende. Kein Ersatz für die
   Beschreibung: Die trägt ein Urteil, der Auszug nur den Anfang. */
export function auszugVon(rumpf, max = 240) {
  let ohneDetails = String(rumpf ?? "").replace(/<details>[\s\S]*?<\/details>/g, "");
  // Eine Vita beginnt oft mit Kauflinks oder der politischen Einordnung;
  // der Mensch steht im Biografie-Abschnitt. Gibt es ihn, dort anfangen.
  const bio = /^#{2,3}\s+[^\n]*(Biogra|Wer spricht|Snapshot)[^\n]*$/m.exec(ohneDetails);
  if (bio && !/^>\s*\[!abstract\]/m.test(ohneDetails)) ohneDetails = ohneDetails.slice(bio.index);
  // Der Aufmacher einer Note, bei Vitas das „Wer spricht?" — beides ist
  // schon der Satz, den man über die Seite sagen würde.
  const abstract = /^>\s*\[!abstract\][^\n]*\n((?:>[^\n]*\n?)+)/m.exec(ohneDetails)
    ?? /^>\s*\[!info\][-+]?\s*Wer spricht[^\n]*\n((?:>[^\n]*\n?)+)/m.exec(ohneDetails);
  let text = abstract ? abstract[1].replace(/^>[ \t]?/gm, "") : null;
  if (!text) {
    for (const block of ohneDetails.split(/\n[ \t]*\n/)) {
      const z = block.trim();
      if (!z || /^(#|>|!\[|---|\||<|\*?\(|Quelle:|Gesprächspartner|\*Prompt|→|-\s|\d+\.\s)/.test(z)) continue;
      // Ein Steckbrief ist kein Anfang: „**Geburt:** 1945 in Teheran",
      // „Datum: 13.02.2026" — Zeile für Zeile Etikett und Wert. 33 Notes
      // zeigten so ihre Kopfdaten statt eines Satzes (26.09.2026).
      const zeilen = z.split("\n");
      // Ebenso ein Etikett mit Liste darunter: „Wendepunkte:", „Quellen:".
      if (/:\**$/.test(zeilen[0].trim()) && zeilen.length > 1) continue;
      if (zeilen.filter((l) => /^\**[A-ZÄÖÜ][^:\n]{0,30}:\**\s/.test(l.trim())).length * 2 >= zeilen.length) continue;
      text = z; break;
    }
  }
  if (!text) return null;
  const rein = text
    .replace(/\[▶[^\]]*\]\([^)]*\)\s*[—–-]?\s*/g, "")
    .replace(/!\[\[[^\]]*\]\]/g, "")
    .replace(/\[\[([^\]|]+)(?:\|([^\]]*))?\]\]/g, (_, a, b) => b || a)
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_`]/g, "").replace(/\s+/g, " ").trim();
  if (!rein) return null;
  if (rein.length <= max) return rein;
  const schnitt = rein.slice(0, max);
  // Satzende, nicht Abkürzung: „seit ca. 2017" ist keins, „1977." meist auch nicht.
  let ende = -1;
  for (const m of schnitt.matchAll(/[.!?](?=\s+[A-ZÄÖÜ„"»(])/g)) {
    const davor = schnitt.slice(Math.max(0, m.index - 6), m.index);
    if (m[0] === "." && /(\b(ca|bzw|vgl|etc|ggf|geb|Dr|Prof|St|Nr|Jh|Mio|Mrd)|\b[a-zA-Z]\.[a-zA-Z]|\d)$/.test(davor)) continue;
    ende = m.index;
  }
  return ende > max / 3 ? schnitt.slice(0, ende + 1) : schnitt.slice(0, schnitt.lastIndexOf(" ")) + " …";
}

export const INHALT = process.env.GW_INHALT || path.join(
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
    // Vom Projektstamm aus, nicht von `import.meta.dirname`: beim Prerender
    // bündelt Astro dieses Modul nach `.astro/.prerender/chunks/`, und von
    // dort zeigte `../../public` ins Leere — kein einziges Banner bekam je
    // seine Vorschau, still (13.09.2026).
    const ordner = path.join(process.cwd(), "public", "vorschau");
    vorschauen = new Set(fs.existsSync(ordner) ? fs.readdirSync(ordner) : []);
  }
  return vorschauen.has(datei.replace(/\.[^.]+$/, "") + ".webp");
}

/**
 * Das Bild der Rubrik — für Notes, die kein eigenes Banner haben.
 *
 * Bei Zeitgeist sind das 191 von 276. Eine leere Fläche ist ehrlich,
 * aber auf einem Weg, der von Bildern lebt, sieht sie aus wie ein
 * Fehler. Der Bestand hat für jede Rubrik längst eins liegen (aus der
 * Quartz-Fassung, 640 × 360) — das ist erkennbar kein Notenbild,
 * sondern das Wappen des Regals, aus dem sie kommt.
 *
 * Nicht auf der Rubrikseite: Dort stünde 191-mal dasselbe Bild
 * untereinander, und aus einem Wappen würde eine Tapete.
 */
export function rubrikBild(rubrik) {
  return `/assets/rubrik-banner/${rubrik.toLowerCase()}.jpg`;
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
      /* Das Banner ist die erste eingebettete Bilddatei vor der ersten
         Überschrift — nicht der Dateiname entscheidet, sondern der Platz
         im Kopf. 18 Notes tragen frühe Banner ohne das Wort im Namen
         (Vipassana-Reihe, Goenka, Marx, Wendy Brown); die fielen sonst
         still auf das Rubrikbild zurück (13.09.2026). */
      const kopf = rumpf.split(/\n#{2,6}\s/, 1)[0];
      const bannerEmbed = /!\[\[([^\]|\n]+?\.(?:jpe?g|png|webp|gif|avif))(?:\|[^\]\n]*)?\]\]/i.exec(kopf);
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
      /* Die Überschrift hat Spielarten — „zu anderen Denkern" (293 Notes,
         alle DenkerVitas), „in der Gedankenwelt" (22). Das Plugin las sie
         schon immer mit `startsWith`; hier galt nur die nackte Form. */
      const abschnitt = /^## Verbindungen[^\n]*$([\s\S]*?)(?=^## |(?![\s\S]))/m.exec(rumpf);
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
        /* Die zweite Schreibweise, als Liste: `- [[Ziel]] — Satz`, auch
           `- **[[Ziel]]** —` und `- → [[Ziel]] —`. Rund 1.500 Begründungen
           stehen so im Bestand und kamen bisher gar nicht an. Der Link muss
           den Eintrag eröffnen; mitten im Satz ist er eine Erwähnung. */
        for (const m of abschnitt[1].matchAll(/^[-*][ \t]+(?:→[ \t]*)?\**\[\[([^\]|]+)(?:\|[^\]]*)?\]\]\**[ \t]*(?:\*\([^)]*\)\*[ \t]*)?[—–:-]+[ \t]*([^\n]+(?:\n[ \t]+[^\n]+)*)/gm)) {
          const warum = m[2].replace(/\[\[([^\]|]+)(?:\|([^\]]*))?\]\]/g, (_, z, a) => a || z)
                            .replace(/[*_`]/g, "").replace(/\s+/g, " ").trim();
          if (warum.length >= 60) begruendet.push({ ziel: m[1].trim(), warum: warum.slice(0, 1200) });
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
        auszug: auszugVon(rumpf),
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
