"""Cut the 4x2 top-down sheets (walking, carrying) into one aligned atlas.

Each frame is anchored on its abdomen so the body doesn't drift between
frames, and both sheets are scaled to the same abdomen size so the walking
and carrying ants match.  Writes build/topdown-atlas.webp + .png + json.

Run:  python tools/extract_topdown.py
"""
import json, pathlib
from collections import deque
import numpy as np
from PIL import Image

root = pathlib.Path(__file__).resolve().parent.parent
SHEETS = [("walk", root / "topdown-source.webp"), ("carry", root / "crumb-source.webp")]
TILE = 200            # output tile, square
ABD_H = 30            # abdomen width in output pixels
ANCHOR_UP = 2.2       # rotation center: this many abdomen-widths above the abdomen tip
MATCH_COLOR = True    # tint the carrying ant to match the walking one


def erode(m, r):
    for _ in range(r):
        n = m.copy()
        n[1:, :] &= m[:-1, :]; n[:-1, :] &= m[1:, :]
        n[:, 1:] &= m[:, :-1]; n[:, :-1] &= m[:, 1:]
        m = n
    return m


def blobs(mask):
    h, w = mask.shape
    lab = np.zeros((h, w), np.int32)
    out = []
    for y, x in zip(*np.nonzero(mask)):
        if lab[y, x]:
            continue
        idx = len(out) + 1
        q = deque([(y, x)]); lab[y, x] = idx; pts = []
        while q:
            cy, cx = q.popleft(); pts.append((cy, cx))
            for ny, nx in ((cy + 1, cx), (cy - 1, cx), (cy, cx + 1), (cy, cx - 1)):
                if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not lab[ny, nx]:
                    lab[ny, nx] = idx; q.append((ny, nx))
        out.append(np.array(pts))
    return out


atlas = Image.new("RGBA", (TILE * 8, TILE * len(SHEETS)), (0, 0, 0, 0))
meta = {"tile": TILE, "rows": [s[0] for s in SHEETS], "frames": 8, "facing": "up", "abdomen_px": ABD_H}
for row, (name, path) in enumerate(SHEETS):
    im = Image.open(path).convert("RGBA")
    W, H = im.size
    cw, ch = W / 4, H / 2
    er = max(6, int(cw * 0.03))
    found = []
    for f in range(8):
        r, c = divmod(f, 4)
        cell = im.crop((round(c * cw), round(r * ch), round((c + 1) * cw), round((r + 1) * ch)))
        body = erode(np.asarray(cell)[..., 3] > 100, er)   # legs and antennae gone
        pts = np.concatenate([b for b in blobs(body) if len(b) > 200])
        ys, xs = pts[:, 0], pts[:, 1]
        widths = {}
        for y, x in zip(ys, xs):
            lo, hi = widths.get(y, (x, x)); widths[y] = (min(lo, x), max(hi, x))
        wy = max(widths, key=lambda y: widths[y][1] - widths[y][0])   # widest row = abdomen
        aw = widths[wy][1] - widths[wy][0] + 1 + 2 * er
        ax = (widths[wy][0] + widths[wy][1]) / 2
        tip = ys.max() + er
        found.append((cell, aw, ax, tip))
    # one scale per sheet, so the ant doesn't pulse; per-frame anchor, so it doesn't drift
    s = ABD_H / float(np.median([x[1] for x in found]))
    for f, (cell, aw, ax, tip) in enumerate(found):
        cx, cy = ax, tip - ANCHOR_UP * ABD_H / s
        small = cell.resize((round(cell.width * s), round(cell.height * s)), Image.LANCZOS)
        tile = Image.new("RGBA", (TILE, TILE), (0, 0, 0, 0))
        tile.paste(small, (round(TILE / 2 - cx * s), round(TILE / 2 - cy * s)))
        atlas.paste(tile, (f * TILE, row * TILE))
        print(f"{name} f{f + 1}: abdomen width {aw}px x {ax:.0f} tip {tip}  scale {s:.3f}  ant {small.getbbox()}")

if MATCH_COLOR:
    # the carrying ant was drawn darker; pull its body toward the walking ant's rust,
    # leaving the light crumb alone
    A = np.asarray(atlas).astype(np.float64)
    walk, carry = A[:TILE], A[TILE:]
    def body(px):
        lum = px[..., :3].mean(-1)
        return (px[..., 3] > 200) & (lum < 110)
    wm = walk[body(walk)][:, :3].mean(0)
    cm = carry[body(carry)][:, :3].mean(0)
    gain = wm / cm
    lum = carry[..., :3].mean(-1)
    w = np.clip((130 - lum) / 40, 0, 1)[..., None]       # 1 on the body, 0 on the crumb
    carry[..., :3] = np.clip(carry[..., :3] * (1 + (gain - 1) * w), 0, 255)
    atlas = Image.fromarray(np.concatenate([walk, carry]).round().astype(np.uint8), "RGBA")
    print("carry color gain", gain.round(2))

atlas.save(root / "build" / "topdown-atlas.png", optimize=True)
atlas.save(root / "build" / "topdown-atlas.webp", "WEBP", quality=92, alpha_quality=100, method=6)
(root / "build" / "topdown-atlas.json").write_text(json.dumps(meta))
prev = Image.new("RGBA", atlas.size, (120, 92, 60, 255)); prev.alpha_composite(atlas)
prev.convert("RGB").save(root / "build" / "topdown-preview.png")
