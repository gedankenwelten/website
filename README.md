# gedankenwelten.org — die Website

Der Code hinter [gedankenwelten.org](https://gedankenwelten.org). Die Notes selbst — Denker, Zeitgeist,
Panoramen, Spuren und alles andere — liegen im Schwester-Repo
[gedankenwelten/gedankenwelten](https://github.com/gedankenwelten/gedankenwelten) (CC BY-SA 4.0).
Dieses Repo macht aus ihnen eine Seite: gebaut mit [Astro](https://astro.build), statisch, ohne Framework im Browser.

Der Code ist in deutscher Prosa kommentiert, und zwar meist mit dem *Warum* — wer verstehen will, weshalb
etwas so ist, liest am besten die Kommentare.

## Was drin ist

| Ort | Was |
|---|---|
| `src/lib/notizen.mjs` | liest den Markdown-Pool (Obsidian-Notes mit Frontmatter) und baut daraus den Index |
| `src/lib/graph.mjs`, `faden.mjs` | das Link-Netz zwischen den Notes, Begründungen der Verbindungen |
| `src/plugins/remark-gedankenwelten.mjs` | Obsidian-Markdown → HTML: Wikilinks, Callouts, Einbettungen, Zeitstempel |
| `src/pages/` | Startseite, Rubriken, Notes (`[...pfad].astro`), Feeds, Sitemap |
| `src/layouts/Note.astro` | die Seite einer Note |
| `public/*.js` | das Wenige, das im Browser läuft: Suche, Lesezeit, Vorschau beim Überfahren eines Links, Rückmeldung |
| `scripts/` | Vorschaubilder (`vorschau.mjs`), Berichte, der nächtliche Build auf dem Server |

Und wer auf dem Bild einer Note zweimal hinsieht, findet in `src/pages/raum/` einen Raum, den keine
Navigation verrät.

## Selbst bauen

```bash
git clone https://github.com/gedankenwelten/gedankenwelten      # die Notes
git clone https://github.com/gedankenwelten/website             # dieses Repo
cd website
npm ci
ln -s ../gedankenwelten/content/assets public/assets            # Banner und Bilder
GW_INHALT=../gedankenwelten/content node scripts/vorschau.mjs   # verkleinerte Banner (einmalig)
GW_INHALT=../gedankenwelten/content npm run build               # → dist/
npx astro preview
```

`GW_INHALT` zeigt auf den `content/`-Ordner der Notes. Ohne `NOINDEX=0` baut die Seite mit `noindex` —
damit eine Kopie nicht mit dem Original um Suchtreffer konkurriert.

## Messen

Die Seite zählt mit einer eigenen [Umami](https://umami.is)-Instanz: cookielos, ohne IP, ohne Profil;
Bildschirmgröße und Sprache verlassen den Browser nicht. Was genau gemessen wird (Lesezeit, Teilen, Klicks
nach draußen), steht in `public/lesezeit.js` und `public/leser.js` — und in der
[Datenschutzerklärung](https://gedankenwelten.org/Datenschutz). Wer nicht gezählt werden will, hängt einmal
`?nicht-zaehlen` an eine Adresse.

## Lizenz

Code: [MIT](LICENSE). Schriften: SIL Open Font License (`public/schrift/OFL-*.txt`). Notes: CC BY-SA 4.0 im
Schwester-Repo.
