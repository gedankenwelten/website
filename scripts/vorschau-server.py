#!/usr/bin/env python3
"""Ein kleiner Server für die Vorschau auf dem Pi — nur im Tailscale-Netz.

Tut, was der Caddy tut (`try_files {path} {path}.html {path}/index.html`),
damit die gebaute Fassung dort so aussieht wie später live. Kein Ersatz für
Caddy, nur ein Fenster, um vom Telefon aus draufzuschauen.

    python3 vorschau-server.py <ordner> <adresse> <port>
"""
import http.server, os, sys, urllib.parse, urllib.request

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

    # Die Türen (Feedback, Verbessern) reicht die Vorschau an den echten
    # Dienst auf demselben Pi weiter, wie es live der Caddy tut — sonst
    # ließe sich das Abschicken hier nicht ausprobieren (16.10.2026).
    DIENST = "http://127.0.0.1:3101"

    def _weiter(self, methode):
        laenge = int(self.headers.get("Content-Length") or 0)
        koerper = self.rfile.read(laenge) if laenge else None
        anfrage = urllib.request.Request(self.DIENST + self.path, data=koerper, method=methode,
                                         headers={"Content-Type": self.headers.get("Content-Type", "application/json")})
        try:
            with urllib.request.urlopen(anfrage, timeout=15) as r:
                status, daten = r.status, r.read()
        except urllib.error.HTTPError as e:
            status, daten = e.code, e.read()
        except Exception:
            status, daten = 502, b'{"ok": false, "fehler": "Dienst nicht erreichbar."}'
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(daten)))
        self.end_headers()
        self.wfile.write(daten)

    def do_POST(self):
        if self.path.startswith("/api/rueckmeldung"):
            return self._weiter("POST")
        self.send_error(405)

    def do_GET(self):
        if self.path.startswith("/api/rueckmeldung"):
            return self._weiter("GET")
        return super().do_GET()

http.server.ThreadingHTTPServer((ADRESSE, PORT), Vorschau).serve_forever()
