/**
 * Was der Stern über den ganzen Bestand sagt.
 *
 *   node scripts/stern-bericht.mjs            Überblick
 *   node scripts/stern-bericht.mjs --funde    nur die unentdeckten Nähen
 */
import { ladeGraph, sternFuer } from "../src/lib/graph.mjs";
import { setzen } from "../src/lib/layout.mjs";

const g = ladeGraph();
const alle = [...g.knoten.keys()];
const nurFunde = process.argv.includes("--funde");

const grade = [];
let ohne = 0, mitQuellkante = 0, hoechste = 0;
const funde = [];

let kataloge = 0;
for (const id of alle) {
  const s = sternFuer(id);
  if (!s) { kataloge++; continue; }
  const nachbarn = s.nodes.length - 1;
  grade.push(nachbarn);
  if (!nachbarn) { ohne++; continue; }
  const q = s.links.filter((l) => !l.rand && l.art === "quelle");
  if (q.length) {
    mitQuellkante++;
    for (const l of q) {
      const anderer = l.source === id ? l.target : l.source;
      if (id < anderer) funde.push({ a: id, b: anderer, q: l.quellen });
    }
  }
  if (s.weitere > hoechste) hoechste = s.weitere;
}

if (nurFunde) {
  console.log(`${funde.length} Nähen, die im Bestand liegen und nie verlinkt wurden:\n`);
  for (const f of funde.sort((x, y) => y.q.length - x.q.length)) {
    console.log(`  ${f.a}\n    ↔ ${f.b}`);
    for (const q of f.q.slice(0, 3)) console.log(`       ${q.art} · ${q.titel}`);
    console.log();
  }
  process.exit(0);
}

grade.sort((a, b) => b - a);
console.log(`Notes                       ${alle.length}`);
console.log(`  Kataloge, ohne Stern      ${kataloge}`);
console.log(`  ohne jeden Nachbarn       ${ohne}`);
console.log(`  mit gestrichelter Kante   ${mitQuellkante}`);
console.log(`Nachbarn je Note   max ${grade[0]} · median ${grade[grade.length >> 1]} · gekappt bis ${hoechste} weitere`);
console.log(`Quellen  brauchbar ${g.statistik.gelesen} · als Beiwerk verworfen ${g.statistik.verworfen}`);
console.log(`Unentdeckte Nähen           ${funde.length}`);

// Passt jedes Sternbild auf seine Bühne?
let hoch = 0, breit = 0;
for (const id of alle.slice(0, 200)) {
  const s = sternFuer(id);
  if (!s || s.nodes.length < 2) continue;
  const g2 = setzen(s);
  hoch = Math.max(hoch, g2.buehne.hoehe);
  for (const n of g2.nodes) breit = Math.max(breit, Math.abs(n.x - g2.buehne.breite / 2));
}
console.log(`Bühne (Stichprobe 200)      höchste ${hoch} · weiteste Auslenkung ${Math.round(breit)}`);
