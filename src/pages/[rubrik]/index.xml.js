import rss from "@astrojs/rss";
import { SITE } from "../../lib/site.mjs";
import { feedEintraege } from "../../lib/feed.mjs";
import { RUBRIKEN } from "../../lib/notizen.mjs";
import { RUBRIKEN_INFO } from "../../lib/rubriken.mjs";

export function getStaticPaths() {
  return RUBRIKEN.map((rubrik) => ({ params: { rubrik } }));
}

export async function GET({ params }) {
  const { rubrik } = params;
  return rss({
    title: `${SITE.name} — ${rubrik}`,
    description: RUBRIKEN_INFO[rubrik]?.satz ?? `Neue Notes aus der Rubrik ${rubrik} auf ${SITE.name}`,
    site: SITE.url,
    items: await feedEintraege(rubrik, 30),
    customData: `<language>de-DE</language>`,
    trailingSlash: false,
  });
}
