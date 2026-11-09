"""Cut the food sheet (4 pile stages + 4 single crumbs) and the spider walk sheet.

Both sources are 4x2 sheets that are already transparent.
  build/food-atlas.webp    row 0 = piles, full -> nearly gone (one scale for all four)
                           row 1 = single crumbs (one scale for all four)
  build/spider-atlas.webp  8 walking frames, facing up, pinned on the body
Run:  python tools/extract_extras.py
"""
import json, pathlib
import numpy as np
from PIL import Image

root = pathlib.Path(__file__).resolve().parent.parent
FOOD_TILE, SPIDER_TILE = 160, 384


def cells(path):
    im = Image.open(path).convert("RGBA")
    W, H = im.size
    cw, ch = W / 4, H / 2
    return [im.crop((round(c * cw), round(r * ch), round((c + 1) * cw), round((r + 1) * ch)))
            for r in range(2) for c in range(4)]


def clean(cell, thresh=24):
    """Drop faint haze (the sheets carry a little near-zero alpha noise)."""
    a = np.asarray(cell).copy()
    a[a[..., 3] < thresh] = 0
    return Image.fromarray(a, "RGBA")


def erode(m, r):
    for _ in range(r):
        n = m.copy()
        n[1:, :] &= m[:-1, :]; n[:-1, :] &= m[1:, :]
        n[:, 1:] &= m[:, :-1]; n[:, :-1] &= m[:, 1:]
        m = n
    return m


# ---------- food ----------
food = [clean(c) for c in cells(root / "food-source.webp")]
atlas = Image.new("RGBA", (FOOD_TILE * 4, FOOD_TILE * 2), (0, 0, 0, 0))
meta = {"tile": FOOD_TILE, "piles": [], "singles": []}
for row in range(2):
    group = food[row * 4:(row + 1) * 4]
    boxes = [c.getbbox() for c in group]
    biggest = max(max(b[2] - b[0], b[3] - b[1]) for b in boxes)
    s = (FOOD_TILE - 12) / biggest                     # one scale per row keeps the stages in proportion
    for i, (c, b) in enumerate(zip(group, boxes)):
        piece = c.crop(b)
        piece = piece.resize((max(1, round(piece.width * s)), max(1, round(piece.height * s))), Image.LANCZOS)
        x0 = i * FOOD_TILE + (FOOD_TILE - piece.width) // 2
        y0 = row * FOOD_TILE + (FOOD_TILE - piece.height) // 2
        atlas.paste(piece, (x0, y0), piece)
        # size of the piece as a fraction of the tile, so the page can scale by real extent
        (meta["piles"] if row == 0 else meta["singles"]).append(round(max(piece.size) / FOOD_TILE, 3))
        print(f"food r{row} #{i}: bbox {b} -> {piece.size}")
atlas.save(root / "build" / "food-atlas.webp", "WEBP", quality=90, alpha_quality=100, method=6)
atlas.save(root / "build" / "food-atlas.png", optimize=True)

# ---------- spider ----------
spider = [clean(c) for c in cells(root / "spider-source.webp")]
found = []
for c in spider:
    er = max(6, int(c.width * 0.035))
    body = erode(np.asarray(c)[..., 3] > 120, er)        # legs gone, body left
    ys, xs = np.nonzero(body)
    rows = {}
    for y, x in zip(ys, xs):
        lo, hi = rows.get(y, (x, x)); rows[y] = (min(lo, x), max(hi, x))
    # the abdomen is the widest part in the lower half of the body
    mid = (ys.min() + ys.max()) / 2
    wy = max((y for y in rows if y > mid), key=lambda y: rows[y][1] - rows[y][0])
    aw = rows[wy][1] - rows[wy][0] + 1 + 2 * er
    ax = (rows[wy][0] + rows[wy][1]) / 2
    found.append((c, aw, ax, ys.min() - er, ys.max() + er))
s = 0.75
pad = 0
satlas = Image.new("RGBA", (SPIDER_TILE * 8, SPIDER_TILE), (0, 0, 0, 0))
body_len = float(np.median([f[4] - f[3] for f in found]))
for i, (c, aw, ax, top, tip) in enumerate(found):
    cy = (top + tip) / 2
    cx = ax
    small = c.resize((round(c.width * s), round(c.height * s)), Image.LANCZOS)
    tile = Image.new("RGBA", (SPIDER_TILE, SPIDER_TILE), (0, 0, 0, 0))
    ox, oy = round(SPIDER_TILE / 2 - cx * s), round(SPIDER_TILE / 2 - cy * s)
    tile.paste(small, (ox, oy))
    bb = tile.getbbox()
    lost = np.asarray(small)[..., 3].sum() - np.asarray(tile)[..., 3].sum()
    satlas.paste(tile, (i * SPIDER_TILE, 0))
    print(f"spider f{i + 1}: abdomen {aw}px  body {top}-{tip}  tile bbox {bb}  alpha cut {lost}")
abd = float(np.median([f[1] for f in found])) * s
satlas.save(root / "build" / "spider-atlas.webp", "WEBP", quality=86, alpha_quality=90, method=6)
satlas.save(root / "build" / "spider-atlas.png", optimize=True)
json.dump({"food": meta, "spider": {"tile": SPIDER_TILE, "abdomen_px": round(abd, 1), "body_px": round(body_len * s, 1)}},
          open(root / "build" / "extras.json", "w"), indent=1)
print("spider abdomen in tile px", round(abd, 1), "body length", round(body_len * s, 1))
prev = Image.new("RGBA", (satlas.width, satlas.height + atlas.height), (138, 106, 67, 255))
prev.alpha_composite(satlas); prev.alpha_composite(atlas, (0, satlas.height))
prev.convert("RGB").save(root / "build" / "extras-preview.png")
