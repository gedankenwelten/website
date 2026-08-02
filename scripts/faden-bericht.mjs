/** Die Fäden als Text lesen, bevor sie eine Seite werden. */
import { alleFaeden } from "../src/lib/faden.mjs";

const faeden = alleFaeden(7);
console.log(`${faeden.length} Fäden\n`);

for (const f of faeden) {
  console.log("─".repeat(78));
  for (const [i, s] of f.entries()) {
    if (s.grund) {
      const was = s.grund.was ? ` „${s.grund.was.slice(0, 62)}“` : "";
      console.log(`        │  ${s.grund.fund ? "◇" : "│"} ${s.grund.wie}${was}`);
    }
    console.log(`  ${String(i + 1).padStart(2)}. ${s.datum}  ${s.rubrik.padEnd(13)} ${s.titel.slice(0, 62)}`);
    if (s.teaser) console.log(`        ${s.teaser.slice(0, 96)}`);
  }
  const d = f.map((s) => s.datum).filter(Boolean);
  const funde = f.filter((s) => s.grund?.fund).length;
  console.log(`      → ${f.length} Stationen · ${d[0]} bis ${d[d.length - 1]} · ${funde} Funde · ${new Set(f.map((s) => s.rubrik)).size} Rubriken\n`);
}
