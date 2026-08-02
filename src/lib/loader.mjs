/**
 * Eigener Content-Loader für die Gedankenwelten.
 *
 * Warum nicht Astros `glob()`: Der Glob-Loader behandelt den Dateipfad wie
 * eine URL und schneidet ihn am `?` ab — fünf Notes mit Fragezeichen im
 * Titel („Was ist Aufklärung?") fielen dadurch still aus dem Build. Die
 * Dateien umzubenennen wäre der falsche Weg; sie sind seit zwei Jahren unter
 * diesen Namen verlinkt. Also lesen wir selbst: `readdir` kennt keine
 * Query-Strings.
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import matter from "gray-matter";
import { INHALT, RUBRIKEN } from "./notizen.mjs";

/**
 * Ein Kniff vor dem Parsen: In `[[Ziel|Text]]` ist der senkrechte Strich der
 * Alias-Trenner — in einer Markdown-Tabelle ist er die Spaltengrenze. Wo
 * beides zusammenkommt, zerreißt der Link. Obsidian verzeiht das, GFM nicht.
 * Also maskieren wir ihn; remark macht daraus beim Parsen wieder ein `|`.
 */
function vorbereiten(markdown) {
  return markdown.replace(/\[\[[^\]\n]*\]\]/g, (m) => m.replace(/(?<!\\)\|/g, "\\|"));
}

/**
 * Muss steigen, sobald sich das Remark-Plugin oder die Zitat-Enden ändern.
 *
 * Astro merkt sich gerendertes HTML anhand der Prüfsumme. Bildeten wir die nur
 * aus der Markdown-Datei, bliebe nach einer Plugin-Änderung das alte Ergebnis
 * stehen — die Datei hat sich ja nicht bewegt. Das kostet sonst eine
 * Viertelstunde Fehlersuche an einem Fehler, den es gar nicht gibt.
 */
const FORM_VERSION = 3;

export function notizenLoader() {
  return {
    name: "gedankenwelten-notizen",

    async load({ store, parseData, generateDigest, renderMarkdown, logger, watcher }) {
      store.clear();

      let geladen = 0;
      const kaputt = [];

      for (const rubrik of RUBRIKEN) {
        const ordner = path.join(INHALT, rubrik);
        if (!fs.existsSync(ordner)) continue;

        for (const datei of fs.readdirSync(ordner).sort()) {
          if (!datei.endsWith(".md")) continue;
          const voll = path.join(ordner, datei);
          const id = `${rubrik}/${datei.replace(/\.md$/, "")}`.normalize("NFC");

          try {
            const roh = fs.readFileSync(voll, "utf8");
            const { data, content } = matter(roh);
            store.set({
              id,
              data: await parseData({ id, data }),
              body: content,
              // Kein `filePath`: der muss projektrelativ sein, unser Inhalt
              // liegt aber absichtlich außerhalb. Bilder adressieren wir
              // ohnehin absolut (/assets/…), also brauchen wir ihn nicht.
              digest: generateDigest(`v${FORM_VERSION}:${roh}`),
              rendered: await renderMarkdown(vorbereiten(content), {
                fileURL: pathToFileURL(voll),
              }),
            });
            geladen++;
          } catch (fehler) {
            // Eine kaputte Datei darf nicht 747 andere mitreißen
            kaputt.push(`${id} — ${fehler.message}`);
          }
        }
      }

      logger.info(`${geladen} Notes geladen`);
      if (kaputt.length) {
        logger.warn(`${kaputt.length} übersprungen:\n  ${kaputt.join("\n  ")}`);
      }

      // Im Dev-Modus die Rubriken beobachten, damit ein Speichern im Vault
      // sofort durchschlägt
      if (watcher) {
        for (const rubrik of RUBRIKEN) {
          const ordner = path.join(INHALT, rubrik);
          if (fs.existsSync(ordner)) watcher.add(ordner);
        }
      }
    },
  };
}
