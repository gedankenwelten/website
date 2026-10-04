/**
 * Der Gedankenraum (`/raum/`): das Netz der Notes, aus dem er seine Säle baut.
 *
 * Jede Note mit eigenem Banner ist ein Saal; die Wikilinks zwischen ihnen
 * sind die Türen (2 = gegenseitig verlinkt). Dazu je Note der geheimnisvolle
 * Satz, der als Wandspruch über ihrem Bild steht (`src/data/raum-raetsel.json`,
 * geschrieben mit gedankenpoesie — jeder Satz in seiner eigenen Hand), und das
 * Datum fürs Wandschild. Die Zusammenfassungen fürs Schild liegen getrennt in
 * `texte.json` und werden erst geholt, wenn jemand ein Schild antippt.
 */
import { ladeIndex } from "../../lib/notizen.mjs";
import { ladeGraph } from "../../lib/graph.mjs";
import raetsel from "../../data/raum-raetsel.json";

export function GET() {
  const idx = ladeIndex(), g = ladeGraph();
  const mit = idx.alle.filter((n) => n.banner && !g.katalog.has(n.id) && !n.tags.includes("meta"));
  const nr = new Map(mit.map((n, i) => [n.id, i]));
  const knoten = mit.map((n) => ({
    u: n.url,
    t: n.titel.replace(/ — DenkerVita$/, ""),
    r: n.rubrik,
    b: n.banner,
    v: n.vorschau?.startsWith("/vorschau/") ? n.vorschau : null,
    d: n.datum ? String(n.datum).slice(0, 10) : null,
    s: raetsel[n.url] ?? null,
  }));
  const w = new Map();
  for (const [von, ziele] of g.hinaus) for (const nach of ziele) {
    if (!nr.has(von) || !nr.has(nach)) continue;
    const a = nr.get(von), b = nr.get(nach), k = a < b ? `${a},${b}` : `${b},${a}`;
    w.set(k, (w.get(k) ?? 0) + 1);
  }
  const kanten = [...w].map(([k, s]) => [...k.split(",").map(Number), s]);
  return new Response(JSON.stringify({ knoten, kanten }), {
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
