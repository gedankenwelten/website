/**
 * Externe Links öffnen in einem neuen Tab.
 *
 * Wer mitten in einer Note einen DOI, eine Quelle oder einen Zeitstempel
 * anklickt, soll die Note nicht verlieren — die Lesestelle bleibt im alten
 * Tab stehen. Interne Links (Wikilinks, Anker, `/…`) bleiben, wie sie sind.
 *
 * `rel="noopener"` ohne `noreferrer`: Die Gegenseite darf sehen, dass der
 * Besuch von gedankenwelten.org kam.
 */
import { visit } from "unist-util-visit";

const EIGEN = /^https?:\/\/(www\.)?gedankenwelten\.org(\/|$)/i;

export default function rehypeExterneLinks() {
  return (baum) => {
    visit(baum, "element", (knoten) => {
      if (knoten.tagName !== "a") return;
      const href = String(knoten.properties?.href ?? "");
      if (!/^https?:\/\//i.test(href) || EIGEN.test(href)) return;
      knoten.properties.target = "_blank";
      knoten.properties.rel = ["noopener"];
    });
  };
}
