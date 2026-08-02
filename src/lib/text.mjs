/**
 * Gemeinsame Textnormalisierung.
 *
 * Wichtig: Das Vorab-Skript (`scripts/zitat-enden.mjs`) und das Build-Plugin
 * müssen denselben Schlüssel bilden — sonst findet der Build kein einziges
 * Zitat-Ende wieder. Darum liegt die Regel hier und nicht zweimal.
 */

const FUELL = new Set(["äh", "ähm", "ah", "ähem", "hm", "also", "ja", "eben", "halt", "so"]);

/** Text → nackte, vergleichbare Wörter. */
export function nackt(s) {
  return s
    .toLowerCase()
    .normalize("NFC")
    .replace(/[„“”"»«‚‘’']/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w && !FUELL.has(w));
}

/** Kennung eines Zitats: Video + Startsekunde + die ersten vier Wörter. */
export function zitatSchluessel(videoId, t, text) {
  return `${videoId}:${t}:${nackt(text).slice(0, 4).join("-")}`;
}
