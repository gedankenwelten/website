/* Die Suche.
   Pagefind baut den Index beim Bauen (`npx pagefind --site dist`) und
   liefert ihn in Stücken aus; geladen wird erst beim ersten Öffnen.
   Unter `astro dev` gibt es ihn nicht — dort sagt das Feld das auch,
   statt stumm nichts zu finden. */

const schicht = document.getElementById("suche");
if (schicht) {
  const feld = document.getElementById("sucheFeld");
  const liste = document.getElementById("sucheTreffer");
  const hinweis = document.getElementById("sucheHinweis");
  const filterband = document.getElementById("sucheFilter");
  const mehr = document.getElementById("sucheMehr");

  let pagefind = null;      // der geladene Index
  let laeuft = null;        // die laufende Anfrage
  let alle = [];            // Treffer der letzten Anfrage, unaufgeschlagen
  let gezeigt = 0;
  let rubrik = null;        // gewählter Rubrikfilter
  const PORTION = 8;

  /* ── Öffnen und Schließen ── */
  async function oeffnen() {
    schicht.hidden = false;
    document.body.style.overflow = "hidden";
    feld.focus();
    feld.select();
    if (!pagefind) await ladeIndex();
  }
  function schliessen() {
    schicht.hidden = true;
    document.body.style.overflow = "";
  }

  async function ladeIndex() {
    try {
      pagefind = await import("/pagefind/pagefind.js");
      await pagefind.options({ excerptLength: 26 });
      await pagefind.init();
      await filterBauen();
    } catch {
      pagefind = null;
      /* Ehrlich sagen, was los ist: Im Entwicklungsserver liegt der
         Index nicht, weil er beim Bauen entsteht. Ein leeres Feld, das
         nie etwas findet, sähe wie ein Fehler aus. */
      hinweis.textContent =
        "Der Suchindex entsteht beim Bauen — im Entwicklungsstand gibt es ihn nicht. "
        + "(npx astro build && npx pagefind --site dist && npx astro preview)";
      hinweis.classList.add("suche__hinweis--warnung");
    }
  }

  /* Die Rubriken als Filter — dieselbe Geste wie das Themenband auf der
     Rubrikseite. Was der Index nicht kennt, steht auch nicht da. */
  async function filterBauen() {
    const werte = (await pagefind.filters()).Rubrik ?? {};
    const namen = Object.entries(werte).filter(([, n]) => n > 0);
    if (!namen.length) return;
    filterband.hidden = false;
    filterband.replaceChildren(...namen.map(([name, n]) => {
      const k = document.createElement("button");
      k.type = "button";
      k.className = "suche__rubrik";
      k.dataset.rubrik = name;
      k.innerHTML = `${name}<i>${n}</i>`;
      k.onclick = () => {
        rubrik = rubrik === name ? null : name;
        for (const b of filterband.children) b.classList.toggle("ist", b.dataset.rubrik === rubrik);
        suchen(feld.value);
      };
      return k;
    }));
  }

  /* Die Zahl am Filter sagt, wieviel er von DIESER Anfrage übriglässt —
     nicht, wie groß die Rubrik ist. „Denker 4" ist eine Auskunft, „Denker
     108" wäre nur eine Wiederholung des Regals. */
  function filterZaehlen(werte) {
    for (const b of filterband.children) {
      const n = werte?.[b.dataset.rubrik] ?? 0;
      b.querySelector("i").textContent = n;
      b.classList.toggle("suche__rubrik--leer", n === 0 && b.dataset.rubrik !== rubrik);
    }
  }

  /* ── Suchen ── */
  let warten = null;
  feld?.addEventListener("input", () => {
    clearTimeout(warten);
    warten = setTimeout(() => suchen(feld.value), 140);
  });

  async function suchen(begriff) {
    const b = begriff.trim();
    if (!pagefind) return;
    if (b.length < 2) {
      liste.replaceChildren();
      mehr.hidden = true;
      hinweis.hidden = false;
      hinweis.textContent = "Volltext über alle Notes. Ein Wort genügt; mehrere schränken ein.";
      const ganz = (await pagefind.filters()).Rubrik ?? {};
      filterZaehlen(ganz);
      return;
    }

    const meine = {};
    laeuft = meine;
    const antwort = await pagefind.search(b, rubrik ? { filters: { Rubrik: rubrik } } : {});
    if (laeuft !== meine) return;   // eine neuere Anfrage ist schon unterwegs

    /* `totalFilters` zählt, was jeder Filter aus dieser Anfrage machen
       würde — `filters` zählt nur innerhalb der schon gewählten. */
    filterZaehlen(antwort.totalFilters?.Rubrik ?? antwort.filters?.Rubrik);
    alle = antwort.results;
    gezeigt = 0;
    liste.replaceChildren();
    hinweis.hidden = false;
    hinweis.textContent = alle.length
      ? `${alle.length} ${alle.length === 1 ? "Note" : "Notes"}${rubrik ? ` in ${rubrik}` : ""}`
      : `Nichts gefunden zu „${b}"${rubrik ? ` in ${rubrik}` : ""}.`;
    await nachlegen();
  }

  async function nachlegen() {
    const teil = alle.slice(gezeigt, gezeigt + PORTION);
    gezeigt += teil.length;
    /* Erst hier wird je Treffer ein weiteres Stück geladen — darum
       portionsweise und nicht alle 743 auf einmal. */
    for (const t of await Promise.all(teil.map((t) => t.data()))) liste.appendChild(zeile(t));
    mehr.hidden = gezeigt >= alle.length;
  }

  function zeile(t) {
    const li = document.createElement("li");
    li.className = "suche__treffer-eintrag";

    const a = document.createElement("a");
    a.href = t.url.replace(/\/index\.html$/, "").replace(/\.html$/, "") || "/";

    if (t.meta.bild) {
      const img = document.createElement("img");
      img.src = t.meta.bild;
      img.alt = "";
      img.loading = "lazy";
      a.appendChild(img);
    } else {
      const leer = document.createElement("span");
      leer.className = `suche__leer suche__leer--${(t.meta.rubrik ?? "").toLowerCase()}`;
      a.appendChild(leer);
    }

    const text = document.createElement("span");
    text.className = "suche__text";

    const kennung = document.createElement("span");
    kennung.className = "suche__kennung";
    kennung.textContent = [t.meta.rubrik, t.meta.datum].filter(Boolean).join(" · ");

    const titel = document.createElement("b");
    titel.textContent = t.meta.titel ?? t.meta.title ?? t.url;

    const stelle = document.createElement("span");
    stelle.className = "suche__stelle";
    // Der Ausschnitt kommt mit <mark> um die Fundstelle — das ist der
    // eigentliche Wert einer Volltextsuche: die Stelle, nicht der Titel.
    stelle.innerHTML = t.excerpt;

    text.append(kennung, titel, stelle);
    a.appendChild(text);
    li.appendChild(a);
    return li;
  }

  mehr?.querySelector("button")?.addEventListener("click", nachlegen);

  /* Pfeile und Eingabetaste: Die Hand soll die Tastatur nicht verlassen
     müssen, um den ersten Treffer zu öffnen. */
  feld?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { liste.querySelector("a")?.click(); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); liste.querySelector("a")?.focus(); }
  });
  liste?.addEventListener("keydown", (e) => {
    const links = [...liste.querySelectorAll("a")];
    const i = links.indexOf(document.activeElement);
    if (i < 0) return;
    if (e.key === "ArrowDown") { e.preventDefault(); (links[i + 1] ?? links[0]).focus(); }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      i === 0 ? feld.focus() : links[i - 1].focus();
    }
  });

  /* ── Tasten ──
     Schrägstrich und ⌘K öffnen, Esc schließt. Der Schrägstrich nur,
     wenn gerade nicht ohnehin getippt wird. */
  addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !schicht.hidden) { schliessen(); return; }
    const tippt = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName ?? "");
    if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !tippt)) {
      e.preventDefault();
      // Auf der Startseite steht das Sieb — dort hinein statt hierher.
      if (schicht.hidden && window.gwSieb?.()) return;
      schicht.hidden ? oeffnen() : schliessen();
    }
  });

  for (const el of document.querySelectorAll("[data-schliessen]")) el.addEventListener("click", schliessen);
  for (const el of document.querySelectorAll("[data-suche-auf]")) {
    el.addEventListener("click", (e) => { e.preventDefault(); if (!window.gwSieb?.()) oeffnen(); });
  }

  /* Das Sieb der Startseite reicht seine Anfrage hierher weiter, wenn
     man die Eingabetaste drückt — mit dem Wort, das es verstanden hat. */
  window.gwSuche = {
    async oeffnen(begriff) {
      await oeffnen();
      if (begriff) { feld.value = begriff; suchen(begriff); }
    },
  };
}
