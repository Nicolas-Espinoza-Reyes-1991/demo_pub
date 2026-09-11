import os
from PIL import Image

TARGET_DIR = os.path.join(os.path.dirname(__file__), '..', 'public', 'imagenes_sitio')
QUALITY = 75
MAX_WIDTH = 1600

FILES = [
    'hero-banner-01.jpeg',
    'hero-banner-02.jpeg',
    'hero-banner-03.jpeg',
    'disco-pista-neon.jpg',
    'evento-disco-masivo.jpeg',
    'evento-dj-vivo.jpeg',
    'evento-musica-vivo.jpeg',
    'karaoke-live.jpg',
    'nosotros-after-office.jpeg',
    'terraza-noche.jpg',
]

results = []
for fname in FILES:
    path = os.path.join(TARGET_DIR, fname)
    before = os.path.getsize(path)
    im = Image.open(path).convert('RGB')
    if im.width > MAX_WIDTH:
        ratio = MAX_WIDTH / im.width
        im = im.resize((MAX_WIDTH, round(im.height * ratio)), Image.LANCZOS)
    webp_name = os.path.splitext(fname)[0] + '.webp'
    webp_path = os.path.join(TARGET_DIR, webp_name)
    im.save(webp_path, 'WEBP', quality=QUALITY, method=6)
    after = os.path.getsize(webp_path)
    results.append((fname, webp_name, before, after))

total_before = sum(r[2] for r in results)
total_after = sum(r[3] for r in results)
for old, new, before, after in results:
    print(f'{old} -> {new}: {before} -> {after} bytes ({100 - after * 100 // before}% smaller)')
print(f'\nTOTAL: {total_before} -> {total_after} bytes ({100 - total_after * 100 // total_before}% smaller)')
