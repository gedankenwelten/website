/* Das Tor zum Gedankenraum — ein Osterei.
 *
 * Doppelklick aufs Banner einer Note (am Telefon: zweimal kurz antippen),
 * und man steht in ihrem Saal im Gedankenraum (/raum): Die Seite bleibt erst
 * stehen, dann fliegt man rückwärts aus ihr heraus, bis ihr Bild an der Wand
 * hängt. Im Raum liegt die Note in einem Rahmen — dort führt derselbe
 * Doppelklick zurück hinaus in den Saal.
 */
(() => {
  // Aus dem Raum durch den Ausgang zurück: an die Stelle, an der man die Note verlassen hatte.
  try {
    const z = JSON.parse(sessionStorage.getItem("raum:zurueck") || "null");
    if (z && z.p === decodeURIComponent(location.pathname).normalize("NFC")) {
      sessionStorage.removeItem("raum:zurueck");
      if (z.y) addEventListener("load", () => scrollTo(0, z.y), { once: true });
    }
  } catch {}
  const bild = document.querySelector("img.banner");
  if (!bild) return;
  bild.style.touchAction = "manipulation";   // kein Doppeltipp-Zoom auf dem Bild — der Doppeltipp gehört dem Tor
  let imRaum = false;
  try { imRaum = window.parent !== window && window.parent.location.pathname.startsWith("/raum"); } catch {}

  function oeffnen() {
    getSelection()?.removeAllRanges();
    if (imRaum) { window.parent.postMessage("raum:zurueck", location.origin); return; }
    location.href = "/raum?von=" + encodeURIComponent(location.pathname) + "&y=" + Math.round(scrollY);
  }
  bild.addEventListener("dblclick", (e) => { e.preventDefault(); oeffnen(); });

  // Die sichtbare Klinke unter dem Banner: im Raum selbst überflüssig
  // (man steht ja schon im Saal), sonst dieselbe Tür wie der Doppelklick.
  const klinke = document.querySelector("a.raumtor");
  if (klinke) {
    if (imRaum) klinke.hidden = true;
    else klinke.addEventListener("click", (e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      e.preventDefault(); oeffnen();
    });
  }

  // Touch: zwei kurze Tipps kurz hintereinander, nah beieinander
  let letzter = null;
  bild.addEventListener("pointerup", (e) => {
    if (e.pointerType === "mouse") return;
    const jetzt = { t: e.timeStamp, x: e.clientX, y: e.clientY };
    if (letzter && jetzt.t - letzter.t < 350 && Math.hypot(jetzt.x - letzter.x, jetzt.y - letzter.y) < 30) {
      letzter = null; e.preventDefault(); oeffnen();
    } else letzter = jetzt;
  });
})();
