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
