"""Cut the 16x8 ant frames out of the AI-made sheet, remove the gray
background, center each frame on its body, and measure which way each ant
really faces (abdomen -> head).  Writes ant-atlas.png + ant-atlas.json.

Run:  python -I tools/extract.py sheet-source.webp out-dir
"""
import json, math, sys
from collections import deque
import numpy as np
from PIL import Image

SRC, OUT = sys.argv[1], sys.argv[2]
COLS = [113, 218, 323, 427, 532, 637, 742, 846, 951]
ROWS = [57, 99, 141, 183, 225, 268, 310, 352, 392, 432, 472, 512, 553, 595, 638, 680, 728]
LABELS = [i * 22.5 for i in range(16)]
TW, TH = 112, 64  # atlas tile

im = np.asarray(Image.open(SRC).convert("RGB")).astype(np.float64)


def plane_bg(cell):
    """Fit a per-channel plane to the bright border pixels -> background image."""
    h, w, _ = cell.shape
    yy, xx = np.mgrid[0:h, 0:w]
    ring = np.zeros((h, w), bool)
    ring[:3, :] = ring[-3:, :] = ring[:, :3] = ring[:, -3:] = True
    lum = cell.mean(2)
    sel = ring & (lum > np.percentile(lum[ring], 25))
    A = np.stack([np.ones(sel.sum()), xx[sel], yy[sel]], 1)
    bg = np.zeros_like(cell)
    for c in range(3):
        coef, *_ = np.linalg.lstsq(A, cell[..., c][sel], rcond=None)
        bg[..., c] = coef[0] + coef[1] * xx + coef[2] * yy
    return bg


def components(mask):
    h, w = mask.shape
    lab = np.zeros((h, w), int)
    sizes = [0]
    n = 0
    for y in range(h):
        for x in range(w):
            if mask[y, x] and not lab[y, x]:
                n += 1
                q = deque([(y, x)])
                lab[y, x] = n
                s = 0
                while q:
                    cy, cx = q.popleft()
                    s += 1
                    for dy in (-1, 0, 1):
                        for dx in (-1, 0, 1):
                            ny, nx = cy + dy, cx + dx
                            if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not lab[ny, nx]:
                                lab[ny, nx] = n
                                q.append((ny, nx))
                sizes.append(s)
    return lab, sizes


atlas = np.zeros((16 * TH, 8 * TW, 4), np.uint8)
meta = {"tile": [TW, TH], "rows": 16, "cols": 8, "labels": LABELS, "frames": []}

for r in range(16):
    row = []
    for c in range(8):
        x0, x1 = COLS[c] + 3, COLS[c + 1] - 2
        y0, y1 = ROWS[r] + 3, ROWS[r + 1] - 2
        cell = im[y0:y1, x0:x1]
        bg = plane_bg(cell)
        dist = np.sqrt(((cell - bg) ** 2).sum(2))
        darker = bg.mean(2) - cell.mean(2)
        # shadows are neutral and only a little darker; ant is dark or rusty
        sat = cell.max(2) - cell.min(2)
        score = np.maximum(darker, 0) * 0.9 + np.maximum(sat - 12, 0) * 1.2
        score = np.maximum(score, dist * 0.6)
        alpha = np.clip((score - 22) / 40, 0, 1)

        lab, sizes = components(alpha > 0.18)
        big = int(np.argmax(sizes))
        keep = lab == big
        # body center of the main blob
        ky, kx = np.nonzero(keep)
        cy0, cx0 = ky.mean(), kx.mean()
        for i, s in enumerate(sizes):
            if i and i != big and s >= 18:
                py, px = np.nonzero(lab == i)
                if math.hypot(py.mean() - cy0, px.mean() - cx0) < 30:
                    keep |= lab == i
        # grow keep by 1px so soft edges survive
        k2 = keep.copy()
        k2[1:, :] |= keep[:-1, :]; k2[:-1, :] |= keep[1:, :]
        k2[:, 1:] |= keep[:, :-1]; k2[:, :-1] |= keep[:, 1:]
        alpha = alpha * k2

        a3 = alpha[..., None]
        col = np.where(a3 > 0.04, (cell - (1 - a3) * bg) / np.maximum(a3, 1e-3), 0)
        col = np.clip(col, 0, 255)

        lum = cell.mean(2)
        dark = keep & (lum < 75) & (alpha > 0.8)
        red = keep & (cell[..., 0] > cell[..., 2] + 30) & (cell[..., 0] > 80) & (lum < 160)
        dy_, dx_ = np.nonzero(dark)
        ry_, rx_ = np.nonzero(red)
        heading = None
        if len(dx_) > 5 and len(rx_) > 5:
            heading = math.degrees(math.atan2(-(ry_.mean() - dy_.mean()), rx_.mean() - dx_.mean())) % 360

        # place alpha-weighted body center at tile center
        wy, wx = np.mgrid[0:alpha.shape[0], 0:alpha.shape[1]]
        tot = alpha.sum()
        ccy, ccx = (wy * alpha).sum() / tot, (wx * alpha).sum() / tot
        oy = int(round(TH / 2 - ccy)) + r * TH
        ox = int(round(TW / 2 - ccx)) + c * TW
        rgba = np.dstack([col, alpha * 255]).round().astype(np.uint8)
        h, w = alpha.shape
        for yy in range(h):
            ty = oy + yy
            if not (r * TH <= ty < (r + 1) * TH):
                continue
            for xx in range(w):
                tx = ox + xx
                if c * TW <= tx < (c + 1) * TW and rgba[yy, xx, 3]:
                    atlas[ty, tx] = rgba[yy, xx]
        row.append(None if heading is None else round(heading, 1))
    meta["frames"].append(row)
    print(f"row {r:2d} label {LABELS[r]:6.1f}  measured", row)

Image.fromarray(atlas, "RGBA").save(f"{OUT}/ant-atlas.png", optimize=True)
with open(f"{OUT}/ant-atlas.json", "w") as f:
    json.dump(meta, f)

# preview on a dark checker so halos show up
prev = Image.new("RGBA", (atlas.shape[1], atlas.shape[0]), (60, 90, 50, 255))
prev.alpha_composite(Image.fromarray(atlas, "RGBA"))
prev.convert("RGB").save(f"{OUT}/atlas-preview.png")
