/**
 * Die Beiseiten — was neben den Notes noch steht: Impressum, Datenschutz,
 * die MCP-Doku, der Quellen-Index. Sie liegen im selben Pool, aber in der
 * Wurzel, nicht in einer Rubrik. Adressen wie in der Quartz-Fassung.
 */
import fs from "node:fs";
import path from "node:path";
import { INHALT } from "./notizen.mjs";
import { slugify } from "./slug.mjs";

export const SEITEN = [
  { datei: "Impressum.md", titel: "Impressum" },
  { datei: "Datenschutz.md", titel: "Datenschutzerklärung" },
  { datei: "MCP.md", titel: "MCP-Server" },
  { datei: "Quellen & Links.md", titel: "Quellen & Links" },
];

export function alleSeiten() {
  return SEITEN
    .map((s) => ({ ...s, pfad: path.join(INHALT, s.datei), slug: slugify(s.datei) }))
    .filter((s) => fs.existsSync(s.pfad));
}
