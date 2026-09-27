/* Ein Blick in die Note, bevor man hingeht.

   Verweilt die Maus auf einem Link im Text, erscheint die Zielnote als
   Karte: Banner, Rubrik, Titel, die ersten Sätze. Quartz hatte das (seine
   Popovers); mit dem Umzug auf die eigene Fassung am 05.09.2026 fiel es
   still weg — gemerkt hat es Andreas am 26.09. beim Überfahren einer Vita.

   Die Daten stehen in `/blick.json`, einmal für alle Notes gerechnet, und
   werden beim ersten Link geholt, über dem jemand verweilt. Nur mit Maus:
   Auf dem Telefon ist Berühren schon Hingehen, eine Karte dazwischen
   hielte nur auf. */

(() => {
  if (!matchMedia("(hover: hover) and (pointer: fine)").matches) return;
  const text = document.getElementById("text");
  if (!text) return;

  const WARTEN = 320;   // ms — kürzer, und die Karte blitzt beim bloßen Drüberfahren auf
  const marke = new URL(document.currentScript?.src ?? location.href).searchParams.get("v") ?? "";
  const hier = decodeURIComponent(location.pathname).replace(/\.html$/, "").normalize("NFC");

  let daten = null, holen = null, uhr = 0, aktiv = null;
  const laden = () => holen ??= fetch(`/blick.json?v=${marke}`)
    .then((r) => r.ok ? r.json() : {})
    .then((d) => (daten = d))
    .catch(() => (daten = {}));

  const karte = document.createElement("aside");
  karte.className = "blick";
  karte.setAttribute("aria-hidden", "true");
  karte.innerHTML = `<img class="blick__bild" alt="">
    <div class="blick__rumpf">
      <div class="blick__rubrik"><span class="regal__punkt"></span><span></span></div>
      <div class="blick__titel"></div>
      <p class="blick__text"></p>
    </div>`;
  document.body.append(karte);
  const bild = karte.querySelector(".blick__bild");
  const punkt = karte.querySelector(".regal__punkt");
  const rubrik = karte.querySelector(".blick__rubrik span:last-child");
  const titel = karte.querySelector(".blick__titel");
  const satz = karte.querySelector(".blick__text");
  bild.addEventListener("error", () => { bild.hidden = true; });

  const schluessel = (a) => decodeURIComponent(a.dataset.note.split("#")[0]).normalize("NFC");

  const zeigen = (a, x, y) => {
    const n = daten?.[schluessel(a)] ?? daten?.[a.dataset.note.split("#")[0]];
    if (!n || aktiv !== a) return;
    bild.hidden = !n.b;
    if (n.b) bild.src = n.b;
    punkt.className = `regal__punkt regal__punkt--${n.r.toLowerCase()}`;
    rubrik.textContent = n.r;
    // „Achille Mbembe — DenkerVita": Die Rubrik steht schon darüber.
    titel.textContent = n.t.replace(/\s+—\s+DenkerVita$/, "");
    satz.textContent = n.x ?? "";
    satz.hidden = !n.x;

    // An die Zeile, über der die Maus steht — ein Link kann umbrechen.
    const zeilen = [...a.getClientRects()];
    const r = zeilen.find((z) => y >= z.top - 2 && y <= z.bottom + 2) ?? zeilen[0];
    karte.style.left = "0px"; karte.style.top = "0px";
    karte.classList.add("messen");
    const b = karte.offsetWidth, h = karte.offsetHeight;
    karte.classList.remove("messen");
    const links = Math.min(Math.max(12, Math.min(r.left, x - 40)), innerWidth - b - 12);
    const unten = r.bottom + 10;
    const oben = unten + h > innerHeight - 12 ? Math.max(12, r.top - 10 - h) : unten;
    karte.style.left = links + "px";
    karte.style.top = oben + "px";
    karte.classList.toggle("blick--oben", oben < r.top);
    karte.classList.add("da");
  };

  const weg = () => {
    clearTimeout(uhr);
    aktiv = null;
    karte.classList.remove("da");
  };

  text.addEventListener("pointerover", (e) => {
    const a = e.target.closest?.("a.wikilink[data-note]");
    if (!a || a === aktiv) return;
    if (schluessel(a) === hier) return;   // Ein Verweis auf die Note, in der man schon ist
    weg();
    aktiv = a;
    laden();
    const { clientX: x, clientY: y } = e;
    uhr = setTimeout(() => holen.then(() => zeigen(a, x, y)), WARTEN);
  });
  text.addEventListener("pointerout", (e) => {
    const a = e.target.closest?.("a.wikilink[data-note]");
    if (a && !a.contains(e.relatedTarget)) weg();
  });
  addEventListener("scroll", weg, { passive: true });
  addEventListener("keydown", (e) => { if (e.key === "Escape") weg(); });
  text.addEventListener("click", weg);
})();
