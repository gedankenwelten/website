/**
 * Gedankenraum (/raum/) — die zweite Fassung, das Museum: keine Röhren im All mehr, sondern
 * ein Museum mit hohen Sälen. Jede Note ist ein Saal.
 *
 *   Saal        quadratisch, hoch, mit Oberlicht. Die Wände tragen die Farbe der Rubrik.
 *               An der Stirnwand hängt groß das Bild der Note.
 *   Türen       führen in die Säle der verlinkten Notes. Über jeder Tür hängt das Bild des Saals
 *               dahinter (Supraporte), und durch die Tür sieht man schon hinein.
 *   Zufallstür  eine Tür je Saal führt irgendwohin in den Bestand, ohne Link: Goldbogen, darüber ein leerer
 *               Rahmen. Der Raum soll nicht führen, sondern zum Entdecken einladen (Andreas, 03.10.2026).
 *   Wandbilder  weitere Verknüpfungen, die keine Tür mehr bekommen haben.
 *   Seite       wie im Gedankenraum: ein Bild zuwenden (Rätsel), hineinfliegen, in der Note stehen.
 *
 * Bau: Nur der Saal, in dem man steht, ist „echt“. Hinter jeder Tür hängt der Nachbarsaal,
 * gezeichnet nur durch die Türöffnung (Stencil-Portal) — darum dürfen sich die Nachbarsäle
 * räumlich überlagern, ohne sich zu sehen. Geht man durch die Tür, wird der Nachbar zum Saal,
 * und hinter seinen Türen entstehen die nächsten. Die Räume sind innen größer als außen.
 *
 * Der Eingang ins Museum ist immer ein zufälliger Saal.
 * Osterei: Doppelklick aufs Banner einer Note (/raum-tor.js) → /raum/?von=/Pfad → man steht in der Note und tritt
 * aus ihr in ihren Saal. Dort führt derselbe Doppelklick aufs Banner wieder hinaus in den Raum.
 */
import * as THREE from "three";
import { CSS3DRenderer, CSS3DObject } from "three/addons/renderers/CSS3DRenderer.js";

const V = THREE.Vector3, M4 = THREE.Matrix4;
const { clamp, lerp } = THREE.MathUtils;

/* Rubrikfarben der Website (für den Punkt auf dem Schild). */
const FARBE = {
  Zeitgeist: "#9b87f5", Denker: "#818cf8", DenkerVita: "#dfa46a", Panorama: "#4fd1bf", Gedanken: "#f0b43c",
  Geistesblitz: "#facc15", Kultur: "#3fc5c3", GoodNews: "#6fd08a", Spuren: "#f07a8c", Vipassana: "#c8b99a",
};
const RUBRIKNAME = { DenkerVita: "Denker-Vita", GoodNews: "Good News" };
/* Wandfarben der Säle — die Rubrikfarbe, gedämpft wie Museumswände (Stoff, Kalk, Pigment). */
const WANDFARBE = {
  Zeitgeist: "#5d5470", Denker: "#4b5672", DenkerVita: "#8a5a43", Panorama: "#3f6863", Gedanken: "#8d6a3a",
  Geistesblitz: "#7d7240", Kultur: "#3d6670", GoodNews: "#56704f", Spuren: "#7a3f48", Vipassana: "#7d7364",
};

const T = 0.7;                // Wandstärke
const DW = 3.0, DH = 5.4;     // Tür: Breite, Scheitel (Rundbogen) — überall gleich, damit die Durchgänge aufeinanderpassen
const SOCKEL = 0.16;
const AUGE = 1.65;
const BILD_A = 2.4;           // Bildformat (Banner 1200×500)
const RAHMEN = 0.09;
const RAND = 0.45;            // wie nah man an die Wand darf
const TEMPO = 2.4, TEMPO_SCHNELL = 4.8;

/* Raumtypen. Wände: Name → [Abstand Mitte–Wand, Drehung θ, Länge]; die Wand schaut in Richtung (sin θ, 0, cos θ).
   Wand-lokal: x läuft (vom Raum aus gesehen) nach rechts, z zeigt in den Raum. „h“ trägt das Bild der Note,
   „v“ ist die Eingangswand. Tür- und Bildplätze: [Wand, Versatz(, Bildbreite)]. */
const rechteck = (B, L) => ({ h: [L / 2, 0, B], v: [L / 2, Math.PI, B], l: [B / 2, Math.PI / 2, L], r: [B / 2, -Math.PI / 2, L] });
const achteck = (a) => {
  const n = 2 * a * Math.tan(Math.PI / 8), q = Math.PI / 4;
  return { h: [a, 0, n], hr: [a, -q, n], r: [a, -2 * q, n], vr: [a, -3 * q, n], v: [a, Math.PI, n], vl: [a, 3 * q, n], l: [a, 2 * q, n], hl: [a, q, n] };
};
const TYPEN = {
  // der hohe Saal mit Oberlicht — die meisten Notes
  saal: { waende: rechteck(18, 18), H: 10.5, gesims: 7.4, decke: "licht", boden: "parkett", haupt: [2.75, 8.0], supra: true,
    tueren: [["l", 4.2], ["r", -4.2], ["l", -4.2], ["r", 4.2]],
    bilder: [["l", 0, 3.6], ["r", 0, 3.6], ["v", -5.4, 3.8], ["v", 5.4, 3.8]], baenke: [[0, 1.2, 3.0]], kanon: 4.8,
    portraets: [[-5.45, 3.3, 1.8], [5.45, 3.3, 1.8], [-5.45, 2.15, 1.8], [5.45, 2.15, 1.8]] },
  // das Kabinett: klein, still — für Gedanken, Vipassana und Notes mit wenigen Verbindungen
  kabinett: { waende: rechteck(9, 10), H: 7.2, gesims: 5.9, decke: "stuck", boden: "parkett", haupt: [2.3, 4.4], supra: false,
    tueren: [["l", 1.7], ["r", -1.7]],
    bilder: [["l", -2.6, 2.2], ["r", 2.6, 2.2], ["v", -3.1, 2.0], ["v", 3.1, 2.0]], baenke: [[0, .9, 1.8]], kanon: 3.3,
    portraets: [[-3.2, 2.85, 1.15], [3.2, 2.85, 1.15]] },
  // die lange Galerie: für Spuren (Zeit) und für Notes, an denen viel hängt — die Verbindungen reihen sich an den Wänden
  galerie: { waende: rechteck(12, 32), H: 9.5, gesims: 7.0, decke: "lichtband", boden: "parkett", haupt: [2.6, 6.8], supra: true,
    tueren: [["l", 9], ["r", -9], ["l", -9], ["r", 9]],
    bilder: [["l", 0, 3.4], ["r", 0, 3.4], ["l", 4.6, 3.2], ["r", -4.6, 3.2], ["l", -4.6, 3.2], ["r", 4.6, 3.2],
             ["l", 13.2, 3.0], ["r", -13.2, 3.0], ["l", -13.2, 3.0], ["r", 13.2, 3.0], ["v", -3.8, 2.6], ["v", 3.8, 2.6]],
    baenke: [[0, -7, 3.0], [0, 5, 3.0]], kanon: -1.5,
    portraets: [[-4.5, 3.1, 1.4], [4.5, 3.1, 1.4], [-4.5, 2.1, 1.4], [4.5, 2.1, 1.4]] },
  // die Rotunde unter der Kuppel: für Panoramen, die vieles zusammenschauen
  rotunde: { waende: achteck(8), H: 13, gesims: 8.6, decke: "kuppel", boden: "stein", haupt: [2.6, 5.0], supra: true,
    tueren: [["l", 0], ["r", 0], ["hl", 0], ["hr", 0]],
    bilder: [["vl", 0, 4.2], ["vr", 0, 4.2]], rundbank: 1.7, kanon: 4.6,
    portraets: [[-1.0, 4.25, 1.7], [1.0, 4.25, 1.7]] },
};
function typVon(i) {
  const r = K[i].r, g = GRAD[i];
  if (r === "Panorama") return "rotunde";
  if (r === "Spuren" || g >= 22) return "galerie";
  if (r === "Gedanken" || r === "Vipassana" || g <= 4) return "kabinett";
  return "saal";
}

const such = new URLSearchParams(location.search);
const VON = such.get("von"), VON_Y = +such.get("y") || 0;
const DUNKEL = new THREE.Color("#1c1916");

/* ══ Bühne ═══════════════════════════════════════════════════════════════ */
const canvas = document.getElementById("c");
const ausgangEl = document.getElementById("ausgang");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, stencil: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(devicePixelRatio, matchMedia("(pointer: coarse)").matches ? 1.6 : 2));
renderer.setSize(innerWidth, innerHeight);
const ANISO = renderer.capabilities.getMaxAnisotropy();
const scene = new THREE.Scene();
scene.background = DUNKEL;
/* Hochkant (Telefon) braucht ein weiteres Blickfeld, sonst sieht man vom Saal nur ein Bild. */
const blickfeld = () => innerWidth / innerHeight < 1 ? 78 : 64;
const camera = new THREE.PerspectiveCamera(blickfeld(), innerWidth / innerHeight, 0.05, 400);
camera.rotation.order = "YXZ";
scene.add(camera);
const tanH = () => Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));

scene.add(new THREE.HemisphereLight(0xfff6ea, 0x6b5a48, 2.1));
const sonne = new THREE.DirectionalLight(0xfff8ef, 1.3);
sonne.position.set(.35, 1, .2);
scene.add(sonne);

/* Die Seite: ein iframe mit der echten Note, von derselben Kamera ins Bild gesetzt. */
const css = new CSS3DRenderer();
css.setSize(innerWidth, innerHeight);
css.domElement.id = "buehne3d";
document.body.appendChild(css.domElement);
const camEl = css.domElement.firstChild.firstChild ?? css.domElement.firstChild;
const seiteEl = document.createElement("iframe");
seiteEl.id = "seite"; seiteEl.title = "Note";
Object.assign(seiteEl.style, { width: innerWidth + "px", height: innerHeight + "px" });
const seite = new CSS3DObject(seiteEl);
seiteEl.style.pointerEvents = "";
camEl.appendChild(seiteEl);
const cssScene = new THREE.Scene();
cssScene.add(seite);
let seiteZeigen = false;
let gemerkt = null;
function flach(an) {
  if (an) {
    gemerkt = { cam: camEl.style.transform, el: seiteEl.style.transform };
    camEl.style.transform = "none"; seiteEl.style.transform = "none";
    Object.assign(seiteEl.style, { left: "0px", top: "0px" });
  } else if (gemerkt) {
    camEl.style.transform = gemerkt.cam; seiteEl.style.transform = gemerkt.el; gemerkt = null;
  }
}
if (VON) {
  seiteEl.src = VON; seiteEl.dataset.fuer = decodeURIComponent(VON).normalize("NFC");
  seiteEl.style.transition = "none"; seiteEl.style.opacity = 1;
  flach(true);
  document.getElementById("schleier").style.display = "none";
  seiteEl.addEventListener("load", () => { try { seiteEl.contentWindow.scrollTo(0, VON_Y); } catch {} }, { once: true });
}

addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight; camera.fov = blickfeld(); camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight); css.setSize(innerWidth, innerHeight);
  if (zustand === "note") Object.assign(seiteEl.style, { width: innerWidth + "px", height: innerHeight + "px" });
});

/* ══ Daten ═══════════════════════════════════════════════════════════════ */
/* Das Netz der Notes, gebaut aus dem Index der Seite (`/raum/daten.json`): Säle, Türen, Wandsprüche, Daten.
   Die Saaltexte fürs Schild kommen erst, wenn jemand eines antippt. */
const roh = await fetch("/raum/daten.json").then((r) => r.json());
const raetsel = Object.fromEntries(roh.knoten.filter((k) => k.s).map((k) => [k.u, k.s]));
const schilder = Object.fromEntries(roh.knoten.map((k) => [k.u, { d: k.d }]));
let texte = null;
const texteHolen = () => (texte ??= fetch("/raum/texte.json").then((r) => r.json()).catch(() => ({})));
await Promise.race([document.fonts.load('120px "Parisienne"'), new Promise((r) => setTimeout(r, 2500))]).catch(() => {});
const K = roh.knoten, N = K.length;
const nachUrl = new Map(K.map((k, i) => [k.u.normalize("NFC"), i]));
const kanten = K.map(() => new Map());
for (const [a, b, w] of roh.kanten) {
  if (a === b) continue;
  kanten[a].set(b, Math.max(w, kanten[a].get(b) ?? 0));
  kanten[b].set(a, Math.max(w, kanten[b].get(a) ?? 0));
}
/* Verknüpfungen einer Note. Keine Rangfolge nach Vernetzung — die führte immer wieder zu denselben
   Knotenpunkten, man lief im Kreis. Ordnung kommt erst beim Bau eines Saals: das Unbekannte zuerst. */
const LINKS = kanten.map((m) => [...m.keys()]);
const GRAD = kanten.map((m) => m.size);
const zufall = (a, b) => { let h = (a * 73856093) ^ (b * 19349663) ^ SAAT; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

/* Das Gedächtnis des Rundgangs: wo man stand, welche Bilder man schon gesehen hat (über Besuche hinweg). */
const GEDAECHTNIS = "gedankenmuseum:v1";
const SAAT = (Math.random() * 1e9) | 0;    // jeder Besuch ein etwas anderer Rundgang
const besucht = new Set(), gesehen = new Map();
try {
  const g = JSON.parse(localStorage.getItem(GEDAECHTNIS) || "{}");
  for (const u of g.b ?? []) if (nachUrl.has(u)) besucht.add(nachUrl.get(u));
  for (const [u, n] of g.g ?? []) if (nachUrl.has(u)) gesehen.set(nachUrl.get(u), n);
} catch {}
let merkenAus = null;
function merken() {
  clearTimeout(merkenAus);
  merkenAus = setTimeout(() => {
    try {
      localStorage.setItem(GEDAECHTNIS, JSON.stringify({
        b: [...besucht].map((i) => K[i].u), g: [...gesehen].map(([i, n]) => [K[i].u, n]),
      }));
    } catch {}
  }, 800);
}
/* Wie frisch ist eine Tür? Nie betretene Säle, nie gesehene Bilder zuerst; Sackgassen (kaum Links) nach hinten. */
function frische(j) {
  return (besucht.has(j) ? 40 : 0) + Math.min(gesehen.get(j) ?? 0, 6) * 4 + (GRAD[j] < 3 ? 9 : 0)
    - (GRAD[j] >= 3 && GRAD[j] <= 14 ? 2 : 0) + zufall(j, besucht.size) * 5;
}

/* ══ Texturen aus der Hand: Wand, Decke, Boden, Licht ════════════════════ */
function leinwand(w, h, malen) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  malen(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = ANISO;
  return t;
}
function koerner(g, w, h, menge, alpha) {
  for (let n = 0; n < menge; n++) {
    g.fillStyle = Math.random() < .5 ? `rgba(0,0,0,${alpha * Math.random()})` : `rgba(255,255,255,${alpha * Math.random()})`;
    g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 1 + Math.random() * 2);
  }
}
const wandTexturen = new Map();
function wandTextur(rubrik, H, gesims) {
  const key = `${rubrik}|${H}|${gesims}`;
  if (wandTexturen.has(key)) return wandTexturen.get(key);
  const basis = new THREE.Color(WANDFARBE[rubrik] ?? "#6b655c");
  const ton = (f) => "#" + basis.clone().multiplyScalar(f).getHexString();
  const t = leinwand(256, 1024, (g, w, h) => {      // 4 m breit, eine Wandhöhe hoch
    const py = (y) => (1 - y / H) * h;
    let v = g.createLinearGradient(0, py(H), 0, py(gesims));
    v.addColorStop(0, "#f6f1e9"); v.addColorStop(1, "#ddd6ca");
    g.fillStyle = v; g.fillRect(0, 0, w, py(gesims));
    v = g.createLinearGradient(0, py(gesims), 0, py(SOCKEL));
    v.addColorStop(0, ton(1.08)); v.addColorStop(.55, ton(1)); v.addColorStop(1, ton(.8));
    g.fillStyle = v; g.fillRect(0, py(gesims), w, py(SOCKEL) - py(gesims));
    g.fillStyle = "#2f2a25"; g.fillRect(0, py(SOCKEL), w, h - py(SOCKEL));
    g.fillStyle = "rgba(255,255,255,.07)"; g.fillRect(0, py(SOCKEL) - 1, w, 1);
    v = g.createLinearGradient(0, py(SOCKEL), 0, py(1.2));
    v.addColorStop(0, "rgba(20,14,8,.16)"); v.addColorStop(1, "rgba(20,14,8,0)");
    g.fillStyle = v; g.fillRect(0, py(1.2), w, py(SOCKEL) - py(1.2));
    koerner(g, w, h, 9000, .05);
  });
  t.wrapS = THREE.RepeatWrapping;
  t.repeat.set(1 / 4, 1 / H);
  wandTexturen.set(key, t);
  return t;
}
/* Ecken ein wenig dunkler — wie Licht, das von oben kommt */
const ECKSCHATTEN = leinwand(128, 4, (g, w, h) => {
  const v = g.createLinearGradient(0, 0, w, 0);
  v.addColorStop(0, "rgba(20,14,8,.3)"); v.addColorStop(1, "rgba(20,14,8,0)");
  g.fillStyle = v; g.fillRect(0, 0, w, h);
});
const DECKE = leinwand(1024, 1024, (g, w, h) => {
  g.fillStyle = "#e4ded3"; g.fillRect(0, 0, w, h);
  const a = w * .17, b = w - 2 * a;
  // die Lichtdecke: Mattglas zwischen schlanken Sprossen
  const v = g.createRadialGradient(w / 2, h / 2, b * .1, w / 2, h / 2, b * .75);
  v.addColorStop(0, "#fffcf6"); v.addColorStop(1, "#f1e9db");
  g.fillStyle = "#c9c0b1"; g.fillRect(a - 14, a - 14, b + 28, b + 28);
  g.fillStyle = v; g.fillRect(a, a, b, b);
  g.strokeStyle = "rgba(160,148,128,.55)"; g.lineWidth = 3;
  for (let k = 1; k < 8; k++) {
    const p = a + b * k / 8;
    g.beginPath(); g.moveTo(p, a); g.lineTo(p, a + b); g.stroke();
    g.beginPath(); g.moveTo(a, p); g.lineTo(a + b, p); g.stroke();
  }
  // Kassetten im Rand
  g.strokeStyle = "rgba(120,108,92,.18)"; g.lineWidth = 2;
  for (let k = 0; k < 6; k++) {
    const p = k * w / 6;
    g.strokeRect(p + 10, 10, w / 6 - 20, a - 34); g.strokeRect(p + 10, h - a + 24, w / 6 - 20, a - 34);
  }
  koerner(g, w, h, 12000, .04);
});
DECKE.channel = 1;
const LICHTBAND = leinwand(512, 1365, (g, w, h) => {
  g.fillStyle = "#e4ded3"; g.fillRect(0, 0, w, h);
  const x0 = w * .22, x1 = w * .78, y0 = h * .07, y1 = h * .93;
  g.fillStyle = "#c9c0b1"; g.fillRect(x0 - 10, y0 - 10, x1 - x0 + 20, y1 - y0 + 20);
  const v = g.createLinearGradient(x0, 0, x1, 0);
  v.addColorStop(0, "#f3ebdd"); v.addColorStop(.5, "#fffcf6"); v.addColorStop(1, "#f3ebdd");
  g.fillStyle = v; g.fillRect(x0, y0, x1 - x0, y1 - y0);
  g.strokeStyle = "rgba(160,148,128,.55)"; g.lineWidth = 3;
  for (let k = 1; k < 4; k++) { const x = x0 + (x1 - x0) * k / 4; g.beginPath(); g.moveTo(x, y0); g.lineTo(x, y1); g.stroke(); }
  for (let k = 1; k < 21; k++) { const y = y0 + (y1 - y0) * k / 21; g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.stroke(); }
  koerner(g, w, h, 9000, .04);
});
LICHTBAND.channel = 1;
const STUCK = leinwand(512, 512, (g, w, h) => {   // Kabinettdecke: Putz, Profilrahmen, Rosette
  const v = g.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w * .7);
  v.addColorStop(0, "#f1ece3"); v.addColorStop(1, "#d6cfc2");
  g.fillStyle = v; g.fillRect(0, 0, w, h);
  g.strokeStyle = "rgba(120,108,92,.35)"; g.lineWidth = 3;
  g.strokeRect(w * .1, h * .1, w * .8, h * .8); g.strokeRect(w * .13, h * .13, w * .74, h * .74);
  for (const r of [70, 54, 40, 18]) { g.beginPath(); g.arc(w / 2, h / 2, r, 0, 2 * Math.PI); g.stroke(); }
  for (let k = 0; k < 16; k++) {
    const a = k * Math.PI / 8; g.beginPath();
    g.ellipse(w / 2 + Math.cos(a) * 47, h / 2 + Math.sin(a) * 47, 9, 4, a, 0, 2 * Math.PI); g.stroke();
  }
  koerner(g, w, h, 6000, .04);
});
STUCK.channel = 1;
const KUPPEL = leinwand(1024, 512, (g, w, h) => {   // u läuft rundum, oben (Zeile 0) ist der Scheitel
  const v = g.createLinearGradient(0, 0, 0, h);
  v.addColorStop(0, "#fffdf8"); v.addColorStop(.18, "#f2ece2"); v.addColorStop(1, "#d3cbbd");
  g.fillStyle = v; g.fillRect(0, 0, w, h);
  const reihen = 5, spalten = 24;
  for (let r = 0; r < reihen; r++) {
    const ya = h * (.24 + r * .15), yb = ya + h * .11;
    for (let c = 0; c < spalten; c++) {
      const xa = c * w / spalten + 6, xb = (c + 1) * w / spalten - 6;
      g.fillStyle = "rgba(90,78,62,.16)"; g.fillRect(xa, ya, xb - xa, yb - ya);
      g.fillStyle = "rgba(255,255,255,.35)"; g.fillRect(xa, yb - 3, xb - xa, 3);
      g.fillStyle = "rgba(60,50,38,.18)"; g.fillRect(xa, ya, xb - xa, 3);
    }
  }
  g.fillStyle = "#fffefb"; g.fillRect(0, 0, w, h * .1);   // das Auge der Kuppel: Licht
  g.fillStyle = "rgba(150,138,118,.6)"; g.fillRect(0, h * .1, w, 4);
  koerner(g, w, h, 8000, .03);
});
const PARKETT = leinwand(1024, 1024, (g, w, h) => {
  const reihen = 20, rb = w / reihen;
  for (let r = 0; r < reihen; r++) {
    let y = -Math.random() * h;
    while (y < h) {
      const L = h * (.27 + Math.random() * .4);
      const c = new THREE.Color().setHSL(.068 + Math.random() * .02, .36 + Math.random() * .14, .27 + Math.random() * .09, THREE.SRGBColorSpace);
      for (const dy of [0, h]) {   // nahtlos über den Rand
        const x = r * rb, yy = y + dy - (y + L > h ? h : 0);
        g.fillStyle = "#" + c.getHexString(); g.fillRect(x, yy, rb, L);
        for (let s = 0; s < 7; s++) {   // Maserung
          g.fillStyle = `rgba(${Math.random() < .5 ? "40,22,10" : "255,230,190"},${.05 + Math.random() * .06})`;
          g.fillRect(x + Math.random() * rb, yy, 1 + Math.random() * 2, L);
        }
        g.fillStyle = "rgba(14,7,2,.6)"; g.fillRect(x, yy, rb, 1.5); g.fillRect(x, yy, 1.5, L);
      }
      y += L;
    }
  }
  koerner(g, w, h, 20000, .05);
});
PARKETT.wrapS = PARKETT.wrapT = THREE.RepeatWrapping;
PARKETT.repeat.set(1 / 3, 1 / 3);   // Böden tragen UV in Metern
const BODEN_AO = leinwand(256, 256, (g, w, h) => {
  g.fillStyle = "#fff"; g.fillRect(0, 0, w, h);
  const r = 18;
  for (const [x0, y0, x1, y1] of [[0, 0, r, 0], [w, 0, w - r, 0], [0, 0, 0, r], [0, h, 0, h - r]]) {
    const v = g.createLinearGradient(x0, y0, x1, y1);
    v.addColorStop(0, "rgba(0,0,0,.5)"); v.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = v; g.fillRect(0, 0, w, h);
  }
  const m = g.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w * .72);
  m.addColorStop(0, "rgba(255,255,255,0)"); m.addColorStop(1, "rgba(0,0,0,.28)");
  g.fillStyle = m; g.fillRect(0, 0, w, h);
});
BODEN_AO.colorSpace = THREE.NoColorSpace;
BODEN_AO.channel = 1;
const STEIN = leinwand(1024, 1024, (g, w, h) => {   // Rotunde: Marmorplatten im Wechsel, 4 × 4 m
  const n = 4, q = w / n;
  for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) {
    const hell = (a + b) % 2 === 0, c = new THREE.Color(hell ? "#d9d2c5" : "#a99f90").offsetHSL(0, 0, (Math.random() - .5) * .03);
    g.fillStyle = "#" + c.getHexString(); g.fillRect(a * q, b * q, q, q);
    g.save(); g.beginPath(); g.rect(a * q, b * q, q, q); g.clip();
    for (let k = 0; k < 5; k++) {   // Adern
      g.strokeStyle = `rgba(${hell ? "120,108,96" : "70,62,52"},${.08 + Math.random() * .12})`; g.lineWidth = .6 + Math.random() * 1.6;
      g.beginPath(); g.moveTo(a * q + Math.random() * q, b * q);
      g.bezierCurveTo(a * q + Math.random() * q, b * q + q * .3, a * q + Math.random() * q, b * q + q * .7, a * q + Math.random() * q, b * q + q);
      g.stroke();
    }
    g.restore();
    g.fillStyle = "rgba(40,32,24,.45)"; g.fillRect(a * q, b * q, q, 1.5); g.fillRect(a * q, b * q, 1.5, q);
  }
  koerner(g, w, h, 14000, .04);
});
STEIN.wrapS = STEIN.wrapT = THREE.RepeatWrapping;
STEIN.repeat.set(1 / 4, 1 / 4);
const GLANZ = leinwand(256, 256, (g, w, h) => {
  const v = g.createRadialGradient(w / 2, h * .42, 4, w / 2, h / 2, w / 2);
  v.addColorStop(0, "rgba(255,238,210,1)"); v.addColorStop(.45, "rgba(255,230,195,.45)"); v.addColorStop(1, "rgba(255,225,190,0)");
  g.fillStyle = v; g.fillRect(0, 0, w, h);
});
const DURCHBLICK = leinwand(64, 256, (g, w, h) => {   // Licht aus dem übernächsten Saal
  const v = g.createLinearGradient(0, 0, 0, h);
  v.addColorStop(0, "#f4eee4"); v.addColorStop(.7, "#cfc5b6"); v.addColorStop(1, "#8f8370");
  g.fillStyle = v; g.fillRect(0, 0, w, h);
});

/* Das Wandschild: Rubrik, Titel, Datum — klein, wie in jeder Galerie. */
const SCHILD_B = .58, SCHILD_H = .36;
function datumText(d) {
  if (!d) return "";
  const [y, m, t] = d.split("-").map(Number);
  return t ? `${t}. ${["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"][m - 1]} ${y}` : String(y);
}
function schildTextur(i) {
  const k = K[i], d = schilder[k.u]?.d;
  return leinwand(640, 393, (g, w, h) => {
    g.fillStyle = "#f4efe6"; g.fillRect(0, 0, w, h);
    g.strokeStyle = "rgba(90,80,68,.18)"; g.lineWidth = 2; g.strokeRect(1, 1, w - 2, h - 2);
    const x = 40;
    g.fillStyle = FARBE[k.r] ?? "#999"; g.beginPath(); g.arc(x + 8, 56, 8, 0, 2 * Math.PI); g.fill();
    g.fillStyle = "#6d645a"; g.font = "600 24px ui-sans-serif, system-ui, sans-serif";
    g.letterSpacing = "5px"; g.fillText((RUBRIKNAME[k.r] ?? k.r).toUpperCase(), x + 28, 65);
    g.letterSpacing = "0px";
    g.fillStyle = "#2b2621"; g.font = "600 46px Georgia, serif";
    const worte = k.t.split(/\s+/), zeilen = [];
    let z = "";
    for (const wort of worte) {
      const probe = z ? z + " " + wort : wort;
      if (g.measureText(probe).width > w - 2 * x && z) { zeilen.push(z); z = wort; } else z = probe;
    }
    if (z) zeilen.push(z);
    if (zeilen.length > 4) { zeilen.length = 4; zeilen[3] = zeilen[3].replace(/\s*\S*$/, " …"); }
    zeilen.forEach((zeile, n) => g.fillText(zeile, x, 138 + n * 56));
    g.fillStyle = "#8a8076"; g.font = "400 24px ui-sans-serif, system-ui, sans-serif";
    g.fillText(datumText(d), x, h - 36);
  });
}

/* Der Wandspruch: der geheimnisvolle Satz der Note, in Schreibschrift über dem Bild, weiß auf die Wand gemalt. */
function spruchTextur(satz, breite, hoehe) {
  const W = 2048, Hh = Math.round(W * hoehe / breite);
  return leinwand(W, Hh, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    // lieber eine Zeile — erst wenn die Schrift dafür zu klein würde, zwei
    const font = (gr) => (g.font = `${gr}px Parisienne, "Snell Roundhand", cursive`);
    font(100);
    const eine = Math.min(h * .62, 100 * w * .94 / g.measureText(satz).width);
    let gr = Math.floor(eine), zeilen = [satz];
    if (eine < h * .36) {
      for (gr = Math.round(h * .42); gr > 40; gr -= 4) {
        font(gr); zeilen = []; let z = "";
        for (const wort of satz.split(/\s+/)) {
          const probe = z ? z + " " + wort : wort;
          if (g.measureText(probe).width > w * .94 && z) { zeilen.push(z); z = wort; } else z = probe;
        }
        zeilen.push(z);
        if (zeilen.length <= 2) break;
      }
    }
    font(gr);
    g.textAlign = "center"; g.textBaseline = "middle";
    g.fillStyle = "rgba(255,250,240,1)";
    const y0 = h / 2 - (zeilen.length - 1) * gr * 1.15 / 2;
    zeilen.forEach((zeile, n) => g.fillText(zeile, w / 2, y0 + n * gr * 1.15));
  });
}

/* ══ Formen (geteilt, nie entsorgt) ══════════════════════════════════════ */
const EBENE = new THREE.PlaneGeometry(1, 1);
const KISTE = new THREE.BoxGeometry(1, 1, 1);
const BOGEN = DH - DW / 2;
function tuerUmriss(form, o) {
  form.lineTo(o - DW / 2, 0); form.lineTo(o - DW / 2, BOGEN);
  form.absarc(o, BOGEN, DW / 2, Math.PI, 0, true);
  form.lineTo(o + DW / 2, 0);
}
const wandFormen = new Map();
function wandForm(tueren, len, H) {   // eine Wandscheibe mit Rundbogen-Durchgängen, als ein Umriss (ohne Löcher)
  const key = `${len}|${H}|${tueren.join(",")}`;
  if (wandFormen.has(key)) return wandFormen.get(key);
  const f = new THREE.Shape();
  f.moveTo(-len / 2, 0);
  for (const o of [...tueren].sort((a, b) => a - b)) tuerUmriss(f, o);
  f.lineTo(len / 2, 0); f.lineTo(len / 2, H); f.lineTo(-len / 2, H); f.lineTo(-len / 2, 0);
  const geo = new THREE.ExtrudeGeometry(f, { depth: T, bevelEnabled: false, curveSegments: 28 });
  geo.translate(0, 0, -T);
  wandFormen.set(key, geo);
  return geo;
}
/* Grundriss eines Raumtyps: die Ecken der Innenwände, im Umlauf. */
function grundriss(typ) {
  const w = Object.values(typ.waende);
  if (w.length === 8) {
    const rc = w[0][0] / Math.cos(Math.PI / 8);
    return [...Array(8)].map((_, k) => { const a = Math.PI / 8 + k * Math.PI / 4; return [rc * Math.sin(a), -rc * Math.cos(a)]; });
  }
  const B = typ.waende.h[2], L = typ.waende.l[2];
  return [[-B / 2, -L / 2], [B / 2, -L / 2], [B / 2, L / 2], [-B / 2, L / 2]];
}
/* Boden oder Decke: uv in Metern (Muster), uv1 auf die Fläche normiert (Licht, Schatten). */
function flaeche(pts, oben, loch) {
  const f = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, oben ? z : -z)));
  if (loch) { const l = new THREE.Path(); l.absarc(0, 0, loch, 0, 2 * Math.PI, true); f.holes.push(l); }
  const geo = new THREE.ShapeGeometry(f, 48);
  const uv = geo.attributes.uv, n = uv.count, xs = pts.map((p) => p[0]), zs = pts.map((p) => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), z0 = Math.min(...zs), z1 = Math.max(...zs);
  const uv1 = new Float32Array(n * 2), pos = geo.attributes.position;
  for (let k = 0; k < n; k++) {
    const x = pos.getX(k), y = pos.getY(k), z = oben ? y : -y;
    uv1[2 * k] = (x - x0) / (x1 - x0); uv1[2 * k + 1] = oben ? (z - z0) / (z1 - z0) : 1 - (z - z0) / (z1 - z0);
  }
  geo.setAttribute("uv1", new THREE.BufferAttribute(uv1, 2));
  geo.rotateX(oben ? Math.PI / 2 : -Math.PI / 2);
  return geo;
}
const ECKE = new THREE.PlaneGeometry(1, 1).translate(.5, .5, 0);
const TUERFLAECHE = (() => {
  const f = new THREE.Shape(); f.moveTo(-DW / 2, 0); f.lineTo(-DW / 2, BOGEN);
  f.absarc(0, BOGEN, DW / 2, Math.PI, 0, true); f.lineTo(DW / 2, 0);
  return new THREE.ShapeGeometry(f, 28);
})();
const SCHWELLE = new THREE.PlaneGeometry(DW, T).rotateX(-Math.PI / 2);   // Steinschwelle in der Wandstärke
const BOGENBAND = (() => {   // die Archivolte um eine Rundbogentür: ein Band, als ein Umriss
  const i = DW / 2, a = i + .2, f = new THREE.Shape();
  f.moveTo(-a, 0); f.lineTo(-a, BOGEN); f.absarc(0, BOGEN, a, Math.PI, 0, true); f.lineTo(a, 0);
  f.lineTo(i, 0); f.lineTo(i, BOGEN); f.absarc(0, BOGEN, i, 0, Math.PI, false); f.lineTo(-i, 0);
  return new THREE.ExtrudeGeometry(f, { depth: .06, bevelEnabled: false, curveSegments: 28 });
})();
const raumFormen = new Map();
function raumForm(name) {
  if (raumFormen.has(name)) return raumFormen.get(name);
  const typ = TYPEN[name], pts = grundriss(typ), kuppel = typ.decke === "kuppel";
  const r = kuppel ? typ.waende.h[0] - .4 : 0;
  const f = {
    boden: flaeche(pts, false),
    decke: flaeche(pts, true, r || undefined).translate(0, typ.H, 0),
    kuppel: kuppel ? new THREE.SphereGeometry(r, 64, 20, 0, 2 * Math.PI, 0, Math.PI / 2).translate(0, typ.H, 0) : null,
  };
  raumFormen.set(name, f);
  return f;
}

/* ══ Laden ═══════════════════════════════════════════════════════════════ */
const lader = new THREE.TextureLoader();
const warte = []; let laufend = 0;
function lade(url, prio) {
  return new Promise((res, rej) => { warte.push({ url, res, rej, prio }); warte.sort((a, b) => a.prio - b.prio); pumpe(); });
}
function pumpe() {
  while (laufend < 6 && warte.length) {
    const j = warte.shift(); laufend++;
    lader.load(j.url, (t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = ANISO; laufend--; pumpe(); j.res(t); },
      undefined, (e) => { laufend--; pumpe(); j.rej(e); });
  }
}
const url = {
  mini: (k) => k.v ? k.v.replace("/vorschau/", "/vorschau/klein/") : k.b,   // 320 px, für die Säle hinter den Türen
  mittel: (k) => k.v ?? k.b,                                                // 760 px
  voll: (k) => k.b,                                                         // das Banner selbst
};
const RANG = { mini: 1, mittel: 2, voll: 3 };
const texturen = new Map();   // "i:stufe" → { p, t, n }
function textur(i, stufe, prio = 0) {
  const key = `${i}:${stufe}`;
  let e = texturen.get(key);
  if (!e) {
    e = { n: 0, t: null };
    // fehlt die kleine Fassung (noch nicht gerechnet), nimmt der Saal die nächstgrößere
    e.p = lade(url[stufe](K[i]), prio).catch((f) => stufe === "mini" ? lade(url.mittel(K[i]), prio) : Promise.reject(f)).then((t) => (e.t = t));
    texturen.set(key, e);
  }
  e.n++; return e;
}
function freigeben(i, stufe) {
  const key = `${i}:${stufe}`, e = texturen.get(key);
  if (!e) return;
  if (--e.n <= 0) e.p.then((t) => { if (e.n <= 0 && texturen.get(key) === e) { t.dispose(); texturen.delete(key); } }).catch(() => texturen.delete(key));
}
/* Ein Bild füllt seinen Rahmen (Format 2,4 : 1) — mittig zugeschnitten. */
function zuschnitt(t) {
  const c = t.clone(); c.needsUpdate = true;
  const a = t.image.width / t.image.height;
  if (a > BILD_A) { c.repeat.set(BILD_A / a, 1); c.offset.set((1 - BILD_A / a) / 2, 0); }
  else { c.repeat.set(1, a / BILD_A); c.offset.set(0, (1 - a / BILD_A) / 2); }
  return c;
}
function bildStufe(bild, stufe, prio) {
  if (bild.weg || (bild.stufe && RANG[bild.stufe] >= RANG[stufe]) || bild.will === stufe) return;
  bild.will = stufe;
  const e = textur(bild.i, stufe, prio);
  e.p.then((t) => {
    if (bild.weg || bild.will !== stufe) { freigeben(bild.i, stufe); return; }
    const alt = bild.stufe, m = bild.mesh.material;
    m.map?.dispose();
    m.map = zuschnitt(t); m.color.set(0xffffff); m.needsUpdate = true;
    bild.stufe = stufe;
    if (alt) freigeben(bild.i, alt);
  }).catch(() => { if (bild.will === stufe) bild.will = null; freigeben(bild.i, stufe); });
}

/* ══ Säle ════════════════════════════════════════════════════════════════ */
const ROT_Y = new M4().makeRotationY(Math.PI);
function wandMatrix([a, th]) {
  return new M4().makeRotationY(th).setPosition(-Math.sin(th) * a, 0, -Math.cos(th) * a);
}
/* Eine Note, ein Saal. „von“ ist die Note, aus der man kommt — sie liegt hinter der Eingangstür. */
/* Ein Ziel irgendwo im Bestand — kein Link, nur Zufall. Lieber Unbetretenes, lieber keine Sackgasse. */
function zufallsZiel(...ausser) {
  for (let n = 0; n < 80; n++) {
    const j = Math.floor(Math.random() * N);
    if (ausser.includes(j) || GRAD[j] < 3) continue;
    if (ausser.some((a) => kanten[a]?.has(j))) continue;
    if (n < 50 && besucht.has(j)) continue;
    return j;
  }
  return Math.floor(Math.random() * N);
}
function plan(i, von) {
  const links = LINKS[i], typ = TYPEN[typVon(i)];
  if (von === undefined || von === null) von = links.length ? [...links].sort((a, b) => frische(a) - frische(b))[0] : zufallsZiel(i);
  let rest = links.filter((j) => j !== von).sort((a, b) => frische(a) - frische(b));
  // Die Menschen hinter der Note hängen als kleine Porträts ums große Bild — gegenseitig verlinkte zuerst.
  const menschen = rest.filter((j) => K[j].r === "DenkerVita")
    .sort((a, b) => (kanten[i].get(b) - kanten[i].get(a)) || frische(a) - frische(b))
    .slice(0, typ.portraets.length);
  rest = rest.filter((j) => !menschen.includes(j));
  const portraets = menschen.map((ziel, k) => ({ ziel, platz: typ.portraets[k] }));
  const tueren = [{ ziel: von, wand: "v", o: 0 }], bilder = [];
  const plaetze = typ.tueren, zp = Math.floor(Math.random() * plaetze.length);
  plaetze.forEach(([wand, o], k) => {
    if (k === zp) tueren.push({ ziel: zufallsZiel(i, von), wand, o, zufall: true });
    else if (rest.length) tueren.push({ ziel: rest.shift(), wand, o });
  });
  for (const [wand, o, b] of typ.bilder) { if (!rest.length) break; bilder.push({ ziel: rest.shift(), wand, o, b }); }
  return { i, von, tueren, bilder, portraets };
}

const saele = new Set();
function baueSaal(i, von) {
  const p = plan(i, von), r = K[i].r, typName = typVon(i), typ = TYPEN[typName], H = typ.H;
  const g = new THREE.Group(); g.matrixAutoUpdate = false;
  const saal = { i, von: p.von, typ, g, mats: [], bilder: [], tueren: [], klickbar: [], hindernisse: [], waende: [], texturen: [], rolle: null };
  const mat = (m) => (saal.mats.push(m), m);
  const wandMat = mat(new THREE.MeshBasicMaterial({ map: wandTextur(r, H, typ.gesims) }));
  const laibungMat = mat(new THREE.MeshLambertMaterial({ color: new THREE.Color(WANDFARBE[r] ?? "#6b655c").lerp(new THREE.Color("#d9d2c6"), .35) }));
  const stuckMat = mat(new THREE.MeshLambertMaterial({ color: 0xe9e3d8 }));
  const rahmenMat = mat(new THREE.MeshLambertMaterial({ color: 0x3a3029 }));
  const glanzMat = mat(new THREE.MeshBasicMaterial({ map: GLANZ, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: .2 }));
  const durchMat = mat(new THREE.MeshBasicMaterial({ map: DURCHBLICK }));
  const steinMat = mat(new THREE.MeshLambertMaterial({ color: 0x9a9084 }));
  const goldMat = mat(new THREE.MeshLambertMaterial({ color: 0xc29a52, emissive: 0x3a2a10 }));

  const formen = raumForm(typName);
  const boden = new THREE.Mesh(formen.boden, mat(new THREE.MeshBasicMaterial({ map: typ.boden === "stein" ? STEIN : PARKETT, aoMap: BODEN_AO, aoMapIntensity: 1 })));
  boden.userData.boden = true;
  const deckenMap = { licht: DECKE, lichtband: LICHTBAND, stuck: STUCK }[typ.decke];
  const decke = new THREE.Mesh(formen.decke, mat(deckenMap ? new THREE.MeshBasicMaterial({ map: deckenMap }) : new THREE.MeshBasicMaterial({ color: 0xdcd5c9 })));
  g.add(boden, decke);
  if (formen.kuppel) g.add(new THREE.Mesh(formen.kuppel, mat(new THREE.MeshBasicMaterial({ map: KUPPEL, side: THREE.BackSide }))));
  saal.klickbar.push(boden);
  const schattenMat = mat(new THREE.MeshBasicMaterial({ map: ECKSCHATTEN, transparent: true, depthWrite: false, opacity: Object.keys(typ.waende).length === 8 ? .45 : 1 }));

  const waende = {};
  for (const [w, d] of Object.entries(typ.waende)) {
    const len = d[2];
    const o = new THREE.Group(); o.matrixAutoUpdate = false; o.matrix.copy(wandMatrix(d));
    const offen = p.tueren.filter((t) => t.wand === w).map((t) => t.o);
    const scheibe = new THREE.Mesh(wandForm(offen, len, H), [wandMat, laibungMat]);
    const gesims = new THREE.Mesh(KISTE, stuckMat); gesims.scale.set(len + .2, .2, .16); gesims.position.set(0, typ.gesims + .02, .08);
    const kehle = new THREE.Mesh(KISTE, stuckMat); kehle.scale.set(len + .3, .34, .3); kehle.position.set(0, H - .17, .15);
    const eckeL = new THREE.Mesh(ECKE, schattenMat); eckeL.scale.set(1.1, H, 1); eckeL.position.set(-len / 2, 0, .006);
    const eckeR = new THREE.Mesh(ECKE, schattenMat); eckeR.scale.set(-1.1, H, 1); eckeR.position.set(len / 2, 0, .006);
    o.add(scheibe, gesims, kehle, eckeL, eckeR);
    g.add(o); waende[w] = o;
    saal.klickbar.push(scheibe);
    const n = new V(Math.sin(d[1]), 0, Math.cos(d[1]));
    saal.waende.push({ n, pos: n.clone().multiplyScalar(-d[0]) });
  }

  const bildAn = (wand, j, art, x, y, b, licht = true) => {
    const h = b / BILD_A, o = waende[wand];
    const rahmen = new THREE.Mesh(KISTE, rahmenMat);
    rahmen.scale.set(b + 2 * RAHMEN, h + 2 * RAHMEN, .07); rahmen.position.set(x, y, .035);
    const m = new THREE.Mesh(EBENE, mat(new THREE.MeshBasicMaterial({ color: 0x4a423a })));
    m.scale.set(b, h, 1); m.position.set(x, y, .072);
    o.add(rahmen, m);
    if (licht) {
      const kegel = new THREE.Mesh(EBENE, glanzMat);
      kegel.scale.set(b * 1.7, h * 2.6, 1); kegel.position.set(x, y + h * .35, .012);
      o.add(kegel);
    }
    const bild = { i: j, art, mesh: m, b, h, saal, stufe: null, will: null };
    m.userData.bild = bild;
    saal.bilder.push(bild); saal.klickbar.push(m);
    bildStufe(bild, "mini", 3);
    return bild;
  };
  saal.haupt = bildAn("h", i, "haupt", 0, typ.haupt[0], typ.haupt[1]);
  for (const { ziel, platz: [x, y, b] } of p.portraets) bildAn("h", ziel, "portraet", x, y, b, false);
  const satz = raetsel[K[i].u];
  if (satz) {
    const [hy, hb] = typ.haupt, len = typ.waende.h[2];
    const oben = Math.max(hy + hb / BILD_A / 2 + RAHMEN, ...p.portraets.map(({ platz: [, y, b] }) => y + b / BILD_A / 2 + RAHMEN));
    const breite = Math.min(hb * .85, len - 1.6), hoehe = Math.min(1.0, typ.gesims - oben - .5);
    const tex = spruchTextur(satz, breite, hoehe);
    saal.texturen.push(tex);
    const spruch = new THREE.Mesh(EBENE, mat(new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0 })));
    spruch.scale.set(breite, hoehe, 1); spruch.position.set(0, oben + .3 + hoehe / 2, .014);
    waende.h.add(spruch);
    saal.spruch = spruch;
  }
  {
    // das Schild rechts neben dem Bild — reicht die Wand nicht, rechts darunter
    const [hy, hb] = typ.haupt, hh = hb / BILD_A, len = typ.waende.h[2];
    const daneben = hb / 2 + .7 + SCHILD_B < len / 2 - .3;
    const x = daneben ? hb / 2 + .7 + SCHILD_B / 2 : hb / 2 - SCHILD_B / 2, y = daneben ? 1.42 : hy - hh / 2 - RAHMEN - .42;
    const tex = schildTextur(i);
    saal.texturen.push(tex);
    const tafel = new THREE.Mesh(KISTE, mat(new THREE.MeshLambertMaterial({ color: 0xdcd5c9 })));
    tafel.scale.set(SCHILD_B, SCHILD_H, .018); tafel.position.set(x, y, .009);
    const druck = new THREE.Mesh(EBENE, mat(new THREE.MeshBasicMaterial({ map: tex })));
    druck.scale.set(SCHILD_B, SCHILD_H, 1); druck.position.set(x, y, .0185);
    druck.userData.schild = i;
    waende.h.add(tafel, druck);
    saal.klickbar.push(druck);
  }
  for (const t of p.tueren) {
    const o = waende[t.wand];
    // F: Mitte der Türöffnung, z nach draußen
    const F = new M4().multiplyMatrices(o.matrix, new M4().makeTranslation(t.o, 0, -T / 2)).multiply(ROT_Y);
    const portal = new THREE.Mesh(TUERFLAECHE, new THREE.MeshBasicMaterial({
      colorWrite: false, depthWrite: false, side: THREE.DoubleSide,
      stencilWrite: true, stencilRef: 1, stencilFunc: THREE.AlwaysStencilFunc, stencilZPass: THREE.ReplaceStencilOp,
    }));
    portal.position.set(t.o, 0, -T + .001); portal.renderOrder = 1;
    const durch = new THREE.Mesh(TUERFLAECHE, durchMat);
    durch.position.set(t.o, 0, -T + .002);
    const schwelle = new THREE.Mesh(SCHWELLE, steinMat); schwelle.position.set(t.o, .004, -T / 2);
    o.add(portal, durch, schwelle);
    const tuer = { ...t, F, Finv: F.clone().invert(), portal, durch, k: saal.tueren.length + 1 };
    portal.userData.tuer = tuer;
    saal.tueren.push(tuer); saal.klickbar.push(portal);
    if (t.zufall) {
      // die Tür ins Ungewisse: ein schmaler Goldbogen, darüber ein Rahmen ohne Bild
      const bogen = new THREE.Mesh(BOGENBAND, goldMat); bogen.position.set(t.o, 0, 0);
      o.add(bogen);
      if (!typ.supra) continue;
      const b = 2.5, h = b / BILD_A, y = DH + .32 + h / 2 + .06;
      for (const [sx, sy, x, yy] of [[b + 2 * RAHMEN, RAHMEN, 0, (h + RAHMEN) / 2], [b + 2 * RAHMEN, RAHMEN, 0, -(h + RAHMEN) / 2],
                                     [RAHMEN, h, -(b + RAHMEN) / 2, 0], [RAHMEN, h, (b + RAHMEN) / 2, 0]]) {
        const leiste = new THREE.Mesh(KISTE, goldMat); leiste.scale.set(sx, sy, .08); leiste.position.set(t.o + x, y + yy, .04);
        o.add(leiste);
      }
    } else if (typ.supra) bildAn(t.wand, t.ziel, "supra", t.o, DH + .32 + 1.04 / 2 + .06, 2.5);
  }
  for (const w of p.bilder) bildAn(w.wand, w.ziel, "wand", w.o, 2.05, w.b);

  // Bänke mit Blick auf das große Bild — in der Rotunde eine runde in der Mitte
  const holz = mat(new THREE.MeshLambertMaterial({ color: 0x2c231d })), leder = mat(new THREE.MeshLambertMaterial({ color: 0x4b3a2e }));
  for (const [x, z, b] of typ.baenke ?? []) {
    const bank = new THREE.Group(); bank.position.set(x, 0, z);
    const sitz = new THREE.Mesh(KISTE, leder); sitz.scale.set(b, .14, .85); sitz.position.y = .44;
    bank.add(sitz);
    for (const fx of [-(b / 2 - .18), b / 2 - .18]) { const f = new THREE.Mesh(KISTE, holz); f.scale.set(.12, .37, .72); f.position.set(fx, .185, 0); bank.add(f); }
    g.add(bank);
    saal.hindernisse.push({ x0: x - b / 2, x1: x + b / 2, z0: z - .43, z1: z + .43 });
  }
  if (typ.rundbank) {
    const rb = typ.rundbank;
    const sitz = new THREE.Mesh(new THREE.CylinderGeometry(rb, rb, .14, 48), leder); sitz.position.y = .44;
    const fuss = new THREE.Mesh(new THREE.CylinderGeometry(rb - .25, rb - .2, .37, 48), holz); fuss.position.y = .185;
    sitz.userData.eigen = fuss.userData.eigen = true;
    g.add(sitz, fuss);
    saal.hindernisse.push({ rund: rb });
  }

  g.updateMatrixWorld(true);
  scene.add(g);
  saele.add(saal);
  return saal;
}
function entsorgeSaal(saal) {
  scene.remove(saal.g);
  for (const b of saal.bilder) {
    b.weg = true;
    b.mesh.material.map?.dispose();
    if (b.stufe) freigeben(b.i, b.stufe);
  }
  for (const m of saal.mats) m.dispose();
  for (const t of saal.texturen ?? []) t.dispose();
  for (const t of saal.tueren) t.portal.material.dispose();
  saal.g.traverse((o) => { if (o.userData.eigen) o.geometry.dispose(); });
  saele.delete(saal);
}
/* Die Rolle eines Saals: „jetzt“ (man steht drin) oder Nachbar k (nur durch Tür k zu sehen). */
function rolle(saal, k, zuruecktuer) {
  saal.rolle = k;
  const jetzt = k === 0;
  for (const m of saal.mats) {
    m.stencilWrite = !jetzt; m.stencilRef = k;
    m.stencilFunc = THREE.EqualStencilFunc;
    m.stencilFail = m.stencilZFail = m.stencilZPass = THREE.KeepStencilOp;
  }
  saal.g.traverse((o) => { if (o.isMesh && o.renderOrder !== 1) o.renderOrder = jetzt ? 0 : 2; });
  for (const t of saal.tueren) {
    t.portal.visible = jetzt;
    t.portal.material.stencilRef = t.k;
    t.durch.visible = !jetzt && t !== zuruecktuer;
  }
  for (const b of saal.bilder) {
    if (jetzt) bildStufe(b, b.art === "haupt" ? "voll" : "mittel", b.art === "haupt" ? 0 : 1);
    else if (b.art === "haupt") bildStufe(b, "mittel", 2);
  }
}

let jetzt = null;
const nachbarn = new Map();   // Tür-Nr. k → { saal, M }
function richteEin(saal, alt) {
  // saal wird zum Saal, in dem man steht; hinter seinen Türen hängen die Nachbarn.
  jetzt = saal;
  if (!besucht.has(saal.i)) {
    besucht.add(saal.i);
    for (const b of saal.bilder) gesehen.set(b.i, (gesehen.get(b.i) ?? 0) + 1);
    merken();
  }
  saal.g.matrix.identity(); saal.g.updateMatrixWorld(true);
  rolle(saal, 0);
  nachbarn.clear();
  const bleiben = new Set([saal]);
  for (const t of saal.tueren) {
    const nb = alt && t.ziel === alt.i ? alt : baueSaal(t.ziel, saal.i);
    const zurueck = nb.tueren.find((x) => x.ziel === saal.i);
    if (!zurueck) { if (nb !== alt) entsorgeSaal(nb); continue; }
    const M = new M4().multiplyMatrices(t.F, ROT_Y).multiply(zurueck.Finv);
    nb.g.matrix.copy(M); nb.g.updateMatrixWorld(true);
    rolle(nb, t.k, zurueck);
    nachbarn.set(t.k, { saal: nb, M });
    bleiben.add(nb);
  }
  for (const s of [...saele]) if (!bleiben.has(s)) entsorgeSaal(s);
}
function durchgehen(t) {
  const nb = nachbarn.get(t.k);
  if (!nb) return;
  const Minv = nb.M.clone().invert();
  const f = vorn(new V()).transformDirection(Minv);
  const v = flug.vel.length();
  flug.pos.applyMatrix4(Minv); flug.vel.transformDirection(Minv).multiplyScalar(v);
  flug.yaw = Math.atan2(-f.x, -f.z);
  if (gang) gang.bezug.premultiply(Minv);
  schliesseSaaltext();
  richteEin(nb.saal, jetzt);
}

/* ══ Gehen ═══════════════════════════════════════════════════════════════ */
const flug = { pos: new V(0, AUGE, 7), vel: new V(), yaw: 0, pitch: .06 };
const eingang = (saal) => new V(0, AUGE, saal.typ.waende.v[0] - 1.4);   // gleich hinter der Eingangstür
const kanon = (saal) => new V(0, AUGE, saal.typ.kanon);                   // wo man steht, wenn man aus der Note tritt
/* Innerhalb der Wände halten (konvexer Grundriss: jede Wand eine Ebene). */
function innen(p) {
  for (let n = 0; n < 2; n++) for (const w of jetzt.waende) {
    const d = (p.x - w.pos.x) * w.n.x + (p.z - w.pos.z) * w.n.z;
    if (d < RAND) { p.x += w.n.x * (RAND - d); p.z += w.n.z * (RAND - d); }
  }
  return p;
}
function vorn(z = new V()) {
  const cp = Math.cos(flug.pitch);
  return z.set(-Math.sin(flug.yaw) * cp, Math.sin(flug.pitch), -Math.cos(flug.yaw) * cp);
}
const _l = new V();
function eingrenzen(p) {
  p.y = AUGE;
  for (const t of jetzt.tueren) {
    _l.copy(p).applyMatrix4(t.Finv);
    if (_l.z > -T / 2 - .5 && Math.abs(_l.x) < DW / 2 - .4) {
      if (_l.z > 0) { durchgehen(t); return eingrenzen(p); }
      if (_l.z > -T / 2 - .45) { _l.x = clamp(_l.x, -(DW / 2 - .4), DW / 2 - .4); p.copy(_l.applyMatrix4(t.F)); }
      return;
    }
  }
  innen(p);
  for (const h of jetzt.hindernisse) {
    if (h.rund) {
      const d = Math.hypot(p.x, p.z), r = h.rund + .3;
      if (d < r) { const f = r / Math.max(d, 1e-3); p.x *= f; p.z *= f; if (d < 1e-3) p.z = r; }
      continue;
    }
    const m = .3, x0 = h.x0 - m, x1 = h.x1 + m, z0 = h.z0 - m, z1 = h.z1 + m;
    if (p.x > x0 && p.x < x1 && p.z > z0 && p.z < z1) {
      const d = [p.x - x0, x1 - p.x, p.z - z0, z1 - p.z], k = d.indexOf(Math.min(...d));
      if (k === 0) p.x = x0; else if (k === 1) p.x = x1; else if (k === 2) p.z = z0; else p.z = z1;
    }
  }
}

let gang = null;   // ein Weg, der von selbst gegangen wird
const seil = (k) => (1 - Math.cos(Math.PI * k)) / 2;   // sacht los, in der Mitte am schnellsten, sacht zur Ruhe
function winkel(a, b, k) { let d = ((b - a + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI; return a + d * k; }
function geheZu(punkt) {
  const p = punkt.clone(); p.y = AUGE;
  innen(p);
  const kurve = new THREE.LineCurve3(flug.pos.clone(), p);
  gang = { kurve, ms: clamp(kurve.getLength() / 1.5 * 1000, 900, 6500), t: 0, bezug: new M4() };
}
function geheDurch(t) {
  const vor = new V(0, AUGE, -T / 2 - 1.7).applyMatrix4(t.F);
  const drin = new V(0, AUGE, T / 2 + 3.4).applyMatrix4(t.F);
  // erst in einem weichen Bogen vor die Tür, dann gerade hindurch
  const richtung = new V(0, 0, 1).transformDirection(t.F);
  const p0 = flug.pos.clone(), a = Math.max(.6, p0.distanceTo(vor) * .4);
  const blick = new V(-Math.sin(flug.yaw), 0, -Math.cos(flug.yaw));
  const kurve = new THREE.CurvePath();
  kurve.add(new THREE.CubicBezierCurve3(p0, p0.clone().addScaledVector(blick, a * .5), vor.clone().addScaledVector(richtung, -a), vor));
  kurve.add(new THREE.LineCurve3(vor, drin));
  gang = { kurve, ms: clamp(kurve.getLength() / 1.55 * 1000, 2200, 8000), t: 0, bezug: new M4(),
           y0: flug.yaw, p0: flug.pitch, richtung };
}
function gehen(dt) {
  gang.t += dt * 1000;
  const k = Math.min(1, gang.t / gang.ms);
  const p = gang.kurve.getPoint(seil(k)).applyMatrix4(gang.bezug);
  flug.pos.copy(p);
  if (gang.richtung) {
    const d = gang.richtung.clone().transformDirection(gang.bezug);
    const y0 = gang.y0 + Math.atan2(gang.bezug.elements[8], gang.bezug.elements[10]);   // Drehung des Bezugs mitnehmen
    const u = seil(Math.min(1, k / .55));
    flug.yaw = winkel(y0, Math.atan2(-d.x, -d.z), u);
    flug.pitch = lerp(gang.p0, .06, u);
  }
  if (k >= 1) gang = null;
}

const tasten = new Set();
const BEWEGUNG = { KeyW: "v", ArrowUp: "v", KeyS: "z", ArrowDown: "z", KeyA: "l", ArrowLeft: "l", KeyD: "r", ArrowRight: "r" };
function steuern(dt) {
  const f = new V(-Math.sin(flug.yaw), 0, -Math.cos(flug.yaw)), r = new V(-f.z, 0, f.x);
  const w = new V();
  for (const c of tasten) {
    const b = BEWEGUNG[c];
    if (b === "v") w.add(f); if (b === "z") w.sub(f);
    if (b === "l") w.sub(r); if (b === "r") w.add(r);
  }
  if (w.lengthSq()) { gang = null; w.normalize().multiplyScalar(tasten.has("ShiftLeft") || tasten.has("ShiftRight") ? TEMPO_SCHNELL : TEMPO); }
  flug.vel.lerp(w, 1 - Math.exp(-dt * (w.lengthSq() ? 5 : 3.2)));
  if (gang) gehen(dt);
  else flug.pos.addScaledVector(flug.vel, dt);
  eingrenzen(flug.pos);
}

/* ══ Zuwenden, Eintauchen, Auftauchen (aus dem Gedankenraum) ═════════════ */
let zustand = "reise", seitWann = 0;
const setze = (z) => {
  zustand = z; seitWann = performance.now();
  ausgangEl.classList.toggle("da", z === "reise" || z === "zu");   // der Ausgang nur, solange man im Saal steht
};
const tweens = [];
const glatt = (k) => k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
function tween(ms, fn, ease = glatt) { return new Promise((res) => tweens.push({ ms, t: 0, fn, ease, res })); }
const raetselEl = document.getElementById("raetsel");
const zurueckEl = document.getElementById("zurueck");

/* Der Raum tritt zurück, wenn ein Bild vor die Augen kommt: ein Schleier direkt vor der Kamera. */
const dimmMesh = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), new THREE.MeshBasicMaterial({ color: 0x0c0a08, transparent: true, opacity: 0, depthTest: false, depthWrite: false }));
dimmMesh.position.z = -.12; dimmMesh.renderOrder = 9; dimmMesh.visible = false;
camera.add(dimmMesh);
const dimm = {
  get value() { return 1 - dimmMesh.material.opacity / .92; },
  set value(v) { dimmMesh.material.opacity = (1 - v) * .92; dimmMesh.visible = v < .995; },
};

/* Der Saaltext: antippen öffnet ihn, jede andere Geste schließt ihn wieder. */
const saaltextEl = document.getElementById("saaltext");
let saaltextOffen = false;
function zeigeSaaltext(i) {
  const k = K[i], s = schilder[k.u] ?? {}, esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  saaltextEl.innerHTML = `<div class="rubrik"><i style="background:${FARBE[k.r] ?? "#999"}"></i>${esc(RUBRIKNAME[k.r] ?? k.r)}</div>`
    + `<h2>${esc(k.t)}</h2>` + (s.d ? `<div class="datum">${esc(datumText(s.d))}</div>` : "")
    + `<hr><p class="text">…</p>`;
  texteHolen().then((t) => { const p = saaltextEl.querySelector(".text"); if (p && saaltextOffen) p.textContent = t[k.u] ?? ""; });
  saaltextEl.scrollTop = 0;
  saaltextEl.classList.add("da"); saaltextOffen = true;
  hinweis.style.opacity = 0;
}
function schliesseSaaltext() {
  if (!saaltextOffen) return false;
  saaltextEl.classList.remove("da"); saaltextOffen = false;
  return true;
}

let fokus = null;   // { mesh, i, bild, stufen, aspekt, d }
function quelleTransform(bild) {
  bild.mesh.updateMatrixWorld();
  const pos = new V(), quat = new THREE.Quaternion(), sc = new V();
  bild.mesh.matrixWorld.decompose(pos, quat, sc);
  return { pos, quat, sx: bild.b, sy: bild.h };
}
function zuPose(breite, hoehe) {
  const d = Math.max(breite / (.78 * 2 * tanH() * camera.aspect), hoehe / (.58 * 2 * tanH()));
  return { pos: camera.position.clone().add(camera.getWorldDirection(new V()).multiplyScalar(d)), quat: camera.quaternion.clone(), d };
}
function fokusMesh(startTex) {
  const mat = new THREE.MeshBasicMaterial({ map: startTex, toneMapped: false, depthTest: false, depthWrite: false, transparent: true, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(EBENE, mat);
  mesh.renderOrder = 10;
  scene.add(mesh);
  return mesh;
}
function fokusTexturHochladen(i) {
  for (const stufe of ["mittel", "voll"]) {
    textur(i, stufe, -1).p.then((tex) => {
      if (!fokus || fokus.i !== i || fokus.heim) { freigeben(i, stufe); return; }
      if (stufe === "mittel" && fokus.stufen.includes("voll")) { freigeben(i, stufe); return; }
      fokus.stufen.push(stufe);
      fokus.mesh.material.map = tex; fokus.mesh.material.needsUpdate = true;
      fokus.aspekt = tex.image.width / tex.image.height;
      if (zustand === "zu") fokus.mesh.scale.y = fokus.mesh.scale.x / fokus.aspekt;
    }).catch(() => {});
  }
}
function fokusLoslassen() {
  if (!fokus) return;
  for (const s of fokus.stufen) freigeben(fokus.i, s);
  fokus.startTex?.dispose();
  fokus.mesh.material.dispose(); scene.remove(fokus.mesh); fokus = null;
}
function zeigeRaetsel(i) {
  const r = raetsel[K[i].u];
  if (r) { raetselEl.textContent = r; raetselEl.classList.add("da"); }
}
function seiteLaden(i) {
  const u = K[i].u.normalize("NFC");
  if (seiteEl.dataset.fuer === u) return;
  seiteEl.dataset.fuer = u; seiteEl.src = K[i].u;
}

async function zuwenden(bild) {
  if (zustand !== "reise") return;
  setze("hin");
  gang = null; flug.vel.set(0, 0, 0);
  const i = bild.i;
  const startTex = bild.mesh.material.map ? bild.mesh.material.map.clone() : null;
  if (startTex) startTex.needsUpdate = true;
  const von = quelleTransform(bild);
  fokus = { mesh: fokusMesh(startTex), i, bild, stufen: [], aspekt: BILD_A, startTex };
  fokus.mesh.position.copy(von.pos); fokus.mesh.quaternion.copy(von.quat); fokus.mesh.scale.set(von.sx, von.sy, 1);
  bild.mesh.visible = false;
  fokusTexturHochladen(i);
  seiteLaden(i);
  const W = 5.2, zu = zuPose(W, W / 2.1);
  const p0 = von.pos.clone(), q0 = von.quat.clone(), sx0 = von.sx, sy0 = von.sy;
  await tween(1400, (k) => {
    fokus.mesh.position.lerpVectors(p0, zu.pos, k);
    fokus.mesh.quaternion.slerpQuaternions(q0, zu.quat, k);
    fokus.mesh.scale.set(lerp(sx0, W, k), lerp(sy0, W / fokus.aspekt, k), 1);
    dimm.value = lerp(1, .32, k);
  });
  fokus.d = zu.d;
  setze("zu");
  zeigeRaetsel(i);
}

/* Das Bild kehrt heim — in seinen Rahmen. Der Ausschnitt geht stetig in den Zuschnitt des Rahmens über. */
function heimweg() {
  const bild = fokus.bild, m = fokus.mesh;
  const p0 = m.position.clone(), q0 = m.quaternion.clone(), sx0 = m.scale.x, sy0 = m.scale.y;
  fokus.heim = true;
  m.material.depthTest = true;
  let schnitt = null;
  if (fokus.stufen.length && m.material.map?.image) {
    schnitt = m.material.map.clone(); schnitt.needsUpdate = true; m.material.map = schnitt;
    const ci = schnitt.image.width / schnitt.image.height;
    schnitt.ziel = ci > BILD_A ? { x: BILD_A / ci, y: 1 } : { x: 1, y: ci / BILD_A };
  }
  const nach = quelleTransform(bild);
  return {
    schritt(u) {
      m.position.lerpVectors(p0, nach.pos, u);
      m.quaternion.slerpQuaternions(q0, nach.quat, u);
      m.scale.set(lerp(sx0, nach.sx, u), lerp(sy0, nach.sy, u), 1);
      if (schnitt) {
        const rx = lerp(1, schnitt.ziel.x, u), ry = lerp(1, schnitt.ziel.y, u);
        schnitt.repeat.set(rx, ry); schnitt.offset.set((1 - rx) / 2, (1 - ry) / 2);
      }
    },
    weit: p0.distanceTo(nach.pos) > 14,
    ende() { bild.mesh.visible = true; schnitt?.dispose(); fokusLoslassen(); dimm.value = 1; },
  };
}
async function abwenden() {
  if (zustand !== "zu") return;
  setze("zurueck");
  raetselEl.classList.remove("da");
  const h = heimweg(), d0 = dimm.value;
  await tween(h.weit ? 2800 : 2200, (k) => { h.schritt(k); dimm.value = lerp(d0, 1, k); }, seil);
  h.ende();
  setze("reise");
}

const seiteBereit = () => new Promise((res) => {
  const ok = () => {
    try {
      const d = seiteEl.contentDocument;
      if (d?.readyState !== "complete") return false;
      const b = d.querySelector("img.banner");
      return !b || b.complete;
    } catch { return true; }
  };
  const t0 = performance.now();
  const w = () => (ok() || performance.now() - t0 > 6000) ? setTimeout(res, 120) : setTimeout(w, 60);
  w();
});
function bannerRect() {
  try {
    const b = seiteEl.contentDocument.querySelector("img.banner");
    if (b) return b.getBoundingClientRect();
  } catch {}
  return { left: innerWidth * .2, top: 80, width: innerWidth * .6, height: innerWidth * .25 };
}
function seiteAnlegen(r) {
  const m = fokus.mesh, k = m.scale.x / r.width;
  const ax = new V(1, 0, 0).applyQuaternion(m.quaternion), ay = new V(0, 1, 0).applyQuaternion(m.quaternion);
  m.scale.y = r.height * k;
  seite.quaternion.copy(m.quaternion);
  seite.scale.setScalar(k);
  seite.position.copy(m.position)
    .addScaledVector(ax, (innerWidth / 2 - (r.left + r.width / 2)) * k)
    .addScaledVector(ay, -(innerHeight / 2 - (r.top + r.height / 2)) * k);
  seite.updateMatrixWorld();
}
/* Der Flug ins Bild und aus ihm heraus — wie am Bungee-Seil (unverändert aus dem Gedankenraum). */
const TIEFE = 9, UNSCHAERFE = 36;
const zurueckziehen = (k) => k < .5 ? 8 * k ** 4 : 1 - Math.pow(-2 * k + 2, 4) / 2;
const stille = (ms) => new Promise((r) => tweens.push({ ms, t: 0, fn: () => {}, ease: (k) => k, res: r }));
function verschwimmen(d, g) {
  const b = d < g.dDeck ? Math.log(g.dDeck / d) / Math.log(TIEFE) * UNSCHAERFE : 0;
  canvas.style.filter = b > .3 ? `blur(${b.toFixed(1)}px)` : "";
  canvas.style.transform = b > .3 ? `scale(${(1 + b * 2.4 / Math.min(innerWidth, innerHeight)).toFixed(4)})` : "";
}
function geometrie() {
  const m = fokus.mesh, n = new V(0, 0, 1).applyQuaternion(m.quaternion);
  const dDeck = Math.min(m.scale.x / (2 * tanH() * camera.aspect), m.scale.y / (2 * tanH()));
  return {
    n, bc: m.position.clone(), dDeck, dTief: dDeck / TIEFE,
    dEins: seite.scale.x * innerHeight / 2 / tanH(),
    versatz: seite.position.clone().sub(m.position),
  };
}
function einsPose() { const g = geometrie(); return g.bc.clone().add(g.versatz).addScaledVector(g.n, g.dEins); }
let seiteAn = false;
function seiteSichtbar(an, dauer = .35) {
  if (an === seiteAn) return;
  seiteAn = an;
  seiteEl.style.transition = `opacity ${dauer}s ease`; seiteEl.style.opacity = an ? 1 : 0;
}
function fahrt(g, d0, d1, s0, s1, ms, ease, dm, mitSeite = true) {
  const dm0 = dimm.value;
  return tween(ms, (k) => {
    const d = Math.exp(lerp(Math.log(d0), Math.log(d1), k));
    camera.position.copy(g.bc).addScaledVector(g.versatz, lerp(s0, s1, k) * d / g.dEins).addScaledVector(g.n, d);
    seiteSichtbar(mitSeite && d > g.dDeck * .9);
    verschwimmen(d, g);
    if (dm !== undefined) dimm.value = lerp(dm0, dm, k);
  }, ease);
}

async function eintauchen() {
  if (zustand !== "zu") return;
  setze("tauchen");
  raetselEl.classList.remove("da");
  seiteLaden(fokus.i);
  await seiteBereit();
  try { seiteEl.contentWindow.scrollTo(0, 0); } catch {}
  seiteAnlegen(bannerRect());
  camera.quaternion.copy(fokus.mesh.quaternion);
  seiteZeigen = true; flach(false);
  css.render(cssScene, camera);
  seiteAn = false; seiteEl.style.transition = "none"; seiteEl.style.opacity = 0;
  const g = geometrie(), dStart = camera.position.distanceTo(g.bc);
  await fahrt(g, dStart, g.dTief, 0, 0, 3600, seil, .1, false);
  await stille(220);
  await fahrt(g, g.dTief, g.dEins, 0, 1, 2100, zurueckziehen);
  camera.position.copy(einsPose());
  css.render(cssScene, camera);
  flach(true);
  seiteEl.classList.add("offen");
  setze("note");
  zurueckEl.classList.add("da");
}

/* Alles, was gerade vor den Augen liegt (Kamera, Seite), starr so versetzen, dass das Banner
   in Blickrichtung des großen Bildes eines frischen Saals steht. */
function kanonisch(bannerMitte, quat, d) {
  const ziel = kanon(jetzt).add(new V(0, 0, -d));
  const R = new M4().makeTranslation(ziel.x, ziel.y, ziel.z)
    .multiply(new M4().compose(bannerMitte, quat, new V(1, 1, 1)).invert());
  for (const o of [camera, seite]) {
    o.updateMatrix();
    o.matrix.premultiply(R).decompose(o.position, o.quaternion, new V());
    o.updateMatrixWorld();
  }
}

async function auftauchen() {
  if (zustand !== "note") return;
  setze("auftauchen");
  zurueckEl.classList.remove("da");
  seiteEl.classList.remove("offen");
  let j = fokus.i;
  try {
    const pfad = decodeURIComponent(seiteEl.contentWindow.location.pathname).replace(/\.html$/, "").normalize("NFC");
    if (nachUrl.has(pfad)) j = nachUrl.get(pfad);
    seiteEl.dataset.fuer = pfad;
  } catch {}
  try {
    const w = seiteEl.contentWindow;
    if (w.scrollY > 0) {
      w.scrollTo({ top: 0, behavior: "smooth" });
      await new Promise((r) => setTimeout(r, Math.min(1000, 350 + w.scrollY / 4)));
      w.scrollTo(0, 0);
    }
  } catch {}
  const r = bannerRect();
  const k = seite.scale.x;
  const mitte = () => {
    const ax = new V(1, 0, 0).applyQuaternion(seite.quaternion), ay = new V(0, 1, 0).applyQuaternion(seite.quaternion);
    return seite.position.clone()
      .addScaledVector(ax, (r.left + r.width / 2 - innerWidth / 2) * k)
      .addScaledVector(ay, -(r.top + r.height / 2 - innerHeight / 2) * k);
  };
  if (j !== fokus.i) {
    // In der Note weitergegangen: man tritt in den Saal der Note, in der man jetzt steht.
    const vorher = jetzt.i;
    for (const s of fokus.stufen) freigeben(fokus.i, s);
    fokus.i = j; fokus.stufen = [];
    fokus.mesh.material.map = null; fokus.mesh.material.needsUpdate = true;
    fokusTexturHochladen(j);
    const neu = baueSaal(j, kanten[j].has(vorher) ? vorher : undefined);
    richteEin(neu, null);
    fokus.bild = neu.haupt; neu.haupt.mesh.visible = false;
    kanonisch(mitte(), seite.quaternion.clone(), fokus.d);
  }
  fokus.mesh.position.copy(mitte());
  fokus.mesh.quaternion.copy(seite.quaternion);
  fokus.mesh.scale.set(r.width * k, r.height * k, 1);
  flach(false);
  seiteAn = true; seiteEl.style.opacity = 1;
  const g = geometrie();
  await fahrt(g, g.dEins, g.dTief, 1, 0, 3600, seil, .1);
  await stille(220);
  seiteAn = false; seiteEl.style.transition = "opacity .25s ease"; seiteEl.style.opacity = 0;
  setze("zurueck");
  const lnT = Math.log(g.dTief), lnZ = Math.log(fokus.d);
  const e0 = clamp(Math.log(g.dDeck / g.dTief) / (lnZ - lnT), 0, .7);
  const h = heimweg();
  await tween(h.weit ? 5200 : 4200, (k) => {
    const e = seil(k), d = Math.exp(lerp(lnT, lnZ, e));
    camera.position.copy(g.bc).addScaledVector(g.n, d);
    verschwimmen(d, g);
    h.schritt(seil(clamp((e - e0) / (1 - e0), 0, 1)));
    dimm.value = lerp(.1, 1, e);
  }, (k) => k);
  seiteZeigen = false;
  seiteEl.style.transition = "none"; seiteEl.style.opacity = 0;
  h.ende();
  const eu = new THREE.Euler().setFromQuaternion(camera.quaternion, "YXZ");
  flug.yaw = eu.y; flug.pitch = eu.x;
  flug.pos.copy(camera.position); flug.vel.set(0, 0, 0);
  eingrenzen(flug.pos);
  setze("reise");
}

/* Osterei: aus einer Note herübergekommen — die Seite steht da, der Saal baut sich dahinter auf. */
async function ankunft(j) {
  richteEin(baueSaal(j), null);
  flug.pos.copy(kanon(jetzt)); flug.yaw = 0; flug.pitch = 0;
  camera.position.copy(flug.pos); camera.rotation.set(0, 0, 0);
  camera.updateMatrixWorld();
  const W = 5.2, zu = zuPose(W, W / BILD_A);
  fokus = { mesh: fokusMesh(null), i: j, bild: jetzt.haupt, stufen: [], aspekt: BILD_A, d: zu.d };
  fokus.mesh.position.copy(zu.pos); fokus.mesh.quaternion.copy(zu.quat); fokus.mesh.scale.set(W, W / BILD_A, 1);
  jetzt.haupt.mesh.visible = false;
  fokusTexturHochladen(j);
  dimm.value = .12;
  await seiteBereit();
  await new Promise((r) => setTimeout(r, 300));
  let r;
  try { const w = seiteEl.contentWindow, y = w.scrollY; w.scrollTo(0, 0); r = bannerRect(); w.scrollTo(0, y); }
  catch { r = bannerRect(); }
  seiteAnlegen(r);
  camera.quaternion.copy(fokus.mesh.quaternion);
  camera.position.copy(einsPose());
  seiteZeigen = true;
  gemerkt = null;
  css.render(cssScene, camera);
  flach(true);
  setze("note");
  await auftauchen();
}

/* ══ Eingabe ═════════════════════════════════════════════════════════════ */
const strahl = new THREE.Raycaster(), maus = new THREE.Vector2();
const ring = new THREE.Mesh(new THREE.RingGeometry(.26, .32, 48).rotateX(-Math.PI / 2),
  new THREE.MeshBasicMaterial({ color: 0xfff6e8, transparent: true, opacity: .55, depthWrite: false }));
ring.visible = false; ring.renderOrder = 3;
scene.add(ring);
function ziel(x, y) {
  maus.set(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1);
  strahl.setFromCamera(maus, camera);
  if (fokus && zustand === "zu") return strahl.intersectObject(fokus.mesh, false)[0] ? { art: "fokus" } : null;
  const h = strahl.intersectObjects(jetzt.klickbar, false)[0];
  if (!h) return null;
  const u = h.object.userData;
  if (u.schild !== undefined) return { art: "schild", i: u.schild };
  if (u.bild) return { art: "bild", bild: u.bild };
  if (u.tuer) return { art: "tuer", tuer: u.tuer };
  if (u.boden) return { art: "boden", punkt: h.point };
  return null;
}
function markiere(z, maustyp) {
  canvas.style.cursor = !z ? "default" : z.art === "fokus" ? "zoom-in" : z.art === "boden" ? "default" : "pointer";
  ring.visible = maustyp === "mouse" && z?.art === "boden" && zustand === "reise";
  if (ring.visible) ring.position.set(z.punkt.x, .012, z.punkt.z);
}

const hinweis = document.getElementById("hinweis");
if (matchMedia("(pointer: coarse)").matches)
  hinweis.innerHTML = "<b>Wischen</b> schaut · <b>Antippen</b>: Boden geht hin, Bild wendet sich zu, Tür führt weiter";
let hinweisWeg = false;
const ruhe = () => { if (!hinweisWeg) { hinweisWeg = true; setTimeout(() => (hinweis.style.opacity = 0), 5000); } };
setTimeout(() => (hinweis.style.opacity = 0), 20000);
if (VON) hinweis.style.display = "none";

let druck = null;
canvas.addEventListener("pointerdown", (ev) => { druck = { weg: 0, typ: ev.pointerType, x: ev.clientX, y: ev.clientY }; canvas.setPointerCapture?.(ev.pointerId); });
addEventListener("pointermove", (ev) => {
  if (druck && ev.buttons) {
    if (zustand === "reise") {
      const s = ev.pointerType === "mouse" ? .0034 : .0052;
      flug.yaw += ev.movementX * s; flug.pitch = clamp(flug.pitch + ev.movementY * s * .8, -1.15, 1.15);
    }
    druck.weg += Math.abs(ev.movementX) + Math.abs(ev.movementY);
    ring.visible = false;
    return;
  }
  if (zustand === "reise" || zustand === "zu") markiere(ziel(ev.clientX, ev.clientY), ev.pointerType);
});
canvas.addEventListener("pointerup", (ev) => {
  const d = druck; druck = null;
  if (!d || d.weg > 8) return;
  ruhe();
  const z = ziel(ev.clientX, ev.clientY);
  if (zustand === "reise") {
    if (schliesseSaaltext() && z?.art !== "schild") return;   // der erste Tipp schließt nur den Saaltext
    if (!z) return;
    if (z.art === "schild") zeigeSaaltext(z.i);
    else if (z.art === "bild") zuwenden(z.bild);
    else if (z.art === "tuer") geheDurch(z.tuer);
    else if (z.art === "boden") geheZu(z.punkt);
  } else if (zustand === "zu") {
    if (z?.art === "fokus") eintauchen(); else abwenden();
  }
});
addEventListener("wheel", (ev) => {
  ev.preventDefault();
  if (zustand === "zu") { if (performance.now() - seitWann > 700 && Math.abs(ev.deltaY) + Math.abs(ev.deltaX) > 4) abwenden(); return; }
  if (zustand !== "reise") return;
  ruhe(); gang = null;
  const f = new V(-Math.sin(flug.yaw), 0, -Math.cos(flug.yaw)), k = ev.deltaMode === 1 ? 16 : 1;
  if (ev.ctrlKey) flug.vel.addScaledVector(f, -ev.deltaY * k * .04);
  else {
    flug.vel.addScaledVector(f, ev.deltaY * k * .009);
    flug.yaw -= ev.deltaX * k * .0028;
  }
  const v = flug.vel.length(); if (v > TEMPO_SCHNELL) flug.vel.multiplyScalar(TEMPO_SCHNELL / v);
}, { passive: false });
addEventListener("keydown", (ev) => {
  if (ev.target !== document.body && ev.target !== canvas) return;
  ruhe();
  if (ev.code === "Escape" && schliesseSaaltext()) return;
  if (BEWEGUNG[ev.code]) schliesseSaaltext();
  if (ev.code === "Escape") { if (zustand === "zu") abwenden(); else if (zustand === "note") auftauchen(); return; }
  if (ev.code === "Enter" && zustand === "zu") { eintauchen(); return; }
  if (BEWEGUNG[ev.code] || ev.code.startsWith("Shift")) {
    ev.preventDefault();
    tasten.add(ev.code);
    if (zustand === "zu" && BEWEGUNG[ev.code]) abwenden();
  }
});
addEventListener("keyup", (ev) => tasten.delete(ev.code));
addEventListener("blur", () => tasten.clear());
zurueckEl.addEventListener("click", auftauchen);
/* Der Ausgang: zurück zur Note, durch deren Tor man kam, an die Stelle, an der man dort war.
   Wer ohne Tor kam (ein geteilter Link), geht zur Note des Saals, in dem er gerade steht. */
ausgangEl.addEventListener("click", () => {
  if (zustand !== "reise" && zustand !== "zu") return;
  const ziel = VON || K[jetzt.i].u;
  try { sessionStorage.setItem("raum:zurueck", JSON.stringify({ p: decodeURIComponent(ziel).normalize("NFC"), y: VON ? VON_Y : 0 })); } catch {}
  const s = document.getElementById("schleier");
  s.style.display = ""; s.style.transition = "opacity .6s ease";
  requestAnimationFrame(() => (s.style.opacity = 1));
  setTimeout(() => (location.href = ziel), 620);
});
addEventListener("message", (ev) => { if (ev.origin === location.origin && ev.data === "raum:zurueck") auftauchen(); });

/* ══ Takt ════════════════════════════════════════════════════════════════ */
if (!VON) {
  const bei = nachUrl.get(decodeURIComponent(such.get("bei") ?? "").normalize("NFC"));   // ?bei=/Pfad: in genau diesem Saal beginnen
  richteEin(baueSaal(bei ?? zufallsZiel()), null);
  flug.pos.copy(eingang(jetzt));
  camera.position.copy(flug.pos); camera.rotation.set(flug.pitch, flug.yaw, 0);
  requestAnimationFrame(() => (document.getElementById("schleier").style.opacity = 0));
  ausgangEl.classList.add("da");
}

const uhr = new THREE.Clock();
const _sp = new V(), SPRUCH_MAX = .26;   // Ton in Ton: weiß mit wenig Deckkraft hellt die Wandfarbe nur auf
function takt() {
  requestAnimationFrame(takt);
  const dt = Math.min(uhr.getDelta(), .05) * (window.__zeitlupe ?? 1);
  for (let k = tweens.length - 1; k >= 0; k--) {
    const w = tweens[k]; w.t += dt * 1000;
    const x = Math.min(1, w.t / w.ms); w.fn(w.ease(x));
    if (x >= 1) { tweens.splice(k, 1); w.res(); }
  }
  if (zustand === "note" || !jetzt) return;
  if (zustand === "reise") {
    steuern(dt);
    camera.position.copy(flug.pos);
    camera.rotation.set(flug.pitch, flug.yaw, 0);
  }
  // Der Wandspruch tritt zurück: Ton in Ton, und erst wer dem Bild nahekommt, bemerkt ihn.
  if (jetzt.spruch) {
    const p = jetzt.spruch.getWorldPosition(_sp), d = Math.hypot(camera.position.x - p.x, camera.position.z - p.z);
    const tiefe = jetzt.typ.waende.h[0] * 2;
    const ziel = SPRUCH_MAX * clamp((tiefe * .62 - d) / (tiefe * .3), 0, 1);
    const m = jetzt.spruch.material;
    m.opacity += (ziel - m.opacity) * (1 - Math.exp(-dt * 1.6));
  }
  renderer.render(scene, camera);
  if (seiteZeigen) css.render(cssScene, camera);
}
takt();

if (VON) {
  const j = nachUrl.get(decodeURIComponent(VON).normalize("NFC"));
  if (j !== undefined) ankunft(j);
  else {
    richteEin(baueSaal(zufallsZiel()), null);
    flug.pos.copy(eingang(jetzt));
    seiteEl.style.opacity = 0;
    const s = document.getElementById("schleier"); s.style.display = "";
    requestAnimationFrame(() => (s.style.opacity = 0));
    ausgangEl.classList.add("da");
  }
}

// Zum Prüfen von außen (Konsole).
window.__museum = { zeigeSaaltext, flug, camera, K, get jetzt() { return jetzt; }, nachbarn, saele, zuwenden, abwenden, eintauchen, auftauchen, geheDurch, geheZu, durchgehen, ziel, get zustand() { return zustand; } };
