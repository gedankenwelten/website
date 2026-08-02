/**
 * Dateiname → URL-Segment.
 *
 * Bewusst dieselbe Regel wie die Quartz-Fassung, damit beide Versionen
 * dieselben Adressen erzeugen und ein Link aus der einen in der anderen
 * ankommt — Voraussetzung für den Parallelbetrieb.
 */
export function slugify(name) {
  return name
    .normalize("NFC")
    .replace(/\.md$/, "")
    .replace(/[—–−]/g, " ")     // Gedankenstriche sind Wortgrenzen, keine Zeichen
    .replace(/[«»"„“”‚‘’']/g, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");
}

/** Rubrik + Dateiname → öffentlicher Pfad. */
export function noteUrl(rubrik, dateiname) {
  const s = slugify(dateiname);
  return rubrik ? `/${rubrik}/${s}` : `/${s}`;
}
