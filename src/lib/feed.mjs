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

export async function feedEintraege(rubrik = null, limit = 30) {
  const g = ladeGraph();
  const idx = ladeIndex();
  const datumVon = new Map(idx.alle.map((n) => [n.id, n.datum]));
  const urlVon = new Map(idx.alle.map((n) => [n.id, n.url]));
  const titelVon = new Map(idx.alle.map((n) => [n.id, n.titel]));

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
    content: n.rendered?.html ?? "",
    categories: [n.id.split("/")[0], ...(n.data.tags ?? []).filter((t) => !/^year-/.test(t))],
  }));
}
