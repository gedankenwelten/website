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
/* ── Die Lesestelle ──
   Die Marke, an der das Auge gerade ruht: die nächste an der Lesezeile
   (etwas über der Mitte). Steht keine im Fenster, gilt die letzte, an der
   man schon vorbei ist — man liest ja in ihrem Abschnitt weiter. Zeitleiste,
   Tastenkürzel und ▶-Knopf fragen alle hier nach, damit sie dasselbe meinen. */
function lesestelle() {
  const mitte = innerHeight * 0.42;
  let beste = null, dist = Infinity, zuletzt = null;
  for (const a of anker) {
    const r = a.getBoundingClientRect();
    if (r.top < mitte) zuletzt = a;
    if (r.top > innerHeight || r.bottom < 0) continue;
    const d = Math.abs(r.top - mitte);
    if (d < dist) { dist = d; beste = a; }
  }
  return beste || zuletzt || anker[0] || null;
}

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
    const beste = lesestelle();
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
    guckBild.src = `/frames/${ts.dataset.v || videoId}/${t}.jpg`;
    guckZeit.textContent = begleiter?.classList.contains("offen") && ts.classList.contains("klingt")
      ? `bei ${mmss(+t)} — klicken schließt`
      : `bei ${mmss(+t)} — klicken zum Hören`;
    const r = ts.getBoundingClientRect();
    guck.style.left = Math.max(80, r.left - 216) + "px";
    guck.style.top = Math.min(innerHeight - 186, Math.max(12, r.top - 14)) + "px";
    guck.classList.add("da");
  });
  ts.addEventListener("mouseleave", () => guck.classList.remove("da"));
  ts.addEventListener("click", () => {
    if (klingtSchon(ts)) { schliessen(); guck.classList.remove("da"); return; }
    spielen(+ts.dataset.t, ts, null, ts.dataset.v);
  });
});

document.querySelectorAll(".oton[data-t]").forEach((q) => {
  q.addEventListener("click", () => {
    if (klingtSchon(q)) return schliessen();
    spielen(+q.dataset.t, q, q.dataset.ende ? +q.dataset.ende : null, q.dataset.v);
  });
});

/* Dieselbe Marke noch einmal: dann will man ihn weghaben — der Weg nach
   rechts unten zum „schließen" ist weit, die Marke liegt unter der Hand.
   Ein verklungenes Zitat (am Ende angehalten, nicht mehr `klingt`) spielt
   dagegen wieder von vorn. */
function klingtSchon(el) {
  return begleiter?.classList.contains("offen") && el.classList.contains("klingt");
}

/* ── Begleiter-Player ──
   Lädt erst beim ersten Klick — vorher liegt hier kein YouTube-Byte und kein
   Cookie. Danach echtes seekTo() statt Neuladen, damit der Lesefluss hält.
   Zitiert eine Note mehrere Videos, trägt jede fremde Marke `data-v`; dann
   wechselt der Player das Video, statt im falschen die Sekunde zu suchen. */
const begleiter = document.getElementById("begleiter");
const beiZeit = document.getElementById("beiZeit");
let player = null, bereit = false, wartet = null, laeuft = null;

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
function ersatzweg(t, v) {
  const buehne = document.getElementById("buehne");
  if (!buehne) return;
  const url = `https://www.youtube.com/watch?v=${v}&t=${t}`;
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

/** Ans Ziel: im laufenden Video spulen, in einem anderen erst wechseln. */
function hin(t, v) {
  if (v === laeuft) { player.seekTo(t, true); player.playVideo(); }
  else { player.loadVideoById({ videoId: v, startSeconds: t }); laeuft = v; }
}

async function spielen(t, quelle, ende = null, v = null) {
  if (!begleiter) return;
  v = v || begleiter.dataset.video;
  begleiter.classList.add("offen");
  beiZeit.textContent = mmss(t);
  document.querySelectorAll(".klingt").forEach((e) => e.classList.remove("klingt"));
  quelle?.classList.add("klingt");
  document.querySelectorAll(`.ts[data-t="${t}"]`).forEach((e) => {
    if ((e.dataset.v || begleiter.dataset.video) === v) e.classList.add("klingt");
  });

  try {
    await apiLaden();
  } catch {
    ersatzweg(t, v);
    return;
  }

  if (!player) {
    wartet = { t, ende, v };
    laeuft = v;
    player = new YT.Player("buehne", {
      videoId: v,
      host: "https://www.youtube-nocookie.com",
      playerVars: { start: t, autoplay: 1, rel: 0, modestbranding: 1 },
      events: {
        onReady: () => {
          bereit = true;
          if (wartet !== null) hin(wartet.t, wartet.v);
          bisStoppen(wartet ? wartet.ende : ende);
          wartet = null;
        },
      },
    });
  } else if (bereit) {
    hin(t, v);
    bisStoppen(ende);
  } else {
    wartet = { t, ende, v };
  }
}

function schliessen() {
  if (!begleiter) return;
  begleiter.classList.remove("offen");
  player?.pauseVideo?.();
  clearInterval(stoppUhr);
  document.querySelectorAll(".klingt").forEach((el) => el.classList.remove("klingt"));
}

/* Auf, wo man gerade liest — nicht am Anfang des Gesprächs. Wer auf halber
   Strecke hören will, meint diese Stelle, nicht die erste Marke. */
function amLesenOeffnen() {
  const a = lesestelle();
  if (a) spielen(+a.dataset.t, a, null, a.dataset.v);
}

begleiter?.addEventListener("click", () => {
  if (!begleiter.classList.contains("offen")) amLesenOeffnen();
});
document.getElementById("zu")?.addEventListener("click", (e) => {
  e.stopPropagation();
  schliessen();
});

/* ── Das Tastenkürzel ──
   Eine Taste auf, dieselbe Taste zu. Auf geht es an der Lesestelle — dort,
   wo der Zeiger in der Zeitleiste gerade steht. Esc schließt auch, aber nur,
   wenn nichts anderes offen ist, das Esc für sich meint (Vorschau, Stern). */
if (begleiter && anker.length) {
  const TASTE = begleiter.dataset.taste || "p";
  const tippt = (el) => el?.closest?.("input, textarea, select, [contenteditable]:not([contenteditable=false])");
  addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || e.repeat || e.defaultPrevented || tippt(e.target)) return;
    if (e.key.toLowerCase() === TASTE) {
      e.preventDefault();
      begleiter.classList.contains("offen") ? schliessen() : amLesenOeffnen();
    } else if (e.key === "Escape" && begleiter.classList.contains("offen")) {
      const schau = document.getElementById("schau");
      const anderes = (schau && !schau.hidden)
        || document.querySelector(".stern-buehne.offen, #rubrikwahl[data-offen], #anzeige[data-offen], dialog[open]");
      if (!anderes) schliessen();
    }
  });
}

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

/* ── Der Schriftgrad ──
   Drei Stufen, gemerkt im Browser. Den Zustand setzt der Vorspann vor dem
   ersten Bild; hier wird nur markiert, was gilt, und umgestellt. */
// Nur die Knöpfe — `[data-schrift]` allein träfe auch <html>, das den
// gewählten Grad trägt: Jeder Klick irgendwo auf der Seite liefe dann als
// „Umschalten" bis dorthin hoch und schriebe Unsinn in den Speicher.
const grade = [...document.querySelectorAll("button[data-schrift]")];
if (grade.length) {
  const zeigen = () => {
    const g = document.documentElement.dataset.schrift || "mittel";
    grade.forEach((b) => b.classList.toggle("ist", b.dataset.schrift === g));
  };
  zeigen();
  grade.forEach((b) => b.addEventListener("click", () => {
    const g = b.dataset.schrift;
    if (g === "mittel") delete document.documentElement.dataset.schrift;
    else document.documentElement.dataset.schrift = g;
    try { g === "mittel" ? localStorage.removeItem("gw-schrift") : localStorage.setItem("gw-schrift", g); } catch {}
    zeigen();
  }));
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

/* ── Die Vorschau ──
   Die Seite wird geholt und ihr Anfang gezeigt — Kopf, Aufmacher und so
   viel Text, wie man im Vorbeigehen liest. Wer weiterwill, hat unten den
   Weg; wer nicht, hat nichts verloren. Startseite (Griff an der Karte)
   und Note (Klick im Stern) teilen sich das Stück; das Markup steht in
   `components/Schau.astro`, die Gestalt in `styles/schau.css`.

   Zwei Formen: als Kärtchen in der Mitte (Startseite) oder als großes
   Blatt vom unteren Rand (`unten`, aus dem Stern) — und dort mit dem
   Satz darüber, *warum* die beiden Notes verbunden sind (`grund`). */
window.gwSchau = (() => {
  const schau = document.getElementById("schau");
  if (!schau) return { oeffnen() {}, schliessen() {} };
  const inhalt = document.getElementById("schauInhalt");
  const weiter = document.getElementById("schauWeiter");
  const grundZeile = document.getElementById("schauGrund");
  const blatt = schau.querySelector(".schau__blatt");
  const geholt = new Map();     // schon geholte Anfänge, je Adresse
  let laeuft = 0;               // gegen überholende Anfragen
  let zuvorFokus = null;

  function schliessen() {
    if (schau.hidden) return;
    schau.hidden = true;
    document.body.style.overflow = "";
    zuvorFokus?.focus?.({ preventScroll: true });
    zuvorFokus = null;
  }

  async function oeffnen(url, { unten = false, grund = null } = {}) {
    const lauf = ++laeuft;
    zuvorFokus = document.activeElement;
    schau.classList.toggle("schau--unten", unten);
    if (grundZeile) {
      grundZeile.classList.remove("ist-offen");
      grundZeile.hidden = !grund;
      grundZeile.querySelector("span").textContent = grund ?? "";
    }
    schau.hidden = false;
    document.body.style.overflow = "hidden";
    weiter.href = url;
    weiter.textContent = unten ? "Zur Note →" : "Ganz lesen →";
    blatt.scrollTop = 0;
    blatt.tabIndex = -1;
    blatt.focus({ preventScroll: true });

    const schluessel = `${unten ? "ganz" : "anfang"}:${url}`;
    if (geholt.has(schluessel)) { inhalt.replaceChildren(geholt.get(schluessel).cloneNode(true)); return; }
    inhalt.innerHTML = '<p class="schau__laedt">wird geholt …</p>';

    let seite;
    try {
      seite = new DOMParser().parseFromString(await (await fetch(url)).text(), "text/html");
    } catch {
      // Ehrlich sagen, dass es nicht ging — ein leeres Fenster sieht aus
      // wie eine Note ohne Inhalt.
      if (lauf === laeuft) inhalt.innerHTML = '<p class="schau__laedt">Der Anfang ließ sich nicht holen.</p>';
      return;
    }
    if (lauf !== laeuft) return;    // inzwischen wurde eine andere geöffnet

    const stueck = document.createElement("div");
    const kopf = seite.querySelector(".blatt > header");
    if (kopf) stueck.append(kopf);
    // Der Text bekommt seinen Umschlag wieder — die Regeln für Links,
    // Absätze und Zitate hängen alle an `.strang`.
    const text = document.createElement("div");
    text.className = "strang";
    stueck.append(text);

    /* Auf der Startseite so viel Text, wie man im Vorbeigehen liest —
       nicht nach Absätzen gezählt, sondern nach Zeichen: ein Aufmacher-
       Callout wiegt so viel wie fünf kurze Zwischenüberschriften. Aus dem
       Stern heraus dagegen **die ganze Note** (Andreas, 05.09.): Man soll
       sie dort lesen können, nur ohne den Bestand — der Stern, aus dem
       man kommt, steht ja schon unter einem. */
    let last = 0;
    const genug = unten ? Infinity : 1600;
    for (const kind of [...(seite.getElementById("text")?.children ?? [])]) {
      if (last > genug) break;
      // Das 🎨-Osterei ist ein Bildnachweis, keine Lektüre.
      if (kind.tagName === "DETAILS" || kind.classList.contains("marken-zeile") || kind.hidden) continue;
      last += kind.textContent.length;
      text.append(kind);
    }

    geholt.set(schluessel, stueck);
    if (lauf === laeuft) inhalt.replaceChildren(stueck.cloneNode(true));
  }

  for (const el of schau.querySelectorAll("[data-schau-zu]")) el.addEventListener("click", schliessen);
  grundZeile?.addEventListener("click", () => grundZeile.classList.toggle("ist-offen"));
  addEventListener("keydown", (e) => { if (e.key === "Escape" && !schau.hidden) { e.stopImmediatePropagation(); schliessen(); } });
  return { oeffnen, schliessen };
})();

/* ── Der Stern als Griff ──
   Der Stern steht am Fuß, und der Fuß liegt bei langen Notes 30.000 px
   tief. Darum ein Griff am unteren Rand, sobald man zu lesen begonnen
   hat: Er hebt eine Bühne mit *demselben* Stern hoch — ein Klon des
   Sternbilds vom Fuß, gebaut, bevor das Stern-Skript (ein Modul, läuft
   nach diesem hier) seine Berührungen verdrahtet: So hört der Klon
   genauso zu wie das Original, und die Kopplung mit dem Kasten rechts
   kennt beide.

   Kommt man unten beim echten Stern an, geht die Bühne von selbst zu und
   der Griff verschwindet. Dann sitzt der Stern in der Seite, wie gehabt —
   die Bühne war nur der Vorgriff darauf. (Andreas, 05.09.) */
{
  const original = document.querySelector("section.stern");
  if (original && !document.body.classList.contains("ist-start")) {
    const zahl = original.querySelectorAll("a.knoten").length;
    const zeichen = `<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="1.9" fill="currentColor"/><circle cx="2.6" cy="4" r="1.3" fill="currentColor" opacity=".55"/><circle cx="13.4" cy="5" r="1.3" fill="currentColor" opacity=".55"/><circle cx="4" cy="13" r="1.3" fill="currentColor" opacity=".55"/><circle cx="12.6" cy="12.4" r="1.3" fill="currentColor" opacity=".55"/><g stroke="currentColor" stroke-width=".9" opacity=".4"><path d="M8 8 L2.6 4M8 8 L13.4 5M8 8 L4 13M8 8 L12.6 12.4"/></g></svg>`;

    const buehne = document.createElement("div");
    buehne.className = "stern-buehne";
    buehne.id = "sternBuehne";
    buehne.innerHTML = `<div class="stern-buehne__schleier"></div>
      <div class="stern-buehne__blatt" role="dialog" aria-label="Im Bestand" aria-modal="false">
        <div class="stern-buehne__leiste"><b>Im Bestand</b><i>${zahl}</i>
          <button class="stern-buehne__zu" type="button">schließen</button></div>
      </div>`;
    const klon = original.cloneNode(true);
    klon.removeAttribute("id");
    const blatt = buehne.querySelector(".stern-buehne__blatt");
    blatt.tabIndex = -1;
    blatt.append(klon);

    const griff = document.createElement("button");
    griff.type = "button";
    griff.className = "stern-griff weg";
    griff.id = "sternGriff";
    griff.setAttribute("aria-expanded", "false");
    griff.setAttribute("aria-controls", "sternBuehne");
    griff.title = "Was um diese Note herum liegt";
    griff.innerHTML = `${zeichen}<span>Im Bestand</span><i>${zahl}</i>`;

    document.body.append(buehne, griff);

    let offen = false, unten = false;
    const bewegt = !matchMedia("(prefers-reduced-motion: reduce)").matches;

    /* Ankunft auf der Bühne: erst hebt sich das Blatt, dann treten die
       Knoten aus der Mitte — dieselbe Bewegung wie unten beim
       Hereinscrollen, nur ausgelöst vom Griff. Beim Schließen wird sie
       zurückgenommen, damit sie beim nächsten Öffnen wieder da ist. */
    const ankommen = () => {
      if (!bewegt) return;
      klon.classList.remove("da");
      setTimeout(() => klon.classList.add("da"), 160);
    };
    const griffZeigen = () => {
      const zeigen = !offen && !unten && scrollY > 480;
      griff.classList.toggle("weg", !zeigen);
    };
    const auf = () => {
      if (offen) return;
      offen = true;
      buehne.classList.add("offen");
      griff.setAttribute("aria-expanded", "true");
      griffZeigen();
      ankommen();
      // Das Blatt bekommt den Fokus — von dort geht es mit Tab in den Stern.
      // Nicht der Schließen-Knopf: Der bekäme vom Browser den Tastatur-Ring,
      // obwohl niemand eine Taste gedrückt hat.
      blatt.focus({ preventScroll: true });
    };
    const zu = ({ fokus = true } = {}) => {
      if (!offen) return;
      offen = false;
      buehne.classList.remove("offen");
      griff.setAttribute("aria-expanded", "false");
      if (bewegt) setTimeout(() => klon.classList.remove("da"), 600);
      griffZeigen();
      if (fokus && !unten) griff.focus({ preventScroll: true });
    };

    griff.addEventListener("click", auf);
    buehne.querySelector(".stern-buehne__zu").addEventListener("click", () => zu());
    buehne.querySelector(".stern-buehne__schleier").addEventListener("click", () => zu());
    addEventListener("keydown", (e) => { if (e.key === "Escape" && offen) zu(); });
    addEventListener("scroll", griffZeigen, { passive: true });

    /* Wenn der echte Stern ins Bild kommt, hat die Bühne ihren Dienst
       getan: Sie geht zu, der Griff verschwindet, der Stern gehört der
       Seite. Etwas Vorlauf (Rand unten), damit die Bühne schon weicht,
       während der Stern heraufkommt — die eine Bewegung geht in die
       andere über. */
    new IntersectionObserver(([e]) => {
      unten = e.isIntersecting;
      if (unten) zu({ fokus: false });
      griffZeigen();
    }, { rootMargin: "0px 0px 18% 0px" }).observe(original);

    griffZeigen();
  }
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
    // Je Pfad *alle* Knoten — der Stern steht zweimal (am Fuß und auf
    // der Bühne), und beide sollen aufleuchten.
    const sterne = new Map();
    for (const k of knoten) {
      const p = weg(k.getAttribute("href"));
      if (!p) continue;
      if (!sterne.has(p)) sterne.set(p, []);
      sterne.get(p).push(k);
    }

    const kopfHoehe = halt.querySelector(".verwandt__kopf")?.offsetHeight ?? 0;
    let gemerkt = null;

    function zeigenAuf(pfad, { rollen = true } = {}) {
      if (pfad === gemerkt) return;
      gemerkt = pfad;
      for (const li of eintraege.values()) li.classList.remove("ist-nah");
      for (const ks of sterne.values()) for (const k of ks) k.classList.remove("ist-nah");
      if (!pfad) return;

      eintraege.get(pfad)?.classList.add("ist-nah");
      for (const k of sterne.get(pfad) ?? []) k.classList.add("ist-nah");

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
    for (const st of document.querySelectorAll(".stern"))
      st.addEventListener("pointerleave", () => { schwebt = false; zeigenAuf(ausText); });

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

/* ── Schrift und Licht auf dem Telefon ──
   Dort liegen Schriftgrad und Hell/Dunkel hinter einem „Aa". Offen bleibt
   es, solange man darin tippt — man soll sehen, was die Wahl bewirkt. Auf
   dem Desktop ist der Knopf unsichtbar und das hier tut nichts. */
{
  const anzeige = document.getElementById("anzeige");
  const knopf = anzeige?.querySelector(".anzeige__knopf");

  if (anzeige && knopf) {
    const stellen = (offen) => {
      anzeige.toggleAttribute("data-offen", offen);
      knopf.setAttribute("aria-expanded", String(offen));
    };
    knopf.addEventListener("click", (e) => {
      e.stopPropagation();
      stellen(!anzeige.hasAttribute("data-offen"));
    });
    addEventListener("click", (e) => { if (!anzeige.contains(e.target)) stellen(false); });
    addEventListener("keydown", (e) => { if (e.key === "Escape") stellen(false); });
  }
}

/* ── Die Marke fliegt in die Kopfleiste ──
   Nur auf der Startseite. Oben steht der Name einmal, gemalt; die Kopfleiste
   schweigt. Beim Scrollen fliegt das Bild im Takt der Hand nach oben und
   setzt sich klein an den Platz des Wortes — die Marke des Tages geht mit,
   solange man auf der Startseite ist. Zurückscrollen holt sie wieder heraus
   (Andreas' Idee, 16.09.2026). Wer weniger Bewegung eingestellt hat, sieht
   beides wie bisher: oben das Bild, in der Kopfleiste das Wort. */
{
  const bild = document.getElementById("wortmarke");
  const marke = bild?.closest(".wortmarke");
  const wort = document.querySelector(".kopfleiste__marke-wort");
  const ruhig = matchMedia("(prefers-reduced-motion: reduce)");

  if (bild && marke && wort && !ruhig.matches) {
    let A = null, B = null, D = 1, geplant = false, angedockt = false;
    const glatt = (x) => x * x * (3 - 2 * x);

    // Angekommen, steht die Marke wirklich fest (position: fixed) und wird
    // nicht mehr bei jedem Scrollschritt nachgerechnet. Mit transform allein
    // lief sie auf dem iPhone ständig hinterher — Safari meldet das Scrollen
    // verzögert —, und es kostete bei jedem Bild Rechenzeit (Andreas, 16.09.).
    const andocken = (ja) => {
      if (ja === angedockt) return;
      angedockt = ja;
      const st = bild.style;
      if (ja) {
        st.transform = "";
        st.position = "fixed";
        st.left = `${B.x}px`;
        st.top = `${B.mitte - B.s * A.h / 2}px`;
        st.width = `${A.w * B.s}px`;
        st.height = `${A.h * B.s}px`;
      } else {
        st.position = st.left = st.top = st.width = st.height = "";
      }
    };

    // Start (Bild bei scrollY 0, in Seitenkoordinaten) und Ziel (das Wort
    // in der festen Kopfleiste, in Fensterkoordinaten) einmal ausmessen.
    const messen = () => {
      if (!marke.classList.contains("hat-bild")) return;
      marke.classList.add("fliegt");
      andocken(false);
      bild.style.transform = "";
      const a = bild.getBoundingClientRect(), b = wort.getBoundingClientRect();
      const kopf = document.getElementById("kopfleiste").getBoundingClientRect();
      A = { x: a.left, y: a.top + scrollY, w: a.width, h: a.height };
      // Ziel: so hoch, wie die Kopfleiste Luft lässt (die Pinselschriften
      // tragen Rand um das Wort), aber nie breiter als der Platz des Wortes
      // bis zur Rubrikwahl.
      const ende = Math.min(kopf.height * .8 / a.height, (b.width + 4) / a.width);
      B = { x: b.left, mitte: kopf.top + kopf.height / 2, s: ende };
      wort.style.opacity = "0";
      // Der Flug dauert anderthalb Mal den Weg nach oben: Die Marke bleibt
      // erst einen Moment stehen, dann gleitet sie — nicht nur mitgerissen.
      D = Math.max(1, (A.y - kopf.top) * 1.5);
      zeichnen();
    };

    const zeichnen = () => {
      geplant = false;
      if (!A || !A.w) return;
      const p = Math.min(1, scrollY / D);
      if (p >= 1) { andocken(true); return; }
      andocken(false);
      const e = glatt(Math.max(0, p));
      const s = 1 + (B.s - 1) * e;
      const links = A.x + (B.x - A.x) * e;
      const mitte = (A.y + A.h / 2) + (B.mitte - A.y - A.h / 2) * e;
      const dx = links - A.x;
      const dy = mitte - s * A.h / 2 - (A.y - scrollY);
      bild.style.transform = `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px) scale(${s.toFixed(4)})`;
    };
    const bitte = () => { if (!geplant) { geplant = true; requestAnimationFrame(zeichnen); } };

    addEventListener("scroll", bitte, { passive: true });
    addEventListener("resize", messen);
    // Das Bild kommt nach diesem Skript oder wechselt mit dem Thema die Quelle.
    bild.addEventListener("load", () => requestAnimationFrame(messen));
    if (bild.complete && bild.naturalWidth) requestAnimationFrame(messen);
    document.fonts?.ready.then(messen);
  }
}

/* ── Die Lenkung bleibt stehen ──
   Startseite, großer Schirm (start.css). Hier nur zwei Handgriffe: die Höhe
   der Lenkung als --lenkung für die Sprungziele, und die Frage, ob sie gerade
   ansteht — dann verliert die Kopfleiste ihre Kante, und beide sind eine
   Fläche. Der Satz über die Notes geht auf den ersten 140 Pixeln aus. */
{
  const lenkung = document.getElementById("lenkung");
  const satz = document.querySelector(".start__satz");
  const kopfleiste = document.getElementById("kopfleiste");
  const gross = matchMedia("(min-width: 1180px)");

  if (lenkung && kopfleiste) {
    const hoehe = () => document.documentElement.style.setProperty("--lenkung", `${lenkung.offsetHeight}px`);
    new ResizeObserver(hoehe).observe(lenkung);
    hoehe();

    let geplant = false;
    const stand = () => {
      geplant = false;
      const steht = gross.matches && lenkung.getBoundingClientRect().top <= kopfleiste.offsetHeight + 1;
      document.body.classList.toggle("lenkung-steht", steht);
      if (satz) satz.style.opacity = gross.matches ? String(Math.max(0, 1 - scrollY / 140)) : "";
    };
    addEventListener("scroll", () => { if (!geplant) { geplant = true; requestAnimationFrame(stand); } }, { passive: true });
    addEventListener("resize", stand);
    stand();
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

/* ── Ein Klick im Stern schaut erst hinein ──
   Ein Knoten ist ein Link, und das bleibt er: Rechtsklick, mittlere
   Taste, ⌘-Klick führen weiterhin auf die Seite. Der einfache Klick aber
   hebt die Vorschau vom unteren Rand — man ist im Stern, um zu sehen,
   was da draußen liegt, nicht um sofort wegzugehen. (Andreas, 05.09.)

   Der Satz darüber kommt aus dem Bestand: erst aus dem Kasten rechts
   (die geschriebene Begründung), sonst aus der Kante selbst („beide
   zitieren …") — was der Stern beim Berühren auch sagt. */
{
  const sterne = [...document.querySelectorAll("section.stern")];
  if (sterne.length && window.gwSchau) {
    const weg = (u) => { try { return new URL(u, location.href).pathname.replace(/\/$/, ""); } catch { return null; } };
    const gruende = new Map();
    for (const a of document.querySelectorAll(".verwandt__liste li a[href]")) {
      const p = weg(a.getAttribute("href"));
      const w = a.querySelector(".verwandt__warum")?.textContent.trim();
      if (p && w) gruende.set(p, w);
    }
    for (const stern of sterne) {
      const mitte = stern.querySelector(".knoten--mitte")?.dataset.id;
      stern.addEventListener("click", (e) => {
        const k = e.target.closest("a.knoten");
        if (!k || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        const href = k.getAttribute("href");
        let grund = gruende.get(weg(href)) ?? null;
        if (!grund && mitte) {
          const id = k.dataset.id;
          const kante = [...stern.querySelectorAll(".kante:not(.kante--rand)")]
            .find((x) => (x.dataset.a === id && x.dataset.b === mitte) || (x.dataset.b === id && x.dataset.a === mitte));
          const w = kante?.dataset.warum ?? "";
          // „Titel · beide zitieren …" — nur der Teil nach dem Titel trägt hier.
          grund = w.includes(" · ") ? w.slice(w.indexOf(" · ") + 3) : (w || null);
          if (grund === "verweisen aufeinander") grund = null;
        }
        gwSchau.oeffnen(href, { unten: true, grund });
      });
    }
  }
}

/* ── Der Stern auf dem kleinen Schirm ──
   Dort ist er breiter als das Fenster und lässt sich schieben. Beim
   Aufschlagen soll die Mitte in der Mitte stehen — sonst sieht man erst
   den linken Rand des Sternbilds und den Kern gar nicht. */
if (matchMedia("(max-width: 1179px)").matches) {
  for (const st of document.querySelectorAll(".stern")) {
    const mittig = () => { st.scrollLeft = Math.max(0, (st.scrollWidth - st.clientWidth) / 2); };
    mittig();
    addEventListener("resize", mittig, { passive: true });
  }
}

/* ── Teilen ──
   Auf dem Telefon öffnet `navigator.share` das Teilen-Menü des Geräts;
   wo es fehlt (die meisten Rechner), kommt die Adresse in die
   Zwischenablage. Geteilt wird immer die saubere Adresse aus dem
   Canonical — ohne `.html`, ohne `?nicht-zaehlen`, ohne Anker —, damit
   der Empfänger gezählt wird und die Vorschaukarte trägt. Gemessen wird
   nur, dass geteilt wurde und von wo; nie, mit wem. */
(() => {
  const knoepfe = document.querySelectorAll("[data-teilen]");
  if (!knoepfe.length) return;

  const url = document.querySelector('link[rel="canonical"]')?.href
    ?? location.origin + location.pathname.replace(/\.html$/, "");
  const titel = document.querySelector('meta[property="og:title"]')?.content ?? document.title;

  let hinweis = null, frist = null;
  const zeigen = (text) => {
    if (!hinweis) {
      hinweis = document.createElement("div");
      hinweis.className = "teilen-hinweis";
      hinweis.setAttribute("role", "status");
      document.body.appendChild(hinweis);
    }
    hinweis.textContent = text;
    hinweis.classList.add("da");
    clearTimeout(frist);
    frist = setTimeout(() => hinweis.classList.remove("da"), 2200);
  };
  const zaehlen = (ort, weg) => { try { window.umami?.track("teilen", { ort, weg }); } catch {} };

  knoepfe.forEach((k) => k.addEventListener("click", async () => {
    const ort = k.dataset.teilen;
    if (navigator.share) {
      try {
        await navigator.share({ title: titel, url });
        zaehlen(ort, "menue");
      } catch (e) {
        // Abbrechen im Menü ist kein Fehler — nur still bleiben.
        if (e?.name !== "AbortError") kopieren(ort);
      }
      return;
    }
    kopieren(ort);
  }));

  async function kopieren(ort) {
    try {
      await navigator.clipboard.writeText(url);
      zeigen("Link kopiert");
      zaehlen(ort, "kopie");
    } catch {
      // Ohne Zwischenablage (unsicherer Kontext, alter Browser): die
      // Adresse wenigstens zeigen, damit man sie von Hand nehmen kann.
      zeigen(url);
    }
  }
})();
