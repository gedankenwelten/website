import { defineConfig } from "astro/config";
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import remarkGedankenwelten from "./src/plugins/remark-gedankenwelten.mjs";
import { INHALT, RUBRIKEN } from "./src/lib/notizen.mjs";
import { slugify, noteUrl } from "./src/lib/slug.mjs";
import { SEITEN } from "./src/lib/seiten.mjs";

/* ── Die Aliasse ──
   496 Notes tragen `aliases:` im Frontmatter — Kurznamen, unter denen sie
   seit der ersten Fassung erreichbar sind („/Adriaan-Selbstfürsorge"). Die
   Quartz-Fassung legte dafür 884 Weiterleitungsseiten an; wer eine dieser
   Adressen gespeichert hat, soll auch hier ankommen. Astro baut aus dieser
   Liste dieselben Seiten (meta refresh + canonical). Ein Alias, der mit
   einer echten Adresse zusammenfiele, wird übersprungen — die Seite
   gewinnt. */
function aliasWeiterleitungen() {
  const ziele = {};
  const echt = new Set();
  for (const rubrik of RUBRIKEN) {
    const ordner = path.join(INHALT, rubrik);
    if (!fs.existsSync(ordner)) continue;
    for (const datei of fs.readdirSync(ordner)) {
      if (!datei.endsWith(".md")) continue;
      // Die alten Quartz-Deckblätter (`Zeitgeist/index.md`) haben keine
      // eigene Seite mehr — und ihr Alias „Zeitgeist" ist die Rubrikseite.
      if (datei.toLowerCase() === "index.md") continue;
      let data = {};
      try { data = matter(fs.readFileSync(path.join(ordner, datei), "utf8")).data ?? {}; } catch { continue; }
      const url = noteUrl(rubrik, datei);
      echt.add(url);
      const aliasse = Array.isArray(data.aliases) ? data.aliases : data.aliases ? [data.aliases] : [];
      for (const a of aliasse) {
        const s = slugify(String(a));
        if (s) ziele[`/${s}`] ??= url;
      }
    }
  }
  // Auch die Beiseiten tragen Aliasse („Privacy Policy" → Datenschutz).
  for (const seite of SEITEN) {
    const voll = path.join(INHALT, seite.datei);
    if (!fs.existsSync(voll)) continue;
    let data = {};
    try { data = matter(fs.readFileSync(voll, "utf8")).data ?? {}; } catch { continue; }
    const url = `/${slugify(seite.datei)}`;
    echt.add(url);
    const aliasse = Array.isArray(data.aliases) ? data.aliases : data.aliases ? [data.aliases] : [];
    for (const a of aliasse) { const s = slugify(String(a)); if (s) ziele[`/${s}`] ??= url; }
  }
  for (const r of RUBRIKEN) echt.add(`/${r}`);
  for (const k of Object.keys(ziele)) if (echt.has(k)) delete ziele[k];
  return ziele;
}

export default defineConfig({
  site: "https://gedankenwelten.org",
  /* Dieselbe Dateiform wie die Quartz-Fassung: `Zeitgeist/Slug.html`,
     Adressen ohne Schrägstrich am Ende. Der Caddy auf dem Pi kennt
     `try_files {path} {path}.html {path}/index.html` — nichts umzustellen. */
  build: { format: "file" },
  trailingSlash: "never",
  redirects: aliasWeiterleitungen(),
  markdown: {
    remarkPlugins: [remarkGedankenwelten],
    // Obsidian-Notes enthalten rohes HTML (<details>, <br>) — durchlassen
    allowDangerousHtml: true,
    syntaxHighlight: false,
    smartypants: false,
  },
  devToolbar: { enabled: false },
  /* Der CSS-Minifierer schreibt `max-width: 700px` sonst als
     `(width <= 700px)` — Bereichs-Syntax, die Safari erst seit 16.4
     kennt. Ein älteres Telefon bekäme die Desktop-Fassung. */
  vite: { build: { cssTarget: ["safari15", "ios15", "chrome100", "firefox100"] } },
});
