import rss from "@astrojs/rss";
import { SITE } from "../lib/site.mjs";
import { feedEintraege } from "../lib/feed.mjs";

export async function GET() {
  return rss({
    title: SITE.name,
    description: SITE.satz,
    site: SITE.url,
    items: await feedEintraege(null, 30),
    customData: `<language>de-DE</language>`,
    trailingSlash: false,
  });
}
