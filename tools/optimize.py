# ===================== Maison Meka — image optimiser ===================== #
# Makes a WebP copy of every PNG/JPG in assets/ (uploads excluded) and points
# the site's code and data at the WebP files. WebP is far lighter than PNG
# at the same visual quality; transparent images keep their transparency.
#
#   python tools/optimize.py
#
# The originals stay in assets/ (the Vercel build skips them).

import os, re, json
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, 'assets')
MAX_SIDE = 1920

converted = {}
before = after = 0
for folder, _, files in os.walk(ASSETS):
    if 'uploads' in folder:
        continue
    for f in files:
        if not f.lower().endswith(('.png', '.jpg', '.jpeg')):
            continue
        src = os.path.join(folder, f)
        dst = os.path.splitext(src)[0] + '.webp'
        im = Image.open(src)
        im.load()
        if max(im.size) > MAX_SIDE:
            im.thumbnail((MAX_SIDE, MAX_SIDE), Image.LANCZOS)
        alpha = im.mode in ('RGBA', 'LA', 'P') and ('transparency' in im.info or im.mode != 'P')
        if im.mode == 'P':
            im = im.convert('RGBA')
            alpha = im.getextrema()[3][0] < 255
        if alpha:
            im = im.convert('RGBA')
            im.save(dst, 'WEBP', quality=84, method=6)
        else:
            im.convert('RGB').save(dst, 'WEBP', quality=80, method=6)
        rel_src = os.path.relpath(src, ROOT).replace('\\', '/')
        rel_dst = os.path.relpath(dst, ROOT).replace('\\', '/')
        converted[rel_src] = rel_dst
        before += os.path.getsize(src); after += os.path.getsize(dst)

print(f'{len(converted)} images: {before // 1024} KB -> {after // 1024} KB')

# point the code at the WebP files
pattern = re.compile('|'.join(re.escape(k) for k in sorted(converted, key=len, reverse=True)))
targets = []
for folder in ['', 'admin', 'lib', 'tools', 'api']:
    base = os.path.join(ROOT, folder)
    for f in os.listdir(base):
        if f.endswith(('.html', '.css', '.js', '.json')) and f not in ('package.json', 'package-lock.json'):
            targets.append(os.path.join(base, f))
changed = 0
for path in targets:
    with open(path, encoding='utf-8') as fh:
        text = fh.read()
    new = pattern.sub(lambda m: converted[m.group(0)], text)
    if new != text:
        with open(path, 'w', encoding='utf-8', newline='\n') as fh:
            fh.write(new)
        changed += 1
print(f'{changed} code files updated')

with open(os.path.join(ROOT, 'tools', 'webp-map.json'), 'w') as fh:
    json.dump(converted, fh, indent=1)
