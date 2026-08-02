/**
 * Wann eine Note entstanden ist — und warum das nicht im Frontmatter steht.
 *
 * 665 der 748 Notes tragen ein `aktualisiert:`. Die fehlenden sind fast
 * vollständig die 263 DenkerVitas: Sie sind zeitlose Profile, niemand hat
 * ihnen je ein Datum gegeben, und für ihren Zweck brauchten sie keins.
 * Eine Startseite, die durch die Zeit führt, braucht es doch.
 *
 * Also fragen wir die Versionsgeschichte. Nicht die des öffentlichen
 * Repos — dort sind alle Dateien am Tag ihres ersten Syncs entstanden —,
 * sondern die des Cortex, wo tatsächlich geschrieben wird. Ein einziger
 * `git log` über den ganzen Ordner reicht; 606 Erstanlagen in einem Aufruf.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const CORTEX = path.join(process.env.HOME, "Cortex");

let ausGit = null;

function gitDaten() {
  if (ausGit) return ausGit;
  ausGit = new Map();
  if (!fs.existsSync(path.join(CORTEX, ".git"))) return ausGit;

  try {
    const roh = execFileSync(
      "git",
      ["log", "--diff-filter=A", "--format=@%aI", "--name-only", "--", "Gedankenwelten/"],
      { cwd: CORTEX, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
    );
    let datum = null;
    for (const zeile of roh.split("\n")) {
      if (zeile.startsWith("@")) { datum = zeile.slice(1, 11); continue; }
      if (!zeile.endsWith(".md") || !datum) continue;
      // `git log` läuft rückwärts; die *letzte* gesehene Anlage ist die
      // früheste. Ein Umzug zwischen Rubriken legt die Datei neu an.
      const schluessel = path.basename(zeile).replace(/\.md$/, "").normalize("NFC").toLowerCase();
      ausGit.set(schluessel, datum);
    }
  } catch { /* kein Git, kein Fallback — dann bleibt das Datum eben leer */ }
  return ausGit;
}

/** Frontmatter-Datum in beiden Schreibweisen, die im Bestand vorkommen. */
function lies(wert) {
  if (!wert) return null;
  if (wert instanceof Date) return wert.toISOString().slice(0, 10);
  const s = String(wert).trim().replace(/^["']|["']$/g, "");
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /^(\d{2})\.(\d{2})\.(\d{4})/.exec(s);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return null;
}

/**
 * `aktualisiert:` zuerst — es ist das kuratierte Datum, an dem auch das
 * Journal hängt. Erst wenn keins da ist, zählt die Erstanlage.
 */
export function datumVon(fm, basis) {
  return lies(fm.aktualisiert) ?? lies(fm.date) ?? lies(fm.erstellt)
      ?? gitDaten().get(basis.normalize("NFC").toLowerCase())
      ?? null;
}
