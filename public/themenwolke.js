/* Die Themenwolke als Denker — auf dem großen Schirm.

   Auf dem Telefon fließen die Themen als Zeilen (start.css). Am Schreibtisch
   legen sie sich in die Gestalt von Rodins Denker (Andreas, 17.09.2026): Die
   Silhouette (`/wolke/denker.png`) ist eine unsichtbare Maske, und jedes Wort
   sucht sich — groß zuerst, vom Schwerpunkt der Figur nach außen — einen Platz,
   der ganz in der Figur liegt und kein anderes Wort berührt.

   Damit die Gestalt bei jeder Fenstergröße und jeder Zahl von Themen trägt,
   wird nicht mit festen Schriftgraden gelegt: Das Skript sucht den größten
   Maßstab, bei dem noch *alle* Wörter hineinpassen (Halbierung, acht Schritte).
   Kommen Themen dazu, wird alles etwas kleiner; wird das Fenster breiter,
   wächst die Figur mit. Sichtbar ist nur, was die Wörter bilden — die
   Silhouette selbst bleibt unsichtbar; man soll den Denker erahnen.

   Die 146 echten Themen allein füllen nur die Mitte — große Wörter passen
   nicht in Kopf, Hand und Fels. Darum wird danach aufgefüllt: kleine, blasse
   Wiederholungen der Themen (je häufiger ein Thema, desto öfter), bis in die
   feinen Stellen. Erst so zeichnet sich der Umriss ab. Die Echos filtern beim
   Klick wie das Original, sind aber für Vorleseprogramme ausgeblendet.

   Gelegt wird auf einem Raster von 3 px. Kein Framework, keine Bibliothek. */

(() => {
  const wolke = document.getElementById("wolke");
  const liste = wolke?.querySelector(".wolke__liste");
  if (!liste) return;

  const gross = matchMedia("(min-width: 1180px)");
  const woerter = [...liste.querySelectorAll(".wolke__wort")]
    .map((el) => ({ el, grad: parseFloat(el.style.getPropertyValue("--grad")) || 0 }))
    .sort((a, b) => b.grad - a.grad);

  const ZELLE = 3;
  const maske = new Image();
  maske.src = "/wolke/denker.png";
  const geladen = maske.decode().then(() => true, () => false);
  const messer = document.createElement("canvas").getContext("2d");

  let gelegtFuer = "";
  const echoFeld = document.createElement("div");
  echoFeld.className = "wolke__echos";
  echoFeld.setAttribute("aria-hidden", "true");

  // Wie oft ein Thema als Echo wiederkehrt: nach seiner Häufigkeit, gemischt,
  // damit nicht dasselbe Wort in Reihe steht.
  const echoFolge = (() => {
    const topf = [];
    // Kurze Wörter (ki, usa, afd …) nicht als Echo: In jede enge Lücke passte
    // sonst nur „ki", und die Figur stotterte.
    for (const w of woerter.filter((w) => w.el.firstChild.textContent.trim().length >= 4)) {
      const mal = 1 + Math.round(w.grad * 4);
      for (let i = 0; i < mal; i++) topf.push(w);
    }
    let z = 7;  // fester Zufall: dieselbe Figur bei jedem Legen
    const zufall = () => (z = (z * 16807) % 2147483647) / 2147483647;
    for (let i = topf.length - 1; i > 0; i--) {
      const j = Math.floor(zufall() * (i + 1));
      [topf[i], topf[j]] = [topf[j], topf[i]];
    }
    return topf;
  })();

  function aufheben() {
    if (!liste.classList.contains("ist-figur")) return;
    liste.classList.remove("ist-figur");
    liste.style.width = liste.style.height = "";
    echoFeld.replaceChildren();
    echoFeld.remove();
    for (const { el } of woerter) el.style.left = el.style.top = el.style.fontSize = "";
    gelegtFuer = "";
  }

  /* Welche Rasterzellen in der Figur liegen, und in welcher Reihenfolge man
     Plätze probiert: vom Schwerpunkt nach außen. */
  function rasterFuer(bw, bh) {
    const gw = Math.floor(bw / ZELLE), gh = Math.floor(bh / ZELLE);
    const c = document.createElement("canvas");
    c.width = gw; c.height = gh;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(maske, 0, 0, gw, gh);
    const px = ctx.getImageData(0, 0, gw, gh).data;
    const drin = new Uint8Array(gw * gh);
    let sx = 0, sy = 0, n = 0;
    for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
      if (px[(y * gw + x) * 4 + 3] > 140) { drin[y * gw + x] = 1; sx += x; sy += y; n++; }
    }
    const mx = sx / n, my = sy / n;
    const orte = [];
    for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
      if (drin[y * gw + x]) orte.push([x, y, (x - mx) ** 2 + ((y - my) * 1.15) ** 2]);
    }
    orte.sort((a, b) => a[2] - b[2]);
    return { gw, gh, drin, orte };
  }

  const schriftFuer = (grad, s) => ({
    px: (13 + grad * 30) * s,
    gewicht: Math.round((380 + grad * 240) / 10) * 10,
  });

  /* Ein Versuch mit Maßstab s. Liefert die Plätze — oder null, sobald ein
     Wort nirgends mehr hinpasst. */
  function legeMit(s, r) {
    const belegt = new Uint8Array(r.gw * r.gh);
    const plaetze = [];
    for (const w of woerter) {
      const { px, gewicht } = schriftFuer(w.grad, s);
      messer.font = `${gewicht} ${px}px Literata, Georgia, serif`;
      const breite = messer.measureText(w.el.firstChild.textContent).width * 1.02 + 3;
      const hoehe = px * 1.02 + 1;
      const cw = Math.ceil(breite / ZELLE), ch = Math.ceil(hoehe / ZELLE);
      if (cw > r.gw || ch > r.gh) return null;

      let platz = null;
      for (const [ox, oy] of r.orte) {
        // Der Ort ist die Mitte des Wortes.
        const x0 = ox - (cw >> 1), y0 = oy - (ch >> 1);
        if (x0 < 0 || y0 < 0 || x0 + cw > r.gw || y0 + ch > r.gh) continue;
        let frei = true;
        for (let y = y0; y < y0 + ch && frei; y++) {
          const zeile = y * r.gw;
          for (let x = x0; x < x0 + cw; x++) {
            if (!r.drin[zeile + x] || belegt[zeile + x]) { frei = false; break; }
          }
        }
        if (frei) { platz = [x0, y0]; break; }
      }
      if (!platz) return null;
      const [x0, y0] = platz;
      for (let y = y0; y < y0 + ch; y++) belegt.fill(1, y * r.gw + x0, y * r.gw + x0 + cw);
      plaetze.push({ w, px, x: x0 * ZELLE + 2, y: y0 * ZELLE + px * .04 });
    }
    plaetze.belegt = belegt;
    return plaetze;
  }

  /* Der Rest der Figur: Zeile für Zeile durch die freien Zellen, in
     absteigenden Größen. An jeder freien Stelle wird gemessen, wie weit der
     Platz nach rechts reicht (in allen Zeilen, die das Wort braucht), und
     das nächste Wort der Echo-Folge genommen, das genau hineinpasst — so
     laufen die Wörter bis an den Umriss, statt davor aufzuhören. */
  const breite100 = new Map();
  function breiteBei(w, px) {
    if (!breite100.has(w)) {
      messer.font = "400 100px Literata, Georgia, serif";
      breite100.set(w, messer.measureText(w.el.firstChild.textContent).width);
    }
    return breite100.get(w) * px / 100;
  }

  function auffuellen(r, belegt, groesste) {
    const echos = [];
    const faktor = Math.max(.8, r.gh * ZELLE / 1000);
    const stufen = [...new Set([groesste, 11 * faktor, 9.5 * faktor, 8.2 * faktor, 7 * faktor, 6 * faktor]
      .filter((g) => g <= groesste))].sort((x, y) => y - x);
    const frei = (i) => r.drin[i] && !belegt[i];
    let k = 0;
    for (const px of stufen) {
      const ch = Math.ceil((px * 1.02 + 1) / ZELLE);
      const breiten = echoFolge.map((w) => Math.ceil((breiteBei(w, px) * 1.02 + 2) / ZELLE));
      const schmalste = Math.min(...breiten);
      for (let y0 = 0; y0 + ch <= r.gh; y0++) {
        for (let x0 = 0; x0 < r.gw; x0++) {
          if (!frei(y0 * r.gw + x0)) continue;
          // Wie weit reicht der freie Platz nach rechts, in allen ch Zeilen?
          let lauf = 0;
          while (x0 + lauf < r.gw && lauf < 90) {
            let spalteFrei = true;
            for (let y = y0; y < y0 + ch; y++) if (!frei(y * r.gw + x0 + lauf)) { spalteFrei = false; break; }
            if (!spalteFrei) break;
            lauf++;
          }
          if (lauf < schmalste) { x0 += lauf; continue; }
          // Unter den nächsten Wörtern der Folge das, das den Platz am besten füllt.
          let wahl = -1;
          for (let t = 0; t < 48; t++) {
            const j = (k + t) % echoFolge.length;
            if (breiten[j] <= lauf && (wahl < 0 || breiten[j] > breiten[wahl])) wahl = j;
          }
          if (wahl < 0) { x0 += lauf; continue; }
          const cw = breiten[wahl];
          for (let y = y0; y < y0 + ch; y++) belegt.fill(1, y * r.gw + x0, y * r.gw + x0 + cw);
          echos.push({ w: echoFolge[wahl], px, x: x0 * ZELLE + 1, y: y0 * ZELLE });
          k = (wahl + 1) % echoFolge.length;
          x0 += cw - 1;
        }
      }
    }
    return echos;
  }

  async function legen() {
    if (wolke.hidden || !gross.matches) { aufheben(); return; }
    if (!(await geladen))  return;
    await document.fonts?.ready;

    // Die Figur ist höher als ein Bildschirm: klein gedrängt würden die
    // Wörter unlesbar. Breite folgt dem Seitenverhältnis der Silhouette.
    const verhaeltnis = maske.naturalWidth / maske.naturalHeight;
    let bh = Math.min(1100, Math.max(780, innerHeight * 1.12));
    let bw = bh * verhaeltnis;
    const platzDa = wolke.clientWidth;
    if (bw > platzDa) { bw = platzDa; bh = bw / verhaeltnis; }
    bw = Math.round(bw); bh = Math.round(bh);

    const schluessel = `${bw}x${bh}`;
    if (schluessel === gelegtFuer) return;

    const r = rasterFuer(bw, bh);
    let lo = 0.2, hi = 2.2, bestes = null;
    for (let i = 0; i < 8; i++) {
      const mitte = (lo + hi) / 2;
      const p = legeMit(mitte, r);
      if (p) { bestes = p; lo = mitte; } else { hi = mitte; }
    }
    bestes ??= legeMit(lo, r);
    if (!bestes) { aufheben(); return; }

    liste.classList.add("ist-figur");
    liste.style.width = `${bw}px`;
    liste.style.height = `${bh}px`;
    for (const { w, px, x, y } of bestes) {
      w.el.style.fontSize = `${px.toFixed(1)}px`;
      w.el.style.left = `${x.toFixed(0)}px`;
      w.el.style.top = `${y.toFixed(0)}px`;
    }

    const kleinstes = Math.min(...bestes.map((b) => b.px));
    const echos = auffuellen(r, bestes.belegt, Math.max(kleinstes, 9));
    const teile = document.createDocumentFragment();
    for (const { w, px, x, y } of echos) {
      const b = document.createElement("button");
      b.type = "button";
      b.tabIndex = -1;
      b.className = "wolke__echo";
      b.dataset.thema = w.el.dataset.thema;
      b.textContent = w.el.firstChild.textContent;
      b.style.cssText = `left:${x}px;top:${y}px;font-size:${px.toFixed(1)}px;--farbe:${w.el.style.getPropertyValue("--farbe")}`;
      teile.append(b);
    }
    echoFeld.replaceChildren(teile);
    if (!echoFeld.isConnected) liste.append(echoFeld);
    gelegtFuer = schluessel;
  }

  let wartet = null;
  const bald = () => { clearTimeout(wartet); wartet = setTimeout(legen, 120); };
  new ResizeObserver(bald).observe(wolke);
  addEventListener("resize", bald);
  gross.addEventListener?.("change", bald);
  // Aufgehen der Wolke (hidden fällt) meldet der ResizeObserver; sicherheitshalber auch so:
  new MutationObserver(bald).observe(wolke, { attributes: true, attributeFilter: ["hidden"] });
})();
