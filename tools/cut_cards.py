"""Cut items from a sheet laid out as framed cards with text labels.

Usage: python cut_cards.py SHEET LAYOUT NAME1 NAME2 ... [--out DIR] [--size N] [--preview FILE] [--holes NAME,NAME] [--thresh N]
LAYOUT is one of:  row2 (two cards side by side, short), tall2 (two tall cards), grid4 (2x2 cards),
or custom regions "x0,y0,x1,y1;x0,y0,x1,y1;..." (card interiors, in reading order).
Each region is cropped, the near-white background flood-filled to transparent, and only the largest
object is kept (labels and frame lines are ignored). Output: DIR/NAME.webp (default art/items).
"""
import sys, os
from collections import deque
from PIL import Image, ImageFilter
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cutlib import fill_holes, keep_largest

LAYOUTS = {
    'row2': '30,112,492,576;532,112,995,576',
    'tall2': '30,95,492,600;532,95,995,600',
    'grid4': '30,95,492,335;532,95,995,335;30,367,492,602;532,367,995,602',
}

THRESH = 236
HOLE_MIN = 1500   # enclosed near-white areas at least this many pixels big count as background when holes are on

def cut(region_im, size, holes=False):
    w, h = region_im.size
    px = region_im.load()
    nw = lambda p: min(p) > THRESH
    bg = bytearray(w * h)
    dq = deque([(x, y) for x in range(w) for y in (0, h - 1)] + [(x, y) for y in range(h) for x in (0, w - 1)])
    while dq:
        x, y = dq.popleft()
        if x < 0 or y < 0 or x >= w or y >= h or bg[y * w + x] or not nw(px[x, y]):
            continue
        bg[y * w + x] = 1
        dq.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
    if holes: fill_holes(px, bg, w, h, nw, HOLE_MIN)
    alpha = Image.new('L', (w, h)); alpha.putdata([0 if b else 255 for b in bg])
    gp = alpha.filter(ImageFilter.MaxFilter(7)).load()
    seen = bytearray(w * h); best = None
    for sy in range(h):
        for sx in range(w):
            if gp[sx, sy] and not seen[sy * w + sx]:
                x0 = x1 = sx; y0 = y1 = sy; n = 0; st = [(sx, sy)]; seen[sy * w + sx] = 1
                while st:
                    x, y = st.pop(); n += 1
                    x0 = min(x0, x); x1 = max(x1, x); y0 = min(y0, y); y1 = max(y1, y)
                    for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                        if 0 <= nx < w and 0 <= ny < h and gp[nx, ny] and not seen[ny * w + nx]:
                            seen[ny * w + nx] = 1; st.append((nx, ny))
                if best is None or n > best[0]:
                    best = (n, x0, y0, x1, y1)
    _, x0, y0, x1, y1 = best
    soft = alpha.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.6))
    rgba = region_im.copy(); rgba.putalpha(soft)
    crop = rgba.crop((x0, y0, x1 + 1, y1 + 1))
    crop = keep_largest(crop)
    s = min(size / max(crop.size), 1.0)  # never upscale
    return crop.resize((max(1, round(crop.width * s)), max(1, round(crop.height * s))), Image.LANCZOS)

def main():
    a = sys.argv[1:]
    out = os.path.join(os.path.dirname(__file__), '..', 'gossip-gardens', 'art', 'items'); size = 300; prev = None; holes = set()
    global THRESH
    for flag in ('--out', '--size', '--preview', '--holes', '--thresh'):
        if flag in a:
            i = a.index(flag); v = a[i + 1]; del a[i:i + 2]
            if flag == '--out': out = v
            elif flag == '--size': size = int(v)
            elif flag == '--holes': holes = set(v.split(','))
            elif flag == '--thresh': THRESH = int(v)
            else: prev = v
    sheet, layout, names = a[0], a[1], a[2:]
    regions = [tuple(int(n) for n in r.split(',')) for r in LAYOUTS.get(layout, layout).split(';')]
    if len(regions) != len(names):
        print('MISMATCH: %d regions, %d names - nothing written' % (len(regions), len(names))); sys.exit(1)
    im = Image.open(sheet).convert('RGB')
    os.makedirs(out, exist_ok=True)
    pv = Image.new('RGB', (len(names) * 330, 330), (120, 160, 90)) if prev else None
    for i, (r, name) in enumerate(zip(regions, names)):
        res = cut(im.crop(r), size, name in holes)
        res.save(os.path.join(out, name + '.webp'), 'WEBP', quality=90)
        print('wrote', name, res.size)
        if pv: pv.paste(res, (i * 330 + 10, 10), res)
    if pv: pv.save(prev)

if __name__ == '__main__':
    main()
