# ===================== Maison Meka — smaller copies ===================== #
# Writes assets/sm/<name>-<width>.webp for the photos the home page shows
# small (Instagram tiles, client photos, the tea-set card). The pages list
# them in srcset, so a phone downloads a copy sized for its screen while a
# large screen still gets the original.
#
#   python tools/sizes.py

import os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
A = os.path.join(ROOT, 'assets')
OUT = os.path.join(A, 'sm')
JOBS = {**{f'g{n}': (300, 600) for n in range(1, 6)},
        **{f'rev{n}': (300, 600) for n in range(1, 8)},
        'c-teaset-plate': (440,)}

os.makedirs(OUT, exist_ok=True)
for name, widths in JOBS.items():
    im = Image.open(os.path.join(A, name + '.webp'))
    im.load()
    for w in widths:
        h = round(im.height * w / im.width)
        im.resize((w, h), Image.LANCZOS).save(os.path.join(OUT, f'{name}-{w}.webp'), 'WEBP', quality=84, method=6)
print('done')
