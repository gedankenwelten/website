#!/usr/bin/env python3
"""Ein kleiner Server für die Vorschau auf dem Pi — nur im Tailscale-Netz.

Tut, was der Caddy tut (`try_files {path} {path}.html {path}/index.html`),
damit die gebaute Fassung dort so aussieht wie später live. Kein Ersatz für
Caddy, nur ein Fenster, um vom Telefon aus draufzuschauen.

    python3 vorschau-server.py <ordner> <adresse> <port>
"""
import http.server, os, sys, urllib.parse

ORDNER, ADRESSE, PORT = os.path.abspath(sys.argv[1]), sys.argv[2], int(sys.argv[3])

class Vorschau(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=ORDNER, **k)

    def translate_path(self, path):
        rein = urllib.parse.unquote(urllib.parse.urlsplit(path).path)
        for kandidat in (rein, rein + ".html", rein.rstrip("/") + "/index.html"):
            voll = os.path.normpath(os.path.join(ORDNER, kandidat.lstrip("/")))
            if voll.startswith(ORDNER) and os.path.isfile(voll):
                return voll
        vier = os.path.join(ORDNER, "404.html")
        return vier if os.path.isfile(vier) else super().translate_path(path)

    def log_message(self, *a):  # still
        pass

http.server.ThreadingHTTPServer((ADRESSE, PORT), Vorschau).serve_forever()
