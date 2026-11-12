/* Kopieren-Knopf an Codeblöcken (12.11.2026).
   Anlass: Die MCP-Seite bietet einen Prompt und eine Adresse zum Übernehmen.
   Jeder <pre> im Notentext bekommt oben rechts einen Knopf in der Sprache der
   Feeds-Seite (.feed__kopieren). Kopiert wird der reine Text des Blocks. */
(function () {
  const bloecke = document.querySelectorAll(".blatt pre");
  for (const pre of bloecke) {
    const huelle = document.createElement("div");
    huelle.className = "codeblock";
    pre.parentNode.insertBefore(huelle, pre);
    huelle.appendChild(pre);
    const k = document.createElement("button");
    k.type = "button";
    k.className = "feed__kopieren codeblock__kopieren";
    k.textContent = "Kopieren";
    k.setAttribute("aria-label", "Text dieses Blocks kopieren");
    k.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(pre.innerText.replace(/\n$/, ""));
        const war = k.textContent;
        k.textContent = "Kopiert";
        k.classList.add("ist-kopiert");
        setTimeout(() => { k.textContent = war; k.classList.remove("ist-kopiert"); }, 1600);
      } catch (e) {
        const r = document.createRange();
        r.selectNodeContents(pre);
        const s = getSelection(); s.removeAllRanges(); s.addRange(r);
      }
    });
    huelle.appendChild(k);
  }
})();
