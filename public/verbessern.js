/* Verbessern — einen Abschnitt neu fassen, das Original daneben.

   Ohne dieses Skript ist der Satz unter der Note ein mailto. Mit ihm
   zerlegt es den Text an seinen Überschriften (## und ###) in Abschnitte,
   macht aus jedem lesbaren Klartext (ohne Zeitmarken, ohne Hörknöpfe) und
   öffnet beim Klick ein Blatt: links fest, rechts zum Ändern. Entwürfe
   bleiben bis zum Neuladen im Speicher — wer den Abschnitt wechselt oder
   das Blatt schließt, verliert nichts. */

(() => {
  const text = document.getElementById("text");
  const box = document.getElementById("verb");
  if (!text || !box) return;

  const form = document.getElementById("verbForm");
  const wahl = document.getElementById("verbAbschnitt");
  const original = document.getElementById("verbOriginal");
  const fassung = document.getElementById("verbFassung");
  const warum = document.getElementById("verbWarum");
  const mail = document.getElementById("verbMail");
  const zaehler = document.getElementById("verbZaehler");
  const antwort = document.getElementById("verbAntwort");
  const senden = form.querySelector(".verb__senden");
  const felder = [form.querySelector(".verb__seiten"), warum, mail, form.querySelector(".verb__fuss")];

  /* ── Abschnitte ── */
  const KOPF = "h2[id], h3[id]";
  // Was keine Prosa ist, die man verbessern könnte: die Fragen am Ende und
  // die Verbindungen (die stehen ohnehin in der Randspalte).
  const OHNE = /^(weiterdenken|verbindungen|inhalt)\b/i;
  const WEG = ".ts, .oton__horen, img, svg, button, iframe, video, audio, script, style, .verb-griff";
  const AUSSEN = ".marken-zeile, .verbessern-hinweis, [hidden], hr, script, style, figure, iframe";

  const flach = (el) => {
    const c = el.cloneNode(true);
    c.querySelectorAll(WEG).forEach((n) => n.remove());
    // Wo eine Zeitmarke saß, bliebe sonst ein Leerzeichen vor dem Punkt.
    return c.textContent.replace(/\s+/g, " ").replace(/ ([.,;:!?)“»])/g, "$1").trim();
  };

  function bloecke(el, aus) {
    if (el.matches(WEG) || el.matches(AUSSEN)) return;
    const tag = el.tagName;
    if (tag === "UL" || tag === "OL") {
      [...el.children].forEach((li, i) => {
        const t = flach(li);
        if (t) aus.push((tag === "OL" ? `${i + 1}. ` : "– ") + t);
      });
      return;
    }
    if (tag === "TABLE") {
      for (const tr of el.querySelectorAll("tr")) {
        const t = [...tr.children].map(flach).join(" | ");
        if (t.replace(/[|\s]/g, "")) aus.push(t);
      }
      return;
    }
    if (el.classList.contains("block-label")) {
      const t = flach(el);
      if (t) aus.push(`[${t}]`);
      return;
    }
    // Ein Behälter (Callout, Zitat, aufklappbarer Block) ohne eigenen
    // Fließtext: seine Kinder einzeln, damit Absätze Absätze bleiben.
    const eigenerText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (!/^(P|H4|H5|H6|PRE|SUMMARY|DT|DD)$/.test(tag) && el.children.length && !eigenerText) {
      for (const k of el.children) bloecke(k, aus);
      return;
    }
    const t = flach(el);
    if (t) aus.push(t);
  }

  function abschnitteBauen() {
    const liste = [];
    let jetzt = { id: "", titel: "Anfang", kopf: null, teile: [] };
    let draussen = false;   // unter einem ## Weiterdenken/Verbindungen — samt seinen ###
    for (const el of text.children) {
      if (el.matches(KOPF)) {
        liste.push(jetzt);
        const titel = flach(el);
        if (el.tagName === "H2") draussen = OHNE.test(titel);
        jetzt = { id: el.id, titel, kopf: el, teile: [], draussen: draussen || OHNE.test(titel) };
      } else {
        jetzt.teile.push(el);
      }
    }
    liste.push(jetzt);
    return liste
      .filter((a) => !a.draussen && !OHNE.test(a.titel))
      .map((a) => {
        const aus = [];
        a.teile.forEach((el) => bloecke(el, aus));
        return { ...a, text: aus.join("\n\n") };
      })
      .filter((a) => a.text.length > 0);
  }

  const abschnitte = abschnitteBauen();
  if (!abschnitte.length) return;

  // Doppelte Titel (zweimal „Faktencheck") im Menü unterscheidbar halten.
  const gesehen = {};
  abschnitte.forEach((a, i) => {
    const o = document.createElement("option");
    gesehen[a.titel] = (gesehen[a.titel] ?? 0) + 1;
    o.value = String(i);
    o.textContent = gesehen[a.titel] > 1 ? `${a.titel} (${gesehen[a.titel]})` : a.titel;
    wahl.append(o);
  });

  /* ── Der Griff am Rand ── nur dort, wo eine Maus über Überschriften
     fahren kann; sichtbar erst, wenn sie darauf liegt (verbessern.css). */
  if (matchMedia("(hover: hover) and (pointer: fine)").matches) {
    abschnitte.forEach((a, i) => {
      if (!a.kopf) return;
      const g = document.createElement("button");
      g.type = "button";
      g.className = "verb-griff" + (a.kopf.querySelector(".ts") ? " verb-griff--tief" : "");
      g.textContent = "anfassen";
      g.setAttribute("aria-label", `Abschnitt „${a.titel}“ neu fassen`);
      g.addEventListener("click", (e) => { e.preventDefault(); oeffnen(i, g); });
      a.kopf.append(g);
    });
  }

  /* ── Welcher Abschnitt ist gemeint? ── Erst eine Markierung im Text,
     sonst der Abschnitt, der gerade auf Augenhöhe steht. */
  function gemeint() {
    const sel = getSelection();
    const anker = sel && sel.rangeCount && !sel.isCollapsed ? sel.anchorNode : null;
    const hoehe = innerHeight * 0.35;
    let treffer = 0;
    abschnitte.forEach((a, i) => {
      if (anker && a.teile.some((el) => el.contains(anker))) treffer = -1 - i;
    });
    if (treffer < 0) return -1 - treffer;
    abschnitte.forEach((a, i) => {
      const erstes = a.kopf ?? a.teile[0];
      if (erstes && erstes.getBoundingClientRect().top < hoehe) treffer = i;
    });
    return treffer;
  }

  /* ── Das Blatt ── */
  const entwuerfe = new Map();
  let aktiv = -1, seit = 0, zurueck = null;

  const absaetze = (t) => t.split(/\n\s*\n/).map((s) => s.replace(/\s+/g, " ").trim()).filter(Boolean);

  function originalZeigen(i) {
    original.replaceChildren(...absaetze(abschnitte[i].text).map((t) => {
      const p = document.createElement("p");
      p.textContent = t;
      return p;
    }));
    original.scrollTop = 0;
  }

  // Links leise markieren, welche Absätze rechts nicht mehr so stehen.
  function vergleichen() {
    const neu = new Set(absaetze(fassung.value));
    let anders = 0;
    for (const p of original.children) {
      const weg = !neu.has(p.textContent);
      p.classList.toggle("anders", weg);
      if (weg) anders++;
    }
    const alt = new Set([...original.children].map((p) => p.textContent));
    const dazu = [...neu].filter((t) => !alt.has(t)).length;
    const n = Math.max(anders, dazu);
    zaehler.textContent = n === 0 ? "" : n === 1 ? "· ein Absatz geändert" : `· ${n} Absätze geändert`;
  }

  function zeigen(i) {
    if (aktiv >= 0) entwuerfe.set(aktiv, fassung.value);
    aktiv = i;
    wahl.value = String(i);
    originalZeigen(i);
    fassung.value = entwuerfe.get(i) ?? abschnitte[i].text;
    fassung.scrollTop = 0;
    vergleichen();
  }

  const sagen = (was, fehler = false) => {
    antwort.textContent = was;
    antwort.hidden = !was;
    antwort.classList.toggle("ist-fehler", fehler);
  };
  const felderZeigen = (ja) => felder.forEach((el) => { el.hidden = !ja; });

  function oeffnen(i, von) {
    zurueck = von ?? document.activeElement;
    felderZeigen(true);
    sagen("");
    senden.disabled = false;
    box.hidden = false;
    document.documentElement.classList.add("verb-offen");
    zeigen(i);
    seit = seit || Date.now();
    fassung.focus({ preventScroll: true });
    fassung.setSelectionRange(0, 0);
  }

  function schliessen() {
    if (aktiv >= 0) entwuerfe.set(aktiv, fassung.value);
    box.hidden = true;
    document.documentElement.classList.remove("verb-offen");
    zurueck?.focus?.({ preventScroll: true });
  }

  document.querySelectorAll("[data-verbessern]").forEach((el) =>
    el.addEventListener("click", (e) => { e.preventDefault(); oeffnen(gemeint(), el); }));
  box.querySelectorAll("[data-verb-zu]").forEach((el) => el.addEventListener("click", schliessen));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !box.hidden) schliessen();
  });
  wahl.addEventListener("change", () => zeigen(Number(wahl.value)));
  fassung.addEventListener("input", vergleichen);

  // Beide Seiten laufen beim Blättern mit, damit links dieselbe Stelle steht.
  let fuehrt = null;
  const mitlaufen = (von, nach) => () => {
    if (fuehrt && fuehrt !== von) return;
    fuehrt = von;
    const weg = von.scrollHeight - von.clientHeight;
    nach.scrollTop = weg > 0 ? (von.scrollTop / weg) * (nach.scrollHeight - nach.clientHeight) : 0;
    clearTimeout(mitlaufen.t);
    mitlaufen.t = setTimeout(() => { fuehrt = null; }, 120);
  };
  fassung.addEventListener("scroll", mitlaufen(fassung, original));
  original.addEventListener("scroll", mitlaufen(original, fassung));

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const a = abschnitte[aktiv];
    const neu = fassung.value.trim();
    if (absaetze(neu).join("\n") === absaetze(a.text).join("\n")) {
      sagen("Noch ist nichts geändert.", true);
      fassung.focus();
      return;
    }
    senden.disabled = true;
    sagen("");
    try {
      const r = await fetch("/api/rueckmeldung/vorschlag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seite: location.pathname,
          note: box.dataset.note,
          abschnitt: a.id,
          titel: a.titel,
          stand: box.dataset.stand,
          original: a.text,
          fassung: neu,
          warum: warum.value.trim(),
          mail: mail.value.trim(),
          t: Date.now() - seit,
          website: form.elements.website?.value ?? "",
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.ok) {
        const mitAdresse = !!mail.value.trim();
        entwuerfe.delete(aktiv);
        aktiv = -1;            // das Abgeschickte ist kein Entwurf mehr
        warum.value = "";
        felderZeigen(false);
        sagen(mitAdresse
          ? "Danke. Wir sehen es uns an, und du bekommst Bescheid — so oder so."
          : "Danke. Wir sehen es uns an.");
        window.umami?.track?.("vorschlag");   // nur die Zahl, nie der Text
        setTimeout(() => { if (!box.hidden) schliessen(); }, 3200);
      } else {
        senden.disabled = false;
        sagen(d.fehler || "Das hat nicht geklappt. Schreib sonst an luc@gedankenwelten.org.", true);
      }
    } catch {
      senden.disabled = false;
      sagen("Das hat nicht geklappt. Schreib sonst an luc@gedankenwelten.org.", true);
    }
  });
})();
