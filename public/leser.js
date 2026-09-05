/* Der Leser — Zeitleiste, Vorschaubilder, Begleiter-Player.
   Bewusst ohne Framework: das hier ist Verhalten am fertigen Dokument,
   keine Zustandsverwaltung. */

const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

const rail = document.getElementById("rail");
const anker = [...document.querySelectorAll("[data-t]")];

/* ── Zeitleiste ──
   Die Marken sitzen auf ihrer Position IM GESPRÄCH, nicht im Text. Beim
   Scrollen springt der Zeiger — und macht sichtbar, dass eine Note eine
   Komposition ist und keine Mitschrift. */
if (rail && anker.length) {
  const DAUER = Number(rail.dataset.dauer) || 1;
  const oben = 88, unten = 88;
  const yVon = (t) => `calc(${oben}px + (100% - ${oben + unten}px) * ${t / DAUER})`;
  const marken = new Map();

  [...new Set(anker.map((a) => +a.dataset.t))].sort((a, b) => a - b).forEach((t) => {
    const m = document.createElement("div");
    m.className = "mark";
    m.style.top = yVon(t);
    m.title = mmss(t);
    m.onclick = () => anker.find((a) => +a.dataset.t === t)
      ?.scrollIntoView({ block: "center" });
    rail.appendChild(m);
    marken.set(t, m);
  });

  const zeiger = document.createElement("div");
  zeiger.className = "zeiger";
  zeiger.innerHTML = '<span class="zeiger__zeit"></span>';
  zeiger.style.top = yVon(+anker[0].dataset.t);
  rail.appendChild(zeiger);
  const zeigerZeit = zeiger.querySelector(".zeiger__zeit");

  let aktiv = null;
  const verfolgen = () => {
    const mitte = innerHeight * 0.42;
    let beste = null, dist = Infinity;
    for (const a of anker) {
      const r = a.getBoundingClientRect();
      if (r.top > innerHeight || r.bottom < 0) continue;
      const d = Math.abs(r.top - mitte);
      if (d < dist) { dist = d; beste = a; }
    }
    if (!beste || beste === aktiv) return;
    aktiv = beste;
    const t = +beste.dataset.t;
    marken.forEach((m) => m.classList.remove("ist"));
    marken.get(t)?.classList.add("ist");
    zeiger.style.top = yVon(t);
    zeigerZeit.textContent = mmss(t);
  };
  addEventListener("scroll", verfolgen, { passive: true });
  verfolgen();
}

/* ── Vorschaubild am Zeitstempel ──
   Aus YouTubes eigenem Storyboard geschnitten. Fehlt der Frame, bleibt der
   Zeitstempel ein Zeitstempel — kein kaputtes Bild. */
const guck = document.getElementById("guck");
const guckBild = document.getElementById("guckBild");
const guckZeit = document.getElementById("guckZeit");
const videoId = document.getElementById("begleiter")?.dataset.video;

guckBild?.addEventListener("error", () => guck.classList.remove("da"));

document.querySelectorAll(".ts").forEach((ts) => {
  ts.addEventListener("mouseenter", () => {
    if (!videoId) return;
    // Die API schon beim Überfahren holen, nicht erst beim Klick. Safari
    // lässt die Nutzergeste über ein `await` hinweg verfallen — wenn die API
    // beim Klick bereitliegt, bleibt das Gestenfenster intakt.
    apiLaden().catch(() => {});
    const t = ts.dataset.t;
    guckBild.src = `/frames/${videoId}/${t}.jpg`;
    guckZeit.textContent = `bei ${mmss(+t)} — klicken zum Hören`;
    const r = ts.getBoundingClientRect();
    guck.style.left = Math.max(80, r.left - 216) + "px";
    guck.style.top = Math.min(innerHeight - 186, Math.max(12, r.top - 14)) + "px";
    guck.classList.add("da");
  });
  ts.addEventListener("mouseleave", () => guck.classList.remove("da"));
  ts.addEventListener("click", () => spielen(+ts.dataset.t, ts));
});

document.querySelectorAll(".oton[data-t]").forEach((q) => {
  q.addEventListener("click", () =>
    spielen(+q.dataset.t, q, q.dataset.ende ? +q.dataset.ende : null));
});

/* ── Begleiter-Player ──
   Lädt erst beim ersten Klick — vorher liegt hier kein YouTube-Byte und kein
   Cookie. Danach echtes seekTo() statt Neuladen, damit der Lesefluss hält. */
const begleiter = document.getElementById("begleiter");
const beiZeit = document.getElementById("beiZeit");
let player = null, bereit = false, wartet = null;

let apiVersprechen = null;

/* Werbeblocker und strenger Tracking-Schutz sperren `iframe_api` gelegentlich
   ganz. Ohne Frist bliebe das Versprechen für immer offen — der Begleiter
   klappte auf und bliebe leer, ohne Fehler, ohne Hinweis. Also mit Frist. */
function apiLaden() {
  if (apiVersprechen) return apiVersprechen;
  apiVersprechen = new Promise((fertig, scheitern) => {
    if (window.YT?.Player) return fertig();
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    s.onerror = () => scheitern(new Error("blockiert"));
    const frist = setTimeout(() => scheitern(new Error("Zeitüberschreitung")), 6000);
    window.onYouTubeIframeAPIReady = () => { clearTimeout(frist); fertig(); };
    document.head.appendChild(s);
  });
  return apiVersprechen;
}

/** Wenn der Player nicht kommt: sagen, was los ist, und den Weg offen lassen. */
function ersatzweg(t) {
  const buehne = document.getElementById("buehne");
  if (!buehne) return;
  const url = `https://www.youtube.com/watch?v=${begleiter.dataset.video}&t=${t}`;
  buehne.innerHTML =
    '<div class="begleiter__ersatz">Der YouTube-Player wird auf diesem Gerät blockiert ' +
    '— vermutlich durch einen Inhaltsblocker.<br>' +
    `<a href="${url}" target="_blank" rel="noopener">Stelle bei ${mmss(t)} auf YouTube öffnen →</a></div>`;
}

/* Stoppuhr fürs Zitat: Kennen wir das Ende der Passage, hält der Player dort
   an. Das ist der Unterschied zwischen „Hören" (genau dieser Satz) und
   „Im Gespräch" (einsteigen und weiterlaufen lassen). */
let stoppUhr = null;
function bisStoppen(ende) {
  clearInterval(stoppUhr);
  if (ende == null) return;
  stoppUhr = setInterval(() => {
    if (!player?.getCurrentTime) return;
    if (player.getCurrentTime() >= ende) {
      player.pauseVideo();
      clearInterval(stoppUhr);
      stoppUhr = null;
      document.querySelectorAll(".klingt").forEach((e) => e.classList.remove("klingt"));
    }
  }, 200);
}

async function spielen(t, quelle, ende = null) {
  if (!begleiter) return;
  begleiter.classList.add("offen");
  beiZeit.textContent = mmss(t);
  document.querySelectorAll(".klingt").forEach((e) => e.classList.remove("klingt"));
  quelle?.classList.add("klingt");
  document.querySelectorAll(`.ts[data-t="${t}"]`).forEach((e) => e.classList.add("klingt"));

  try {
    await apiLaden();
  } catch {
    ersatzweg(t);
    return;
  }

  if (!player) {
    wartet = { t, ende };
    player = new YT.Player("buehne", {
      videoId: begleiter.dataset.video,
      host: "https://www.youtube-nocookie.com",
      playerVars: { start: t, autoplay: 1, rel: 0, modestbranding: 1 },
      events: {
        onReady: () => {
          bereit = true;
          if (wartet !== null) { player.seekTo(wartet.t, true); player.playVideo(); }
          bisStoppen(wartet ? wartet.ende : ende);
          wartet = null;
        },
      },
    });
  } else if (bereit) {
    player.seekTo(t, true);
    player.playVideo();
    bisStoppen(ende);
  } else {
    wartet = { t, ende };
  }
}

begleiter?.addEventListener("click", () => {
  if (!begleiter.classList.contains("offen") && anker.length) {
    spielen(+anker[0].dataset.t, null);
  }
});
document.getElementById("zu")?.addEventListener("click", (e) => {
  e.stopPropagation();
  begleiter.classList.remove("offen");
  player?.pauseVideo?.();
  document.querySelectorAll(".klingt").forEach((el) => el.classList.remove("klingt"));
});

/* ── Hell / Dunkel ──
   Das Thema selbst setzt der Vorspann im Kopf, noch vor dem ersten Bild —
   hier steht nur noch, was auf einen Klick hin passiert. */
const knopf = document.getElementById("theme");
if (knopf) {
  const marke = document.getElementById("wortmarke");
  const anschrift = (t) => (knopf.textContent = t === "dunkel" ? "Hell" : "Dunkel");
  anschrift(document.documentElement.dataset.theme);

  knopf.onclick = () => {
    const neu = document.documentElement.dataset.theme === "dunkel" ? "hell" : "dunkel";
    document.documentElement.dataset.theme = neu;
    anschrift(neu);
    localStorage.setItem("gw-theme", neu);
    // Die Wortmarke ist gemalt, nicht gesetzt — sie hat für jedes Thema
    // ein eigenes Bild und kann nicht einfach die Farbe wechseln.
    if (marke) marke.src = `/wortmarke/wordmark-${marke.dataset.stil}-${neu === "dunkel" ? "dark" : "light"}.png`;
  };
}

/* ── Die eigene Spur ──
   Der Browser-Zurück-Knopf kann das auch — aber er zeigt nicht, wohin er
   führt. Hier steht der Titel der Station, von der man kam: man muss sich
   nicht erinnern, sondern liest es ab.

   Im sessionStorage, nicht im localStorage: Eine Spur gehört zu einem
   Besuch. Wer morgen wiederkommt, fängt neu an zu gehen. */
{
  const SPUR = "gw-spur";
  try {
    const hier = location.pathname;
    let spur = JSON.parse(sessionStorage.getItem(SPUR) || "[]");

    /* Ist man zurückgegangen, steht die aktuelle Seite schon in der Spur.
       Dann wird sie gekürzt statt verlängert — sonst wüchse sie beim
       Hin und Her endlos und zeigte als „woher" die Seite, die man gerade
       verlassen hat, also den Weg vorwärts. */
    const schon = spur.findIndex((s) => s.url === hier);
    if (schon >= 0) spur = spur.slice(0, schon);

    const vorher = spur[spur.length - 1];
    const pille = document.getElementById("kopfleisteSpur");
    if (pille && vorher) {
      pille.href = vorher.url;
      /* Zur Startseite führt die Wortmarke daneben auch — aber sie sagt
         nicht, dass es ein *Zurück* ist. Und darauf kommt es an: Das Feld
         merkt sich, wo man stand, also kommt man nicht auf eine Startseite,
         sondern an seinen Platz. Der Titel wäre hier keine Auskunft, das
         Wort „zurück" ist eine. */
      pille.textContent = vorher.url === "/" ? "← Zurück ins Feld" : `← ${vorher.titel}`;
      pille.hidden = false;
    }

    const titel = document.querySelector("#text h1, .blatt h1")?.textContent?.trim()
      || document.title.split(" · ")[0];
    spur.push({ url: hier, titel });
    // Fünfundzwanzig reichen für jeden Besuch; die Spur soll den Speicher
    // nicht vollschreiben.
    sessionStorage.setItem(SPUR, JSON.stringify(spur.slice(-25)));
  } catch { /* Privater Modus: dann eben ohne Spur. */ }
}

/* ── Stern und Nachbarschaft sind zwei Ansichten derselben Sache ──
   Der Stern zeigt das Netz, der Kasten rechts die geschriebenen Gründe.
   Bisher standen sie unverbunden nebeneinander: Wer im Sternbild einen
   Namen fand, musste ihn im Kasten von Hand suchen.

   Jetzt zeigt das Berühren des einen auf das andere — und der Kasten
   rollt die passende Stelle heran. Nur berühren, nicht klicken: Ein
   Sternknoten ist ein Link, und der soll weiterhin dorthin führen, wohin
   er zeigt.

   Nicht jeder Knoten hat einen Eintrag. Der Stern kennt auch Nähen, die
   nie jemand aufgeschrieben hat (geteilte Quellen) — für die gibt es
   keinen Grund im Kasten, und dann passiert eben nichts. */
{
  const halt = document.querySelector(".verwandt__halt");
  const knoten = [...document.querySelectorAll(".stern a.knoten")];

  // Auch ohne Stern: Die Lesezeile unten braucht nur den Kasten.
  if (halt) {
    const weg = (u) => { try { return new URL(u, location.href).pathname.replace(/\/$/, ""); } catch { return null; } };

    const eintraege = new Map();
    for (const li of halt.querySelectorAll(".verwandt__liste li")) {
      const a = li.querySelector("a[href]");
      const p = a && weg(a.getAttribute("href"));
      if (p) eintraege.set(p, li);
    }
    const sterne = new Map();
    for (const k of knoten) {
      const p = weg(k.getAttribute("href"));
      if (p && !sterne.has(p)) sterne.set(p, k);
    }

    const kopfHoehe = halt.querySelector(".verwandt__kopf")?.offsetHeight ?? 0;
    let gemerkt = null;

    function zeigenAuf(pfad, { rollen = true } = {}) {
      if (pfad === gemerkt) return;
      gemerkt = pfad;
      for (const li of eintraege.values()) li.classList.remove("ist-nah");
      for (const k of sterne.values()) k.classList.remove("ist-nah");
      if (!pfad) return;

      eintraege.get(pfad)?.classList.add("ist-nah");
      sterne.get(pfad)?.classList.add("ist-nah");

      const li = eintraege.get(pfad);
      if (!li || !rollen) return;
      /* Von Hand gerollt statt `scrollIntoView`: Das würde bei Bedarf auch
         die ganze Seite verschieben, und dann wandert einem der Stern unter
         dem Zeiger weg. Hier rollt nur der Kasten. */
      halt.scrollTo({ top: Math.max(0, li.offsetTop - kopfHoehe - 12), behavior: "smooth" });
    }

    /* ── Der Text zeigt auch ──
       Die dritte Quelle für „nah", und die einzige, die ohne Maus
       auskommt: Wo der Text gerade auf eine der Nachbarn verweist, geht
       drüben ihr Eintrag auf. Gemessen wird an der Lesezeile — etwas
       über der Mitte des Fensters, dort ruht das Auge beim Lesen —, und
       es gilt der Verweis, der ihr am nächsten liegt, solange er im
       Fenster steht. Kein Verweis im Fenster: nichts offen. So sieht
       man beim Lesen, dass der Kasten *mitliest*, statt nur dazustehen.

       Die Maus hat Vorrang: Solange sie über Stern oder Kasten liegt,
       schweigt die Lesezeile, und wenn sie geht, übernimmt die Lesezeile
       wieder — statt auf „nichts" zurückzufallen. */
    const verweise = [...document.querySelectorAll("#text .wikilink[data-note]")]
      .map((a) => ({ a, p: weg(a.dataset.note) }))
      .filter(({ p }) => p && eintraege.has(p));
    let ausText = null, schwebt = false, angefragt = false;

    function lesezeileMessen() {
      angefragt = false;
      const oben = kopfHoehe + 40, unten = innerHeight * .88;
      const zeile = innerHeight * .4;
      let best = null, abstand = Infinity;
      for (const { a, p } of verweise) {
        const r = a.getBoundingClientRect();
        if (r.bottom < oben || r.top > unten) continue;
        const d = Math.abs((r.top + r.bottom) / 2 - zeile);
        if (d < abstand) { abstand = d; best = p; }
      }
      ausText = best;
      if (!schwebt) zeigenAuf(ausText);
    }
    if (verweise.length) {
      const anstossen = () => { if (!angefragt) { angefragt = true; requestAnimationFrame(lesezeileMessen); } };
      addEventListener("scroll", anstossen, { passive: true });
      addEventListener("resize", anstossen, { passive: true });
      lesezeileMessen();
      // Der Verweis im Text selbst berührt: derselbe Griff wie am Stern.
      for (const { a, p } of verweise) {
        a.addEventListener("pointerenter", () => { schwebt = true; zeigenAuf(p); });
        a.addEventListener("pointerleave", () => { schwebt = false; zeigenAuf(ausText); });
      }
    }

    for (const k of knoten) {
      const p = weg(k.getAttribute("href"));
      k.addEventListener("pointerenter", () => { schwebt = true; zeigenAuf(p); });
    }
    document.querySelector(".stern")?.addEventListener("pointerleave", () => { schwebt = false; zeigenAuf(ausText); });

    // Andersherum genauso: Wer im Kasten liest, sieht im Bild, wo es steht.
    for (const [p, li] of eintraege) {
      li.addEventListener("pointerenter", () => {
        schwebt = true;
        zeigenAuf(p, { rollen: false });   // ohne Rollen — man ist ja schon da
      });
    }
    halt.addEventListener("pointerleave", () => { schwebt = false; zeigenAuf(ausText); });
  }
}

/* ── Die Rubrikwahl ──
   Ein Klappmenü und nicht zehn Reiter nebeneinander: Zehn Rubriken im
   Kopf wären eine zweite Zeile, und die Kopfleiste soll eine bleiben. */
{
  const wahl = document.getElementById("rubrikwahl");
  const knopf = wahl?.querySelector(".rubrikwahl__knopf");
  const liste = document.getElementById("rubrikwahlListe");

  if (wahl && knopf && liste) {
    const stellen = (offen) => {
      liste.hidden = !offen;
      knopf.setAttribute("aria-expanded", String(offen));
      wahl.toggleAttribute("data-offen", offen);
    };

    knopf.addEventListener("click", (e) => {
      e.stopPropagation();       // sonst schließt der Klick sofort wieder
      stellen(liste.hidden);
    });

    // Wer danebenklickt, will weg — das muss man nicht erst lernen.
    addEventListener("click", (e) => { if (!wahl.contains(e.target)) stellen(false); });
    addEventListener("keydown", (e) => { if (e.key === "Escape") stellen(false); });
  }
}

/* ── Die Kopfleiste bekommt ihren Grund ──
   Oben liegt sie ohne Kante im Papier. Sobald Text unter ihr durchläuft,
   braucht sie einen Untergrund, sonst liefe der Satz durch die Marke. */
{
  const stand = () => document.body.classList.toggle("ist-gescrollt", scrollY > 12);
  stand();
  addEventListener("scroll", stand, { passive: true });
}

/* ── Die Malerhand unter dem Bild ──
   Im Markdown steht der 🎨-Block direkt unter dem Banner-Embed: die
   Künstlerhand, für die sich `gedankenart` entschieden hat, samt Prompt.
   Das Layout zieht das Bild aber in den Kopf — und ließ das Osterei
   allein zwischen Titel und Quelle zurück, wo es nichts erklärt.
   Hier geht es dorthin zurück, wo es hingehört: als Bildnachweis unter
   das Bild. Ohne Javascript bleibt es im Text stehen, wo es lesbar ist,
   nur eben unbegleitet. */
{
  const kennung = document.querySelector(".blatt > header .kennung");
  const osterei = [...document.querySelectorAll("#text > details")]
    .find((d) => (d.querySelector("summary")?.textContent ?? "").includes("🎨"));
  if (kennung && osterei && document.querySelector(".banner")) {
    osterei.classList.add("malerhand");
    // Ans Ende der Kennzeile, rechts außen — nicht als eigene Zeile.
    kennung.append(osterei);
  }
}
