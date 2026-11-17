"""Shared helpers for cut_sheet.py / cut_cards.py."""
from PIL import Image, ImageFilter


def fill_holes(px, bg, w, h, is_white, min_area=1500):
    """Mark big enclosed near-white areas (e.g. the middle of a rope coil) as background too."""
    seen = bytearray(w * h)
    for sy in range(h):
        for sx in range(w):
            i = sy * w + sx
            if bg[i] or seen[i] or not is_white(px[sx, sy]):
                continue
            comp, st = [], [(sx, sy)]
            seen[i] = 1
            while st:
                x, y = st.pop(); comp.append(y * w + x)
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if 0 <= nx < w and 0 <= ny < h:
                        j = ny * w + nx
                        if not bg[j] and not seen[j] and is_white(px[nx, ny]):
                            seen[j] = 1; st.append((nx, ny))
            if len(comp) >= min_area:
                for j in comp:
                    bg[j] = 1


def keep_largest(rgba):
    """Erase every separate speck except the biggest object, then trim to its bounds."""
    w, h = rgba.size
    a = rgba.split()[3]
    grown = a.point(lambda v: 255 if v > 16 else 0).filter(ImageFilter.MaxFilter(7)).load()
    lab = [0] * (w * h); sizes = {}; k = 0
    for sy in range(h):
        for sx in range(w):
            if grown[sx, sy] and not lab[sy * w + sx]:
                k += 1; st = [(sx, sy)]; lab[sy * w + sx] = k; n = 0
                while st:
                    x, y = st.pop(); n += 1
                    for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                        if 0 <= nx < w and 0 <= ny < h and grown[nx, ny] and not lab[ny * w + nx]:
                            lab[ny * w + nx] = k; st.append((nx, ny))
                sizes[k] = n
    if not sizes:
        return rgba
    top = max(sizes, key=sizes.get)
    out = rgba.copy(); op = out.load()
    for y in range(h):
        for x in range(w):
            if lab[y * w + x] != top:
                r, g, b, _ = op[x, y]; op[x, y] = (r, g, b, 0)
    return out.crop(out.getbbox())
