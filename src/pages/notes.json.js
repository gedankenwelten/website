/**
 * Alle Notes mit Datum, für Maschinen.
 *
 * Der MCP-Server sucht über Bedeutung, nicht über Zeit: Wer seinen
 * Assistenten fragt, was in den Gedankenwelten neu ist, bekam bisher keine
 * Antwort, weil kein Treffer ein Datum trug (Andreas, 05.11.2026). Hier
 * steht es, je Note: wann sie entstand (`erstellt`, sonst `date`) und wann
 * sie zuletzt inhaltlich wuchs (`aktualisiert`). Kataloge und alte
 * Deckblätter bleiben draußen, sie sind keine Notes.
 *
 * `id` ist der Pfad im Pool ohne Endung („Zeitgeist/…“), so wie der MCP
 * seine Quellen kennt; darüber findet er zu jedem Treffer das Datum.
 */
import { ladeIndex } from "../lib/notizen.mjs";
import { ladeGraph } from "../lib/graph.mjs";
import { SITE } from "../lib/site.mjs";

export function GET() {
  const katalog = ladeGraph().katalog;
  const notes = ladeIndex().alle
    .filter((n) => !katalog.has(n.id) && n.basis.toLowerCase() !== "index")
    .map((n) => ({
      id: n.id,
      titel: n.titel,
      url: new URL(n.url, SITE.url ?? "https://gedankenwelten.org").href,
      rubrik: n.rubrik,
      erstellt: n.erstellt,
      aktualisiert: n.aktualisiert,
      beschreibung: n.beschreibung,
      tags: n.tags,
    }))
    .sort((a, b) => ((b.aktualisiert ?? b.erstellt ?? "") > (a.aktualisiert ?? a.erstellt ?? "") ? 1 : -1));
  return new Response(JSON.stringify({ stand: new Date().toISOString(), notes }), {
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
