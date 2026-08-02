/**
 * Das Sternbild setzen — beim Bauen, nicht beim Lesen.
 *
 * Ein Kraft-Layout im Browser laufen zu lassen hieße: eine Physik-Schleife
 * auf jeder von 748 Seiten, ein Diagramm, das beim Ankommen noch zappelt,
 * und eine Anordnung, die bei jedem Aufruf anders ausfällt. Es gibt keinen
 * Grund dafür. Die Kräfte rechnen sich hier einmal aus, das Ergebnis ist
 * ein fertiges SVG mit festen Koordinaten — gesetzt wie ein Schriftsatz.
 *
 * Bewegung gibt es trotzdem, aber sie erzählt etwas anderes: Die Knoten
 * treten beim Hereinscrollen aus der Mitte an ihren Platz. Das ist eine
 * Ankunft, kein Aufruhr.
 */
import {
  forceSimulation, forceLink, forceManyBody, forceX, forceY,
} from "d3-force";

export const BUEHNE = { breite: 1080, hoehe: 468, rand: 24 };

/** Halbachsen des Rings, auf dem sich die Nachbarn sammeln. */
const RING = { a: 322, b: 158 };

/**
 * Ein Ring, aber ein liegender.
 *
 * `forceRadial` kennt nur Kreise, und ein Kreis erzeugt ein quadratisches
 * Bild — auf einer Seite, die 1080 breit und keine 500 hoch ist, hieße das:
 * links und rechts Leere, oben und unten Gedränge. Die Ellipse legt das
 * Sternbild quer, so wie die Seite selbst liegt.
 */
function liegenderRing(a, b, cx, cy, staerke) {
  let knoten;
  const kraft = (alpha) => {
    for (const n of knoten) {
      if (n.mitte) continue;
      const dx = n.x - cx, dy = n.y - cy;
      // Der Punkt auf der Ellipse in derselben Richtung wie der Knoten
      const t = 1 / Math.max(1e-6, Math.hypot(dx / a, dy / b));
      const k = staerke * alpha;
      n.vx += (cx + dx * t - n.x) * k;
      n.vy += (cy + dy * t - n.y) * k;
    }
  };
  kraft.initialize = (n) => { knoten = n; };
  return kraft;
}

/* Schriftmaße für die Kästchen. Gemessen wird nicht — geschätzt, aber
   großzügig: ein zu breit angenommenes Etikett kostet Luft, ein zu schmal
   angenommenes kostet Lesbarkeit. */
const ZEILE1 = { groesse: 12.5, breite: 6.55, hoehe: 15 };
const ZEILE2 = { groesse: 10.5, breite: 5.35, hoehe: 13 };
const PUNKT_ABSTAND = 11;   // Punkt → Textkante

/* Die Mitte trägt keine Schrift. Der Titel steht drei Bildschirmhöhen
   weiter oben in 3 rem — ihn hier zu wiederholen, hieße dem Leser sagen,
   welche Seite er gerade liest. Ein Ring genügt: du bist hier. */
function kasten(n) {
  if (n.mitte) return { b: 34, h: 34 };
  return {
    b: Math.max((n.kopf?.length ?? 0) * ZEILE1.breite, (n.schwanz?.length ?? 0) * ZEILE2.breite),
    h: ZEILE1.hoehe + (n.schwanz ? ZEILE2.hoehe : 0),
  };
}

/**
 * Etiketten auseinanderschieben.
 *
 * `forceCollide` kennt nur Kreise, unsere Knoten sind aber liegende
 * Rechtecke — ein Kreis um ein 160 px breites Etikett hielte die Nachbarn
 * auch oben und unten auf 160 px Abstand und bliese das Bild auf. Also
 * lösen wir die Überdeckung achsenweise auf, in der Richtung, in der sie
 * am billigsten zu beheben ist.
 */
function entwirren(nodes, runden = 90) {
  for (let r = 0; r < runden; r++) {
    let bewegt = false;
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j];
        const dx = b.mx - a.mx, dy = b.my - a.my;
        const soll_x = (a.k.b + b.k.b) / 2 + 16;
        const soll_y = (a.k.h + b.k.h) / 2 + 11;
        const ueber_x = soll_x - Math.abs(dx);
        const ueber_y = soll_y - Math.abs(dy);
        if (ueber_x <= 0 || ueber_y <= 0) continue;

        bewegt = true;
        // In die Achse ausweichen, die weniger Verschiebung kostet — sonst
        // wandern Knoten quer durch das Bild, um einer Kleinigkeit
        // auszuweichen.
        if (ueber_x / soll_x < ueber_y / soll_y) {
          const s = (ueber_x / 2 + .5) * Math.sign(dx || 1);
          if (!a.fest) a.mx -= s;
          if (!b.fest) b.mx += s;
        } else {
          const s = (ueber_y / 2 + .5) * Math.sign(dy || 1);
          if (!a.fest) a.my -= s;
          if (!b.fest) b.my += s;
        }
      }
    }
    if (!bewegt) break;
  }
}

/**
 * @param {{nodes:Array, links:Array}} stern  aus `sternFuer`
 * @returns dieselben Knoten, um `x`,`y`,`seite` und Kastenmaße ergänzt
 */
export function setzen(stern) {
  const { breite: W, hoehe: H, rand: P } = BUEHNE;
  const cx = W / 2, cy = H / 2;

  const nodes = stern.nodes.map((n, i) => {
    const k = kasten(n);
    // Startlage deterministisch auf einem Kreis: d3 würfelt sonst, sobald
    // zwei Knoten aufeinanderliegen, und die Anordnung wäre bei jedem Bau
    // eine andere.
    const w = (2 * Math.PI * i) / Math.max(1, stern.nodes.length - 1) - Math.PI / 2;
    return {
      ...n, k,
      x: n.mitte ? cx : cx + Math.cos(w) * RING.a,
      y: n.mitte ? cy : cy + Math.sin(w) * RING.b,
      ...(n.mitte ? { fx: cx, fy: cy } : {}),
    };
  });
  const nachId = new Map(nodes.map((n) => [n.id, n]));
  const links = stern.links
    .filter((l) => nachId.has(l.source) && nachId.has(l.target))
    .map((l) => ({ ...l }));

  const sim = forceSimulation(nodes)
    .force("kante", forceLink(links).id((d) => d.id)
      // Der Wikilink ist die kürzere Leine: eine gedachte Verbindung ist
      // enger als eine bloß geteilte Fußnote.
      .distance((l) => (l.rand ? 180 : l.art === "quelle" ? 320 : 270))
      // Schwache Leinen mit Absicht: Der Ring bestimmt, wie weit ein Knoten
      // von der Mitte steht; die Kanten bestimmen nur, wo auf dem Ring —
      // wer zusammengehört, rückt zusammen. Zögen die Kanten stark, holten
      // sie alles auf denselben Abstand zurück und aus der Ellipse würde
      // wieder ein Kreis.
      .strength((l) => (l.rand ? .07 : l.art === "quelle" ? .07 : .1)))
    .force("abstoss", forceManyBody().strength(-540).distanceMax(560))
    // Der Ring hält die Gestalt eines Sterns, wo die Kanten allein nur
    // einen Klumpen ergäben.
    .force("ring", liegenderRing(RING.a, RING.b, cx, cy, .5))
    .force("mitte-x", forceX(cx).strength(.008))
    .force("mitte-y", forceY(cy).strength(.02))
    .stop();

  for (let i = 0; i < 420; i++) sim.tick();

  /* ── Den Ring nachziehen ──────────────────────────────────────────
     Ein Kraft-Layout hat hier wenig zu sagen: Fast jede Kante läuft zur
     Mitte, also gibt es kaum Struktur, die sich frei entfalten könnte —
     und was die Kräfte dann liefern, ist ein Haufen auf der einen und
     Leere auf der anderen Seite. Zufall, nicht Aussage.

     Also nehmen wir von der Simulation, was sie wirklich weiß — die
     Reihenfolge und die Gruppen: welche Nachbarn zusammengehören, steht
     in ihren Winkeln. Die Abstände setzen wir selbst. Wer eng beieinander
     stand, bleibt eng; nur so eng, dass die Schrift noch Platz hat. */
  const aussen = nodes.filter((n) => !n.mitte);
  if (aussen.length > 2) {
    for (const n of aussen) n.w = Math.atan2((n.y - cy) / RING.b, (n.x - cx) / RING.a);
    aussen.sort((p, q) => p.w - q.w);

    const voll = 2 * Math.PI;
    const anzahl = aussen.length;

    /* Die Simulation drängt gern alles in einen Bogen und lässt die
       Gegenseite leer. Also legen wir eine gleichmäßige Teilung darunter,
       gedreht in die Lage, die den Kräften am nächsten kommt, und lassen
       die Knoten nur ein Stück weit zu ihrem gefundenen Winkel zurück:
       genug, dass Gruppen zusammenbleiben, zu wenig, dass sie verklumpen. */
    const teil = voll / anzahl;
    const wickel = (w) => Math.atan2(Math.sin(w), Math.cos(w));
    let sx = 0, sy = 0;
    aussen.forEach((k, i) => { const d = k.w - i * teil; sx += Math.cos(d); sy += Math.sin(d); });
    const dreh = Math.atan2(sy, sx);
    aussen.forEach((k, i) => {
      const soll = i * teil + dreh;
      k.w = soll + .34 * wickel(k.w - soll);
    });
    aussen.sort((p, q) => p.w - q.w);

    // Und was nach dem Zurücklassen zu eng steht, wird auseinandergerückt.
    const luecke = teil * .62;
    for (let runde = 0; runde < 60; runde++) {
      let eng = false;
      for (let i = 0; i < aussen.length; i++) {
        const a = aussen[i], b = aussen[(i + 1) % aussen.length];
        let d = b.w - a.w;
        while (d < 0) d += voll;
        if (d >= luecke) continue;
        eng = true;
        const s = (luecke - d) / 2;
        a.w -= s; b.w += s;
      }
      if (!eng) break;
    }
    for (const n of aussen) {
      n.x = cx + Math.cos(n.w) * RING.a;
      n.y = cy + Math.sin(n.w) * RING.b;
    }
  }

  /* Etiketten setzen: nach außen zeigend. Ein Knoten links der Mitte trägt
     seine Schrift links, einer rechts der Mitte rechts — dann läuft nichts
     über das Bild hinein und der Punkt bleibt immer am Netz. */
  for (const n of nodes) {
    n.seite = n.mitte ? "mitte" : n.x < cx ? "links" : "rechts";
    // Mittelpunkt des Etikett-Kastens für die Entwirrung
    n.mx = n.x + (n.mitte ? 0 : (n.seite === "rechts" ? 1 : -1) * (PUNKT_ABSTAND + n.k.b / 2));
    n.my = n.y;
    n.fest = !!n.mitte;
  }
  entwirren(nodes);
  for (const n of nodes) {
    if (n.mitte) continue;
    n.x = n.mx - (n.seite === "rechts" ? 1 : -1) * (PUNKT_ABSTAND + n.k.b / 2);
    n.y = n.my;
  }

  /* Auf die Bühne passen. Skaliert werden nur die Abstände, nie die
     Schrift — sonst hätte eine Note mit drei Nachbarn plötzlich
     Plakatschrift und eine mit zwanzig Kleingedrucktes. */
  let l = Infinity, r = -Infinity, o = Infinity, u = -Infinity;
  for (const n of nodes) {
    const links_ = n.seite === "links" ? n.x - PUNKT_ABSTAND - n.k.b : n.seite === "mitte" ? n.x - n.k.b / 2 : n.x - 8;
    const rechts_ = n.seite === "rechts" ? n.x + PUNKT_ABSTAND + n.k.b : n.seite === "mitte" ? n.x + n.k.b / 2 : n.x + 8;
    l = Math.min(l, links_); r = Math.max(r, rechts_);
    o = Math.min(o, n.y - n.k.h / 2 - 4); u = Math.max(u, n.y + n.k.h / 2 + 4);
  }
  // Nur verkleinern, nie vergrößern: Der Ring hat die Größe schon bestimmt.
  // Würden wir ein Sternbild aus vier Knoten auf die volle Breite ziehen,
  // stünde die Schrift verloren in einem Feld aus Weiß — die Abstände
  // wüchsen, die Buchstaben nicht.
  const s = Math.min((W - 2 * P) / Math.max(1, r - l), 1);
  const vx = cx - ((l + r) / 2) * s;
  for (const n of nodes) n.x = Math.round((n.x * s + vx) * 10) / 10;

  // Die Bühne ist so hoch wie ihr Inhalt. Ein magerer Stern bekommt keinen
  // leeren Saal, ein dichter nicht zu wenig Luft.
  const hoehe = Math.min(Math.max(Math.round((u - o) * s) + 2 * P, 230), 640);
  const vy = hoehe / 2 - ((o + u) / 2) * s;
  for (const n of nodes) {
    n.y = Math.round((n.y * s + vy) * 10) / 10;
    delete n.fx; delete n.fy; delete n.vx; delete n.vy; delete n.mx; delete n.my; delete n.fest;
  }

  return {
    buehne: { breite: W, hoehe },
    nodes,
    links: links.map((l) => ({
      ...l,
      source: l.source.id ?? l.source,
      target: l.target.id ?? l.target,
    })),
    weitere: stern.weitere,
  };
}
