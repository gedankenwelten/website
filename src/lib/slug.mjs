/**
 * Dateiname → URL-Segment.
 *
 * Exakt die Regel der Quartz-Fassung (`quartz/util/path.ts`, `sluggify`),
 * damit jede Adresse, die seit Mai 2026 draußen ist — in Suchmaschinen, in
 * Feed-Readern, in den Antworten des MCP-Servers —, in dieser Fassung
 * ankommt. Vorher stand hier eine „bewusst dieselbe" Regel, die es nicht
 * war: Sie strich Punkte und Halbgeviertstriche, Quartz behält sie
 * („Pentagon-vs.-Anthropic"). Beim Wechsel der Fassung wäre jeder solche
 * Link tot gewesen.
 */
export function slugify(name) {
  return String(name)
    .normalize("NFC")
    .replace(/\.md$/, "")
    .replace(/—/g, "-")        // Geviertstrich → Bindestrich (Quartz)
    .replace(/\s/g, "-")
    .replace(/&/g, "-and-")
    .replace(/%/g, "-percent")
    .replace(/\?/g, "")
    .replace(/#/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Rubrik + Dateiname → öffentlicher Pfad. */
export function noteUrl(rubrik, dateiname) {
  const s = slugify(dateiname);
  return rubrik ? `/${rubrik}/${s}` : `/${s}`;
}
