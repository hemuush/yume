"""
Recolours Yume's launcher icon once per theme pack (npm run icons:themes).

Only colour changes: each output keeps the source's size, alpha channel and artwork, so a themed icon is
pixel-for-pixel the same shape as assets/icon.png and assets/android-icon-foreground.png. The crescent takes
the pack's primary and the dot its dot (or secondary) colour. Yume itself is the untouched default icon.
"""
import re
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'assets' / 'theme-icons'
CREAM = np.array([254, 251, 241], float)
WHITE = np.array([255, 255, 255], float)
BLUE = np.array([158, 197, 253], float)  # crescent in the source art
CORAL = np.array([252, 125, 96], float)  # dot in the source art


def packs():
    src = (ROOT / 'src' / 'theme' / 'themes.ts').read_text()
    for m in re.finditer(r"id: '(\w+)',\s*name: '[^']*',\s*primary: '(#\w+)',\s*secondary: '(#\w+)'(?:,\s*dot: '(#\w+)')?", src):
        yield m.group(1), m.group(2), m.group(4) or m.group(3)


def rgb(hex_):
    return np.array([int(hex_[i : i + 2], 16) for i in (1, 3, 5)], float)


def recolour(arr, ground, primary, dot):
    """Maps each pixel's blend of art colour over `ground` onto the same blend of the new colour."""
    px = arr[..., :3].astype(float)
    is_dot = px[..., 0] > px[..., 2] + 20
    s_blue = np.clip((ground[0] - px[..., 0]) / (ground[0] - BLUE[0]), 0, 1)
    s_coral = np.clip((ground[2] - px[..., 2]) / (ground[2] - CORAL[2]), 0, 1)
    s = np.where(is_dot, s_coral, s_blue)[..., None]
    new = np.where(is_dot[..., None], dot, primary)
    out = ground * (1 - s) + new * s
    res = arr.copy()
    res[..., :3] = np.clip(np.rint(out), 0, 255).astype(np.uint8)
    return res


def main():
    OUT.mkdir(exist_ok=True)
    icon = np.array(Image.open(ROOT / 'assets' / 'icon.png').convert('RGBA'))
    fore = np.array(Image.open(ROOT / 'assets' / 'android-icon-foreground.png').convert('RGBA'))
    for pid, primary, dot in packs():
        if pid == 'yume':
            continue
        p, d = rgb(primary), rgb(dot)
        Image.fromarray(recolour(icon, CREAM, p, d)).save(OUT / f'{pid}.png', optimize=True)
        # The foreground is transparent: its soft edges were matted against white.
        Image.fromarray(recolour(fore, WHITE, p, d)).save(OUT / f'{pid}-foreground.png', optimize=True)
        print(pid, primary, dot)


if __name__ == '__main__':
    main()
