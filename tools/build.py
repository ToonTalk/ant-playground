"""Inline the sprite atlases into the page and write both editions.

  python tools/build.py
    ant-playground.html  the claude.ai artifact (no document skeleton; Aunt Hillary speaks via the viewer's claude.ai account)
    index.html           the GitHub Pages site (full document; Aunt Hillary speaks via Gemini Nano or the visitor's own key)
    build/preview.html   a copy of the site page for the local test server
Run tools/extract_topdown.py and tools/extract_extras.py first if the source sheets change.
"""
import base64, pathlib

root = pathlib.Path(__file__).resolve().parent.parent
b = root / "build"
uri = lambda p: "data:image/webp;base64," + base64.b64encode(p.read_bytes()).decode()
src = (root / "src" / "index.src.html").read_text(encoding="utf-8")
for key, val in {
    "%%ATLAS%%": uri(b / "topdown-atlas.webp"),
    "%%FOOD%%": uri(b / "food-atlas.webp"),
    "%%SPIDER%%": uri(b / "spider-atlas.webp"),
    "%%ANTEATER%%": uri(b / "anteater-atlas.webp"),
    "%%EXTRAS%%": (b / "extras.json").read_text(encoding="utf-8").replace("\n", ""),
}.items():
    assert src.count(key) == 1, key
    src = src.replace(key, val)
assert src.count('"%%EDITION%%"') == 1

art = src.replace('"%%EDITION%%"', '"artifact"')
(root / "ant-playground.html").write_text(art, encoding="utf-8")
print("wrote ant-playground.html", len(art) // 1024, "KB")

site = src.replace('"%%EDITION%%"', '"site"')
head, body = site.split("<style>", 1)       # title, meta and font links go in <head>
page = ('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
        '<meta name="description" content="A top-down ant colony made from AI-drawn sprite sheets, with a spider, an anteater, and Aunt Hillary, the talking colony from Gödel, Escher, Bach.">\n'
        '<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 32 32%22%3E%3Cellipse cx=%2216%22 cy=%2222%22 rx=%225%22 ry=%227%22 fill=%22%232a1a10%22/%3E%3Ccircle cx=%2216%22 cy=%2212%22 r=%223.4%22 fill=%22%23a8431c%22/%3E%3Ccircle cx=%2216%22 cy=%226.5%22 r=%223%22 fill=%22%23a8431c%22/%3E%3C/svg%3E">\n'
        + head.strip() + "\n<style>\n[hidden]{display:none!important}\n" + body.split("</style>", 1)[0]
        + "</style>\n</head>\n<body>\n" + body.split("</style>", 1)[1].strip() + "\n</body>\n</html>\n")
(root / "index.html").write_text(page, encoding="utf-8")
(b / "preview.html").write_text(page, encoding="utf-8")
print("wrote index.html", len(page) // 1024, "KB")
