/* Die Lesezeit — wie lange und wie weit eine Note gelesen wurde.

   Umami zählt Aufrufe, nicht Lesen. Eine Dauer kennt es nur als Abstand zum
   nächsten Klick — wer nach einer Note geht, und das sind fast alle, hinterlässt
   keine. Dieses Skript zählt die Sekunden, in denen die Seite sichtbar ist und
   in der letzten Minute und halben jemand gescrollt, getippt oder die Maus
   bewegt hat, merkt sich, wie weit der Text gelesen wurde, und schickt beides
   beim Verlassen als ein Ereignis „lesen" an Umami.

   Kein Cookie, keine Kennung, nichts über den Seitenaufruf hinaus — dieselben
   Regeln wie dort (Datenschutzerklärung, 16.09.2026). Ausgewertet von
   `herodot.py` im Cortex. Wer mehrmals weg- und zurückwechselt, sendet mehrmals
   den laufenden Stand; gezählt wird dort der größte. */

(() => {
  const blatt = document.querySelector("article.blatt");
  if (!blatt) return;

  const RUHE = 90;   // Sekunden ohne jede Regung: dann liest niemand mehr
  let sekunden = 0, zuletzt = Date.now(), tiefe = 0, gesendet = 0;

  const regung = () => { zuletzt = Date.now(); };
  for (const e of ["scroll", "wheel", "keydown", "pointermove", "touchstart"]) {
    addEventListener(e, regung, { passive: true });
  }

  const messen = () => {
    const r = blatt.getBoundingClientRect();
    const bis = (innerHeight - r.top) / r.height;
    tiefe = Math.max(tiefe, Math.min(100, Math.round(bis * 100)));
  };
  addEventListener("scroll", messen, { passive: true });
  messen();

  setInterval(() => {
    if (document.visibilityState === "visible" && Date.now() - zuletzt < RUHE * 1000) sekunden++;
  }, 1000);

  const senden = () => {
    if (sekunden < 5 || sekunden === gesendet || !window.umami) return;
    gesendet = sekunden;
    window.umami.track("lesen", { sekunden, tiefe });
  };
  addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") senden();
  });
  addEventListener("pagehide", senden);
})();

/* Die Hörzeit — ob der Begleiter-Player benutzt wurde und wie lange er lief.

   Ein Klick auf eine Zeitmarke sagt noch nicht, dass jemand zugehört hat.
   Gezählt werden darum die Sekunden, in denen das Video wirklich spielt,
   dazu, wodurch es angestoßen wurde: ein O-Ton-Zitat, eine Zeitmarke im
   Rand oder der Begleiter selbst. Blieb der Player blockiert, steht das mit
   dabei. Gesendet wird, wie beim Lesen, ein Ereignis „hoeren" beim Verlassen.

   Absichtlich ohne Griff in `leser.js`: Den Zustand meldet der YouTube-Iframe
   ohnehin per postMessage an die Seite, die Klicks fangen wir im
   Capture-Durchgang ab, bevor der Player sie bekommt. So hängt die Messung
   an keiner Variable des Players, und der Player an keiner der Messung. */

(() => {
  const begleiter = document.getElementById("begleiter");
  if (!begleiter) return;

  const SPIELT = 1;
  let zustand = -1, sekunden = 0, zitate = 0, marken = 0, direkt = 0, gesendet = "";

  addEventListener("click", (e) => {
    const ziel = e.target.closest?.(".oton[data-t], .ts, #begleiter");
    if (!ziel) return;
    // Dieselbe Marke noch einmal schließt den Begleiter — das ist kein Start.
    if (begleiter.classList.contains("offen") && ziel.classList.contains("klingt")) return;
    if (ziel.matches(".oton")) zitate++;
    else if (ziel.matches(".ts")) marken++;
    else if (!begleiter.classList.contains("offen")) direkt++;
  }, { capture: true });

  // Das Tastenkürzel öffnet ihn wie der ▶-Knopf: ein direkter Start. Im
  // Capture-Durchgang, also bevor leser.js ihn aufklappt.
  addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
    if (e.target.closest?.("input, textarea, select, [contenteditable]")) return;
    if (e.key.toLowerCase() === (begleiter.dataset.taste || "p") && !begleiter.classList.contains("offen")) direkt++;
  }, { capture: true });

  addEventListener("message", (e) => {
    if (!/^https:\/\/www\.youtube(-nocookie)?\.com$/.test(e.origin)) return;
    let d;
    try { d = typeof e.data === "string" ? JSON.parse(e.data) : e.data; } catch { return; }
    if (d?.event === "onStateChange" && typeof d.info === "number") zustand = d.info;
    else if (typeof d?.info?.playerState === "number") zustand = d.info.playerState;
  });

  setInterval(() => { if (zustand === SPIELT) sekunden++; }, 1000);

  const senden = () => {
    const starts = zitate + marken + direkt;
    if (!starts || !window.umami) return;
    const blockiert = document.querySelector(".begleiter__ersatz") ? 1 : 0;
    const stand = `${sekunden}/${starts}/${blockiert}`;
    if (stand === gesendet) return;
    gesendet = stand;
    window.umami.track("hoeren", { sekunden, zitate, marken, direkt, blockiert });
  };
  addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") senden();
  });
  addEventListener("pagehide", senden);
})();

/* Der Weg hinaus — wer eine Note über einen Link nach draußen verlässt.

   Wer nach einer halben Minute geht, kann aufgegeben haben oder zum Video,
   zum Buch, zur Studie gewechselt sein. Für Umami sieht beides gleich aus.
   Gezählt wird darum der Klick auf einen Link zu einer anderen Website, und
   nur ihr Name (youtube.com, genialokal.de, doi.org), nicht die Adresse.
   Zeitmarken und Zitate zählen nur, wo es keinen Begleiter-Player gibt —
   wo er sie übernimmt, verlassen sie die Seite nicht. */

(() => {
  if (!document.querySelector("article.blatt")) return;

  const hinaus = (e) => {
    if (e.type === "auxclick" && e.button !== 1) return;
    const a = e.target.closest?.("a[href]");
    if (!a || e.defaultPrevented) return;
    if (document.getElementById("begleiter") && a.closest(".oton, .ts, #begleiter")) return;
    let url;
    try { url = new URL(a.href, location.href); } catch { return; }
    if (!/^https?:$/.test(url.protocol) || url.hostname === location.hostname) return;
    if (!window.umami) return;
    window.umami.track("hinaus", { ziel: url.hostname.replace(/^www\./, "") });
  };
  addEventListener("click", hinaus);
  addEventListener("auxclick", hinaus);
})();
