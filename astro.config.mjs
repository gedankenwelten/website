import { defineConfig } from "astro/config";
import remarkGedankenwelten from "./src/plugins/remark-gedankenwelten.mjs";

export default defineConfig({
  site: "https://gedankenwelten.org",
  markdown: {
    remarkPlugins: [remarkGedankenwelten],
    // Obsidian-Notes enthalten rohes HTML (<details>, <br>) — durchlassen
    allowDangerousHtml: true,
    syntaxHighlight: false,
    smartypants: false,
  },
  devToolbar: { enabled: false },
});
