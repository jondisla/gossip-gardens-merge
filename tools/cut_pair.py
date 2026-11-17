"""Cut a before/after pair (two versions of one object side by side) into NAME_before.webp and NAME_after.webp.

Usage: python cut_pair.py SHEET NAME [--out DIR] [--size N] [--thresh N] [--holes before|after|both] [--hole-min N]
Use --holes before when white background shows through gaps in the broken version (branches, vines).
Both halves are scaled by the SAME amount and stand on the same ground line in a square N x N picture,
so the repaired object lines up exactly with the broken one. Output default: art/plots, 384 px.
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import cut_cards
from PIL import Image


def main():
    a = sys.argv[1:]
    out = os.path.join(os.path.dirname(__file__), '..', 'gossip-gardens', 'art', 'plots'); size = 384
    holes = ''
    for flag in ('--out', '--size', '--thresh', '--holes', '--hole-min'):
        if flag in a:
            i = a.index(flag); v = a[i + 1]; del a[i:i + 2]
            if flag == '--out': out = v
            elif flag == '--size': size = int(v)
            elif flag == '--holes': holes = v
            elif flag == '--hole-min': cut_cards.HOLE_MIN = int(v)
            else: cut_cards.THRESH = int(v)
    sheet, name = a[0], a[1]
    im = Image.open(sheet).convert('RGB')
    w, h = im.size
    halves = [im.crop((0, 0, w // 2, h)), im.crop((w // 2, 0, w, h))]
    want = [holes in ('before', 'both'), holes in ('after', 'both')]
    parts = [cut_cards.cut(hv, 100000, hl) for hv, hl in zip(halves, want)]     # trimmed, not scaled
    s = min(size / max(max(p.size) for p in parts), 1.0)
    os.makedirs(out, exist_ok=True)
    for p, tag in zip(parts, ('before', 'after')):
        p = p.resize((max(1, round(p.width * s)), max(1, round(p.height * s))), Image.LANCZOS)
        canvas = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        canvas.paste(p, ((size - p.width) // 2, size - p.height - 6), p)
        path = os.path.join(out, name + '_' + tag + '.webp')
        canvas.save(path, 'WEBP', quality=90)
        print('wrote', path, 'object', p.size)


main()
