"""Cut a sheet of generated item images into transparent .webp files.

Usage: python cut_sheet.py SHEET NAME1 NAME2 ... [--out DIR] [--size N]
Items are found on a plain white background, then named left-to-right, top-to-bottom.
Writes DIR/NAME.webp (default DIR = ../gossip-gardens/art/items), longest side = N px (default 300).
"""
import sys, os
from collections import deque
from PIL import Image, ImageFilter
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cutlib import fill_holes, keep_largest

def main():
    args = sys.argv[1:]
    out = os.path.join(os.path.dirname(__file__), '..', 'gossip-gardens', 'art', 'items')
    size = 300
    holes = False
    if '--holes' in args:
        args.remove('--holes'); holes = True
    if '--out' in args:
        i = args.index('--out'); out = args[i + 1]; del args[i:i + 2]
    if '--size' in args:
        i = args.index('--size'); size = int(args[i + 1]); del args[i:i + 2]
    sheet, names = args[0], args[1:]
    im = Image.open(sheet).convert('RGB')
    w, h = im.size
    px = im.load()
    near_white = lambda p: p[0] > 238 and p[1] > 238 and p[2] > 238
    bg = bytearray(w * h)  # 1 = background, flood-filled from the borders
    dq = deque()
    for x in range(w):
        for y in (0, h - 1):
            dq.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            dq.append((x, y))
    while dq:
        x, y = dq.popleft()
        if x < 0 or y < 0 or x >= w or y >= h or bg[y * w + x] or not near_white(px[x, y]):
            continue
        bg[y * w + x] = 1
        dq.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
    if holes: fill_holes(px, bg, w, h, near_white)
    alpha = Image.new('L', (w, h))
    alpha.putdata([0 if b else 255 for b in bg])
    # find separate items (connected blobs, small gap tolerance by dilating a copy)
    grow = alpha.filter(ImageFilter.MaxFilter(9))
    gp = grow.load()
    seen = bytearray(w * h)
    boxes = []
    for sy in range(h):
        for sx in range(w):
            if gp[sx, sy] and not seen[sy * w + sx]:
                x0 = x1 = sx; y0 = y1 = sy; n = 0
                st = [(sx, sy)]; seen[sy * w + sx] = 1
                while st:
                    x, y = st.pop(); n += 1
                    x0 = min(x0, x); x1 = max(x1, x); y0 = min(y0, y); y1 = max(y1, y)
                    for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                        if 0 <= nx < w and 0 <= ny < h and gp[nx, ny] and not seen[ny * w + nx]:
                            seen[ny * w + nx] = 1; st.append((nx, ny))
                if n > 2000:
                    boxes.append((x0, y0, x1, y1))
    # reading order: group into rows by vertical centre
    boxes.sort(key=lambda b: (b[1] + b[3]) / 2)
    rows, cur = [], []
    for b in boxes:
        if cur and (b[1] + b[3]) / 2 - (cur[0][1] + cur[0][3]) / 2 > 0.6 * (cur[0][3] - cur[0][1]):
            rows.append(cur); cur = []
        cur.append(b)
    if cur: rows.append(cur)
    ordered = [b for r in rows for b in sorted(r, key=lambda b: b[0])]
    print('found', len(ordered), 'items; names given', len(names))
    if len(ordered) != len(names):
        print('MISMATCH - nothing written'); sys.exit(1)
    os.makedirs(out, exist_ok=True)
    soft = alpha.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.7))
    rgba = im.copy(); rgba.putalpha(soft)
    for (x0, y0, x1, y1), name in zip(ordered, names):
        pad = 6
        crop = rgba.crop((max(0, x0 - pad), max(0, y0 - pad), min(w, x1 + pad + 1), min(h, y1 + pad + 1)))
        crop = keep_largest(crop)
        s = size / max(crop.size)
        crop = crop.resize((max(1, round(crop.width * s)), max(1, round(crop.height * s))), Image.LANCZOS)
        path = os.path.join(out, name + '.webp')
        crop.save(path, 'WEBP', quality=90)
        print('wrote', path, crop.size)

main()
