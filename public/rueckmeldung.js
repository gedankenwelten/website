/* Die Rückmeldung — die leise Tür in der Fußzeile.
   Ohne dieses Skript ist der Link ein mailto; mit ihm öffnet er ein Feld
   über der Seite und schickt den Text an /api/rueckmeldung. Kein Framework,
   kein Zustand über den Moment hinaus. */

(() => {
  const auf = document.querySelector("[data-rueckmeldung]");
  const box = document.getElementById("rueck");
  if (!auf || !box) return;

  const form = document.getElementById("rueckForm");
  const text = document.getElementById("rueckText");
  const mail = document.getElementById("rueckMail");
  const antwort = document.getElementById("rueckAntwort");
  const senden = form.querySelector(".rueck__senden");
  const felder = [text, mail, form.querySelector(".rueck__fuss")];

  let seit = 0;        // wann das Feld aufging — Bots tippen keine drei Sekunden
  let zurueck = null;  // wohin der Fokus nach dem Schließen gehört

  const sagen = (was, fehler = false) => {
    antwort.textContent = was;
    antwort.hidden = !was;
    antwort.classList.toggle("ist-fehler", fehler);
  };
  const felderZeigen = (ja) => felder.forEach((el) => { el.hidden = !ja; });

  const oeffnen = (e) => {
    e.preventDefault();
    zurueck = document.activeElement;
    felderZeigen(true);
    sagen("");
    senden.disabled = false;
    box.hidden = false;
    seit = Date.now();
    text.focus();
  };
  const schliessen = () => {
    box.hidden = true;
    zurueck?.focus?.();
  };

  auf.addEventListener("click", oeffnen);
  box.querySelectorAll("[data-rueck-zu]").forEach((el) => el.addEventListener("click", schliessen));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !box.hidden) schliessen();
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const t = text.value.trim();
    if (t.length < 3) { text.focus(); return; }
    senden.disabled = true;
    sagen("");
    try {
      const r = await fetch("/api/rueckmeldung", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: t,
          mail: mail.value.trim(),
          seite: location.pathname,
          t: Date.now() - seit,
          website: form.elements.website?.value ?? "",
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.ok) {
        form.reset();
        felderZeigen(false);
        sagen("Danke. Das landet bei Andi.");
        window.umami?.track?.("rueckmeldung");   // nur die Zahl, nie der Text
        setTimeout(() => { if (!box.hidden) schliessen(); }, 2600);
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
