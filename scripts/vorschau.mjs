/**
 * Banner-Vorschauen bauen.
 *
 * Die Banner sind 1200 × 500 und im Schnitt 335 kB — richtig so, auf der
 * Note füllen sie die Spalte. Auf der Startseite stehen sie aber als
 * Streifen von 168 px Höhe, und siebzehn davon wären fast sechs Megabyte
 * für Bilder, von denen keines in seiner vollen Größe zu sehen ist.
 *
 * Also einmal vorab verkleinern: 760 px breit, WebP, Qualität 76. Das
 * kostet je Bild etwa ein Zehntel und sieht auf dem Streifen identisch
 * aus. Läuft nicht bei jedem Build — die Banner ändern sich selten, und
 * 536 Bilder neu zu rechnen dauert länger als die ganze Seite.
 *
 *   node scripts/vorschau.mjs          nur was fehlt
 *   node scripts/vorschau.mjs --alle   alles neu
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const QUELLE = path.join(process.env.HOME, "Gedankenwelten", "content", "assets");
const ZIEL = path.join(import.meta.dirname, "..", "public", "vorschau");
const ALLE = process.argv.includes("--alle");

fs.mkdirSync(ZIEL, { recursive: true });

const bilder = fs.readdirSync(QUELLE).filter((f) => /\.(jpe?g|png|webp)$/i.test(f));
let gebaut = 0, uebersprungen = 0, kaputt = 0;
let vorher = 0, nachher = 0;

for (const datei of bilder) {
  const aus = path.join(ZIEL, datei.replace(/\.[^.]+$/, "") + ".webp");
  const quelle = path.join(QUELLE, datei);
  const q = fs.statSync(quelle);

  if (!ALLE && fs.existsSync(aus) && fs.statSync(aus).mtimeMs >= q.mtimeMs) {
    uebersprungen++;
    continue;
  }
  try {
    await sharp(quelle).resize({ width: 760, withoutEnlargement: true })
      .webp({ quality: 76 }).toFile(aus);
    vorher += q.size;
    nachher += fs.statSync(aus).size;
    gebaut++;
  } catch (e) {
    kaputt++;
    console.warn(`  übersprungen: ${datei} — ${e.message}`);
  }
}

const mb = (b) => (b / 1048576).toFixed(1);
console.log(`${gebaut} gebaut · ${uebersprungen} unverändert${kaputt ? ` · ${kaputt} fehlerhaft` : ""}`);
if (gebaut) console.log(`${mb(vorher)} MB → ${mb(nachher)} MB  (${Math.round(100 - nachher / vorher * 100)} % kleiner)`);
