/**
 * Die Sitemap — an derselben Adresse wie bisher (`robots.txt` und der
 * IndexNow-Ping auf dem Pi lesen sie dort). Notes mit Datum, Rubriken,
 * Beiseiten, Startseite. Aliasse nicht: Das sind Weiterleitungen.
 */
import { ladeIndex, RUBRIKEN } from "../lib/notizen.mjs";
import { ladeGraph } from "../lib/graph.mjs";
import { alleSeiten } from "../lib/seiten.mjs";
import { SITE } from "../lib/site.mjs";

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function GET() {
  const idx = ladeIndex();
  const g = ladeGraph();
  const urls = [];
  urls.push({ loc: `${SITE.url}/`, prio: "1.0" });
  for (const r of RUBRIKEN) urls.push({ loc: `${SITE.url}/${r}`, prio: "0.7" });
  urls.push({ loc: `${SITE.url}/Feeds`, prio: "0.3" });
  for (const s of alleSeiten()) urls.push({ loc: `${SITE.url}/${s.slug}`, prio: "0.3" });
  for (const n of idx.alle) {
    if (g.katalog.has(n.id) || n.basis.toLowerCase() === "index") continue;
    urls.push({ loc: `${SITE.url}${n.url}`, mod: n.datum ?? null, prio: "0.6" });
  }
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${esc(encodeURI(u.loc))}</loc>${u.mod ? `<lastmod>${u.mod}</lastmod>` : ""}<priority>${u.prio}</priority></url>`).join("\n")}
</urlset>
`;
  return new Response(body, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
}
