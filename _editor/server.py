#!/usr/bin/env python3
"""Local website editor for a static HTML site.

Run from the launcher ("Edit Website (Mac).command" / "Edit Website (Windows).bat")
or directly:  python3 _editor/server.py  [--port 8000] [--no-browser]

It serves the site at http://127.0.0.1:<port>/ with an editing toolbar added.
Only this computer can reach it. Standard library only (Python 3.7+).
"""
import base64
import datetime
import json
import os
import re
import secrets
import shutil
import subprocess
import sys
import threading
import webbrowser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse

if sys.version_info < (3, 7):
    sys.exit("This editor needs Python 3.7 or newer.")

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import htmltools  # noqa: E402

ROOT = HERE.parent
UPLOADS = ROOT / "uploads"
BACKUPS = HERE / "backups"
TOKEN = secrets.token_urlsafe(24)
SESSION = datetime.datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
MAX_BODY = 30 * 1024 * 1024
LOCK = threading.Lock()

GATE_RE = re.compile(r'<script[^>]*\bsrc\s*=\s*["\']gate\.js["\'][^>]*>\s*</script>', re.I)
IMAGE_EXT = {"jpg", "jpeg", "png", "webp", "gif", "svg"}


def pages():
    return sorted(p.name for p in ROOT.glob("*.html"))


def read_text(path):
    return path.read_bytes().decode("utf-8")


def write_text(path, text):
    path.write_bytes(text.encode("utf-8"))


def backup(path):
    dest = BACKUPS / SESSION
    dest.mkdir(parents=True, exist_ok=True)
    target = dest / path.name
    if not target.exists():  # keep the version from the start of this session
        shutil.copy2(str(path), str(target))


def tag_all_pages():
    total = 0
    for name in pages():
        path = ROOT / name
        src = read_text(path)
        new, n = htmltools.tag_page(src)
        if n:
            backup(path)
            write_text(path, new)
            total += n
    return total


def is_git_repo():
    return (ROOT / ".git").exists()


def run_git(args):
    env = dict(os.environ, GIT_TERMINAL_PROMPT="0")
    try:
        r = subprocess.run(["git"] + args, cwd=str(ROOT), env=env, stdout=subprocess.PIPE,
                           stderr=subprocess.STDOUT, timeout=120)
    except FileNotFoundError:
        return 127, "git is not installed on this computer."
    except subprocess.TimeoutExpired:
        return 124, "git took too long to respond."
    return r.returncode, r.stdout.decode("utf-8", "replace")


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        SimpleHTTPRequestHandler.__init__(self, *args, directory=str(ROOT), **kwargs)

    def log_message(self, fmt, *args):  # keep the terminal quiet
        pass

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        SimpleHTTPRequestHandler.end_headers(self)

    # ------------------------------------------------------------------ helpers
    def _json(self, code, obj):
        body = json.dumps(obj).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _page(self, name):
        text = read_text(ROOT / name)
        text = GATE_RE.sub("", text)  # no passcode screen while editing
        head = ('<script>window.__SITE_EDITOR=%s;</script>'
                '<link rel="stylesheet" href="/_editor/editor.css">'
                % json.dumps({"token": TOKEN, "page": name}))
        foot = '<script src="/_editor/editor.js"></script>'
        text = re.sub(r"</head>", lambda m: head + m.group(0), text, count=1, flags=re.I)
        if re.search(r"</body>", text, re.I):
            text = re.sub(r"</body>", lambda m: foot + m.group(0), text, count=1, flags=re.I)
        else:
            text += foot
        body = text.encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    # ------------------------------------------------------------------ routes
    def do_GET(self):
        path = unquote(urlparse(self.path).path)
        if path == "/":
            path = "/index.html"
        if path == "/_editor/api/info":
            return self._json(200, {"pages": pages(), "git": is_git_repo()})
        name = path.lstrip("/")
        if name in pages():
            return self._page(name)
        if name.startswith("_editor/backups") or name.endswith(".py"):
            return self.send_error(404)
        return SimpleHTTPRequestHandler.do_GET(self)

    def do_POST(self):
        path = urlparse(self.path).path
        if not path.startswith("/_editor/api/"):
            return self.send_error(404)
        if self.headers.get("X-Editor-Token") != TOKEN:
            return self._json(403, {"error": "Please reload the page (the editor was restarted)."})
        length = int(self.headers.get("Content-Length") or 0)
        if length > MAX_BODY:
            return self._json(413, {"error": "That file is too large."})
        try:
            data = json.loads(self.rfile.read(length).decode("utf-8") or "{}")
        except ValueError:
            return self._json(400, {"error": "Bad request."})
        action = path.rsplit("/", 1)[-1]
        try:
            with LOCK:
                if action == "save":
                    return self._json(200, self.save(data))
                if action == "upload":
                    return self._json(200, self.upload(data))
                if action == "publish":
                    return self._json(200, self.publish(data))
            return self._json(404, {"error": "Unknown action."})
        except htmltools.EditError as e:
            return self._json(409, {"error": str(e)})
        except Exception as e:  # show something useful instead of a silent failure
            return self._json(500, {"error": "Unexpected problem: %s" % e})

    def save(self, data):
        name = str(data.get("page", ""))
        if name not in pages():
            raise htmltools.EditError("Unknown page.")
        edits = data.get("edits") or []
        if not isinstance(edits, list) or not edits:
            return {"ok": True, "saved": 0}
        path = ROOT / name
        src = read_text(path)
        new = htmltools.apply_edits(src, edits)
        if new != src:
            backup(path)
            write_text(path, new)
        return {"ok": True, "saved": len(edits)}

    def upload(self, data):
        ext = str(data.get("ext", "")).lower().lstrip(".")
        if ext == "jpeg":
            ext = "jpg"
        if ext not in IMAGE_EXT:
            raise htmltools.EditError("Please use a JPG, PNG, WebP, GIF or SVG image.")
        stem = Path(str(data.get("name", "image"))).stem.lower()
        stem = re.sub(r"[^a-z0-9]+", "-", stem).strip("-")[:40] or "image"
        try:
            raw = base64.b64decode(str(data.get("data", "")), validate=True)
        except Exception:
            raise htmltools.EditError("The image could not be read.")
        UPLOADS.mkdir(exist_ok=True)
        target = UPLOADS / ("%s.%s" % (stem, ext))
        i = 2
        while target.exists():
            target = UPLOADS / ("%s-%d.%s" % (stem, i, ext))
            i += 1
        target.write_bytes(raw)
        return {"ok": True, "src": "uploads/" + target.name}

    def publish(self, data):
        if not is_git_repo():
            raise htmltools.EditError("This folder is not connected to GitHub, so it can't publish. "
                                      "Send the folder to your web developer instead.")
        log = []
        code, out = run_git(["add", "-A"])
        log.append(out)
        if code != 0:
            raise htmltools.EditError("Could not prepare the changes:\n" + out)
        msg = "Website update from editor (%s)" % datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
        code, out = run_git(["commit", "-m", msg])
        log.append(out)
        if code != 0 and "nothing to commit" not in out:
            raise htmltools.EditError("Could not record the changes:\n" + out)
        code, out = run_git(["push"])
        log.append(out)
        if code != 0:
            raise htmltools.EditError(
                "Your changes are saved on this computer but could not be sent to GitHub. "
                "GitHub may need you to sign in (see the README).\n\n" + out)
        return {"ok": True, "log": "\n".join(x for x in log if x.strip())}


def main():
    args = sys.argv[1:]
    port = 8000
    if "--port" in args:
        port = int(args[args.index("--port") + 1])
    print("Beetles & Butterflies website editor")
    print("Site folder: %s" % ROOT)
    n = tag_all_pages()
    if n:
        print("Prepared %d editable item(s) on the pages." % n)
    server = None
    for p in range(port, port + 50):
        try:
            server = ThreadingHTTPServer(("127.0.0.1", p), Handler)
            port = p
            break
        except OSError:
            continue
    if server is None:
        sys.exit("Could not find a free port to run the editor.")
    url = "http://127.0.0.1:%d/" % port
    print("\nThe editor is running at %s" % url)
    print("Keep this window open while you edit. Close it (or press Ctrl+C) to stop.\n")
    if "--no-browser" not in args:
        threading.Timer(0.8, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nEditor stopped.")


if __name__ == "__main__":
    main()
