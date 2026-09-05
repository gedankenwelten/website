import { defineCollection, z } from "astro:content";
import { notizenLoader, seitenLoader } from "./lib/loader.mjs";

/**
 * Eine Sammlung über alle Rubriken. Der Inhalt liegt bewusst AUSSERHALB des
 * Projekts — im selben Markdown-Pool, aus dem auch Quartz baut. Das ist die
 * Bedingung für den Parallelbetrieb: eine Quelle, zwei Fassungen.
 */
const notes = defineCollection({
  loader: notizenLoader(),
  // Bewusst nachsichtig: 826 über zwei Jahre gewachsene Dateien halten sich
  // nicht an ein Schema, das wir uns heute ausdenken. Was fehlt, fehlt.
  schema: z
    .object({
      title: z.string().optional(),
      description: z.string().optional(),
      tags: z.array(z.string()).optional(),
      aliases: z.union([z.string(), z.array(z.string())]).optional(),
      aktualisiert: z.union([z.string(), z.date()]).optional(),
      erstellt: z.union([z.string(), z.date()]).optional(),
    })
    .passthrough(),
});

const seiten = defineCollection({
  loader: seitenLoader(),
  schema: z.object({ title: z.string().optional(), description: z.string().optional() }).passthrough(),
});

export const collections = { notes, seiten };
