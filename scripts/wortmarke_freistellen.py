#!/usr/bin/env python3
"""
Die Wortmarken freistellen — den gemalten Grund gegen echte Transparenz tauschen.

Die Bilder aus `~/Gedankenwelten/quartz/static/` haben keinen Alphakanal:
Die hellen Fassungen stehen auf fast-weiß, die dunklen auf fast-schwarz.
Auf dem warmen Papier dieser Fassung liegt darum ein sichtbarer Kasten —
`mix-blend-mode` half, löschte den Grund aber nicht ganz: multiply landet
sieben Stufen neben dem Papier, screen zwölf. Genug, um es zu sehen.

Mit Alphakanal ist die Frage weg: Es gibt keinen Grund mehr, der danebenliegen
könnte, und die Marke steht auf jedem Untergrund richtig.

## Wie gerechnet wird

Ein Bild auf einfarbigem Grund ist eine Mischung:

    beobachtet = farbe · a + grund · (1 − a)

Drei Gleichungen, vier Unbekannte — das ist für sich nicht lösbar. Lösbar
wird es durch das, was man über die Vorlage weiß:

* **Helle Fassungen** (Malerei auf Weiß). Ein voll deckender, satter Ton hat
  mindestens einen niedrigen Kanal; reines Weiß hat keinen. Also schätzt der
  *kleinste* Kanal die Deckung: a = 1 − min(beobachtet) / min(grund).
* **Dunkle Fassungen** (Leuchtschrift auf Schwarz). Das ist Licht, das zum
  Schwarz addiert wird — technisch schon vormultipliziert. Der *größte* Kanal
  schätzt die Deckung, und die Farbe fällt aus der Division heraus.

Danach wird zurückgerechnet (`unmatte`), damit ein halbdeckender Pixel seine
*eigene* Farbe trägt und nicht die Mischung mit dem alten Grund — sonst
zöge das alte Weiß als Schleier mit auf das neue Papier.

## Gegenprobe

Freistellen ist nicht umkehrbar sicher: Wo die Malerei selbst weiß ist,
kann keine Rechnung sie vom weißen Grund unterscheiden. Darum setzt das
Skript das Ergebnis wieder auf den *alten* Grund und vergleicht mit der
Vorlage. Bleibt die Abweichung klein, hat die Rechnung nichts erfunden.

    python3 scripts/wortmarke_freistellen.py            # rechnen und berichten
    python3 scripts/wortmarke_freistellen.py --schreiben # Dateien ersetzen
"""

import sys
from pathlib import Path

from PIL import Image

ORDNER = Path(__file__).resolve().parent.parent / "public" / "wortmarke"


def grundfarbe(bild):
    """Der Grund, aus den vier Ecken gemittelt — eine reicht nicht, falls
    die Malerei zufällig bis an eine heranreicht."""
    b, h = bild.size
    ecken = [(2, 2), (b - 3, 2), (2, h - 3), (b - 3, h - 3)]
    werte = [bild.getpixel(p) for p in ecken]
    return tuple(sum(w[k] for w in werte) // len(werte) for k in range(3))


# Wie weit ein Pixel vom Grund abweichen muss, um als Malerei zu zählen.
# Ohne diese Totzone wird aus einer einzigen Stufe Bildrauschen ein Pixel mit
# voller Farbe: Die Rückrechnung teilt durch die Deckung, und bei zwei Promille
# Deckung macht das aus (0,0,1) ein sattes Blau. Unsichtbar bei der Deckung —
# aber in den Leuchträndern der dunklen Fassungen säße dasselbe Rauschen bei
# fünf Prozent Deckung und würde als Farbfleck sichtbar.
TOTZONE = 3

# Unter dieser Deckung ist nichts mehr zu sehen, und die Rückrechnung wird
# unzuverlässig. Bewusst niedrig: Die Leuchtschrift läuft in sehr dünnen
# Rändern aus, und die sollen bleiben.
BODEN = 0.012

# Zwei Handschriften sind leuchtender Dunst, gemalt gegen *reines* Schwarz:
# Der Schleier zieht über die ganze Fläche und gehört zur Malerei. Auf unserem
# warmen Dunkel (#16140f) liest er sich aber nicht als Atmosphäre, sondern als
# heller Kasten hinter der Schrift — das Papier ist eben nicht schwarz.
#
# Die Kurve drückt schwache Deckung nach unten und lässt starke stehen: Der
# Schriftzug und die kräftigen Schwaden bleiben, der flächige Hauch geht.
# Nur für die dunklen Fassungen; auf hellem Papier stimmen alle sechs.
SCHLEIER = {"aquarell-dark": 2.2, "aether-dark": 1.8}


def freistellen(bild, hell, kurve=1.0):
    """Gibt (RGBA-Bild, Grundfarbe) zurück."""
    grund = grundfarbe(bild)
    b, h = bild.size
    quelle = bild.load()
    ziel = Image.new("RGBA", (b, h))
    schreiben = ziel.load()

    # Auf Weiß deckt der dunkelste Kanal, auf Schwarz der hellste.
    bezug = max((min(grund) if hell else max(255 - g for g in grund)) - TOTZONE, 1)

    for y in range(h):
        for x in range(b):
            r, g, bl = quelle[x, y][:3]
            # Abstand vom Grund, um die Totzone bereinigt.
            if hell:
                abstand = max(gr - k for k, gr in ((r, grund[0]), (g, grund[1]), (bl, grund[2])))
            else:
                abstand = max(k - gr for k, gr in ((r, grund[0]), (g, grund[1]), (bl, grund[2])))
            a = min(1.0, max(0.0, (abstand - TOTZONE) / bezug))
            if kurve != 1.0:
                a **= kurve

            if a < BODEN:
                schreiben[x, y] = (0, 0, 0, 0)
                continue

            # Zurückrechnen: die eigene Farbe des Pixels, ohne den alten Grund.
            farbe = tuple(
                min(255, max(0, round((k - gr * (1 - a)) / a)))
                for k, gr in ((r, grund[0]), (g, grund[1]), (bl, grund[2]))
            )
            schreiben[x, y] = (*farbe, round(a * 255))

    return ziel, grund


def gegenprobe(frei, grund, vorlage):
    """Das Freigestellte wieder auf den alten Grund setzen und vergleichen.
    Gibt (mittlere Abweichung, größte Abweichung) je Farbkanal zurück."""
    unterlage = Image.new("RGB", frei.size, grund)
    unterlage.paste(frei, (0, 0), frei)
    a, b = unterlage.getdata(), vorlage.convert("RGB").getdata()
    summe = groesste = 0
    for p, q in zip(a, b):
        d = max(abs(p[k] - q[k]) for k in range(3))
        summe += d
        groesste = max(groesste, d)
    return summe / len(a), groesste


def main():
    schreiben = "--schreiben" in sys.argv
    dateien = sorted(ORDNER.glob("wordmark-*.png"))
    if not dateien:
        print(f"Keine Wortmarken in {ORDNER}")
        return 1

    print(f"{'Datei':<34}{'Grund':<18}{'Ø Abw.':>8}{'max':>6}{'Deckung':>10}")
    print("─" * 76)
    schlimmste = 0.0

    for pfad in dateien:
        vorlage = Image.open(pfad).convert("RGB")
        hell = pfad.stem.endswith("-light")
        kurve = SCHLEIER.get(pfad.stem.removeprefix("wordmark-"), 1.0)
        frei, grund = freistellen(vorlage, hell, kurve)
        mittel, groesste = gegenprobe(frei, grund, vorlage)
        # Wo der Schleier absichtlich gedämpft wurde, misst die Gegenprobe
        # genau diese Absicht mit — dort sagt sie nichts über Fehler.
        if kurve == 1.0:
            schlimmste = max(schlimmste, mittel)

        # Wie viel des Bildes überhaupt noch sichtbar ist — fiele das auf
        # nahe null, hätte die Rechnung die Malerei mit weggelöscht.
        alpha = frei.getchannel("A")
        deckung = sum(alpha.getdata()) / (255 * alpha.size[0] * alpha.size[1])

        print(f"{pfad.name:<34}{str(grund):<18}{mittel:>8.2f}{groesste:>6}{deckung:>9.1%}")

        if schreiben:
            frei.save(pfad)

    print("─" * 76)
    print(f"Größte mittlere Abweichung: {schlimmste:.2f} von 255")
    if not schreiben:
        print("\nNur gerechnet. Mit --schreiben werden die Dateien ersetzt.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
