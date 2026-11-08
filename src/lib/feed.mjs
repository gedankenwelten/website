/**
 * Was in einen Feed gehört — geteilt vom Haupt-Feed und den zehn
 * Rubrik-Feeds. Dieselbe Auswahl wie die Quartz-Fassung: nur echte
 * Notes, keine Kataloge, die letzten dreißig nach Datum; Aufmacher als
 * Beschreibung, der gerenderte Text als Inhalt.
 */
import { getCollection } from "astro:content";
import { ladeGraph } from "./graph.mjs";
import { ladeIndex } from "./notizen.mjs";
import { SITE } from "./site.mjs";
import raumRaetsel from "../data/raum-raetsel.json";

/* Im Feed-Reader soll eine Note mit ihrem Gedanken beginnen, nicht mit der
   Werkstatt: Die Kästchen 🎨 (Künstlerhand, Prompt) und ✒️ (geliehene
   Stimme) bleiben der Website vorbehalten, wo sie eingeklappt unter dem
   Banner stehen. Davor kommt der Wandspruch, wie im Gedankenraum (seit 08.11.2026). */
const WERKSTATT = /<details\b[^>]*>\s*<summary>(?:(?!<\/summary>)[\s\S])*?(?:🎨|✒️|✒)(?:(?!<\/summary>)[\s\S])*<\/summary>[\s\S]*?<\/details>\s*/g;
const escape = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function feedInhalt(html, raetsel) {
  const rumpf = html.replace(WERKSTATT, "");
  return raetsel ? `<p><em>${escape(raetsel)}</em></p>\n${rumpf}` : rumpf;
}

export async function feedEintraege(rubrik = null, limit = 30) {
  const g = ladeGraph();
  const idx = ladeIndex();
  const datumVon = new Map(idx.alle.map((n) => [n.id, n.datum]));
  const urlVon = new Map(idx.alle.map((n) => [n.id, n.url]));
  const titelVon = new Map(idx.alle.map((n) => [n.id, n.titel]));
  const raetselVon = new Map(idx.alle.map((n) => [n.id, n.raetsel ?? raumRaetsel[n.url] ?? null]));

  const notes = (await getCollection("notes"))
    .filter((n) => !g.katalog.has(n.id) && n.id.split("/").pop().toLowerCase() !== "index")
    .filter((n) => !rubrik || n.id.split("/")[0] === rubrik)
    .filter((n) => datumVon.get(n.id))
    .sort((a, b) => String(datumVon.get(b.id)).localeCompare(String(datumVon.get(a.id))))
    .slice(0, limit);

  return notes.map((n) => ({
    title: titelVon.get(n.id) ?? n.data.title ?? n.id,
    link: `${SITE.url}${urlVon.get(n.id)}`,
    pubDate: new Date(datumVon.get(n.id)),
    description: n.data.description ?? "",
    content: feedInhalt(n.rendered?.html ?? "", raetselVon.get(n.id)),
    categories: [n.id.split("/")[0], ...(n.data.tags ?? []).filter((t) => !/^year-/.test(t))],
  }));
}
