/* Der Fernseher — die Note als Fernbedienung.
   Ein Knopf über dem Begleiter, den nur sieht, wer einen eigenen Empfänger
   eingerichtet hat (Adresse + Schlüssel im localStorage, gesetzt über
   `#fernseher=…`, siehe Kopf.astro). In dieser Datei steht keine Adresse und
   kein Schlüssel; für alle anderen tut sie nichts, nicht einmal eine Anfrage.
   Ist der Knopf an, spielen Zeitstempel, Zitate und ▶ nicht im Begleiter,
   sondern am Fernseher — man liest am Telefon, es klingt im Wohnzimmer. */
(() => {
  let ziel;
  try { ziel = JSON.parse(localStorage.getItem("gw-fernseher")); } catch {}
  const begleiter = document.getElementById("begleiter");
  if (!ziel?.u || !ziel?.k || !begleiter) return;

  const rufen = (pfad, daten) => fetch(ziel.u + pfad, {
    method: daten ? "POST" : "GET",
    headers: { Authorization: `Bearer ${ziel.k}`, ...(daten && { "Content-Type": "application/json" }) },
    body: daten && JSON.stringify(daten),
    signal: AbortSignal.timeout(4000),
  }).then((r) => (r.ok ? r : Promise.reject(new Error(String(r.status)))));

  const knopf = document.createElement("button");
  knopf.type = "button";
  knopf.className = "fernseher";
  knopf.setAttribute("aria-pressed", "false");
  knopf.title = "Am Fernseher hören — die Marken spielen dann im Wohnzimmer";
  knopf.innerHTML =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2.5" y="4.5" width="19" height="12.5" rx="2"/>' +
    '<path d="M8 20.5h8M12 17v3.5"/></svg>';

  let an = false;

  function stellen(wert) {
    an = wert;
    knopf.setAttribute("aria-pressed", String(an));
    document.body.classList.toggle("fernsieht", an);
  }

  function melden(text, fehler = false) {
    knopf.dataset.zeit = text;
    knopf.classList.toggle("fernseher--fehler", fehler);
    knopf.classList.remove("fernseher--puls");
    void knopf.offsetWidth;          // die Animation neu anstoßen
    knopf.classList.add("fernseher--puls");
  }

  async function senden(t, v, quelle) {
    v = v || begleiter.dataset.video;
    document.querySelectorAll(".klingt").forEach((e) => e.classList.remove("klingt"));
    quelle?.classList.add("klingt");
    try {
      await rufen("/spielen", { v, t: Math.floor(t) });
      melden(mmss(t));
    } catch {
      melden("nicht erreichbar", true);
    }
  }

  knopf.addEventListener("click", async () => {
    if (an) {
      stellen(false);
      document.querySelectorAll(".klingt").forEach((e) => e.classList.remove("klingt"));
      rufen("/pause", {}).catch(() => {});
      melden("angehalten");
      return;
    }
    if (begleiter.classList.contains("offen")) schliessen();
    stellen(true);
    const a = lesestelle();
    await senden(a ? +a.dataset.t : 0, a?.dataset.v, a);
  });

  /* Im Fangschritt, vor dem Leser: Ist der Fernseher an, erreicht der Klick
     den Begleiter gar nicht erst. */
  document.addEventListener("click", (e) => {
    if (!an) return;
    const marke = e.target.closest(".ts[data-t], .oton[data-t]");
    if (marke) {
      e.stopPropagation();
      senden(+marke.dataset.t, marke.dataset.v, marke);
    } else if (e.target.closest("#begleiter")) {
      e.stopPropagation();
      const a = lesestelle();
      senden(a ? +a.dataset.t : 0, a?.dataset.v, a);
    }
  }, true);

  // Erst zeigen, wenn der Empfänger antwortet — unterwegs ohne Tailnet bleibt alles wie immer.
  // Ein zweiter Versuch, weil die erste Anfrage nach dem Aufwachen des Tunnels gern zu spät kommt.
  rufen("/da")
    .catch(() => new Promise((r) => setTimeout(r, 1500)).then(() => rufen("/da")))
    .then(() => document.body.appendChild(knopf))
    .catch(() => {});
})();
