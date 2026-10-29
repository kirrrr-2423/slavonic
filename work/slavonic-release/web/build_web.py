#!/usr/bin/env python3
"""Build the offline web release without touching the canonical demo."""
from pathlib import Path
import hashlib, json, shutil, zipfile, sys

ROOT = Path(__file__).resolve().parent
WORKSPACE = ROOT.parents[2]
sys.path.insert(0, str(ROOT.parent))
from release_config import load_release, source_directory
RELEASE_CONFIG = load_release()
SOURCE = source_directory(RELEASE_CONFIG, WORKSPACE)
DEST = ROOT / 'slavonic-web'
RELEASE_VERSION = RELEASE_CONFIG['version']
OUTPUT = WORKSPACE / f'outputs/Slavonic-{RELEASE_VERSION}-Web.zip'
if OUTPUT.exists():
    raise FileExistsError(f'Existing release archive will not be overwritten: {OUTPUT}')
if DEST.exists():
    shutil.rmtree(DEST)
shutil.copytree(SOURCE, DEST, ignore=shutil.ignore_patterns('.DS_Store', '._*'))
html = (DEST / 'index.html').read_text()
html = html.replace('</head>', f'<meta name="application-version" content="{RELEASE_VERSION}">\n</head>')
html = html.replace('Интерактивное демо: церковнославянская клавиатура с проверкой, словарём и правилами', 'Церковнославянская клавиатура с проверкой, полным словарём, правилами и практикой')
html = html.replace('<link rel="icon"', '<meta name="theme-color" content="#f5f3ed">\n<meta name="apple-mobile-web-app-capable" content="yes">\n<meta name="apple-mobile-web-app-title" content="ЦСЯ">\n<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">\n<link rel="manifest" href="manifest.webmanifest">\n<link rel="stylesheet" href="pwa.css">\n<link rel="icon"')
html = html.replace('<button class="icon-button" id="themeToggle"', '<button class="quiet pwa-install" id="pwaInstall" hidden>Установить</button><button class="icon-button" id="themeToggle"')
html = html.replace('</body>', '<script src="pwa.js"></script>\n</body>')
(DEST / 'index.html').write_text(html)
manifest = {
    'id': './', 'name': 'Церковнославянский — клавиатура и правописание',
    'short_name': 'ЦСЯ', 'description': 'Клавиатура, правописание, словарь и практика церковнославянского языка.',
    'lang': 'ru', 'dir': 'ltr', 'start_url': './#klaviatura', 'scope': './',
    'display': 'standalone', 'background_color': '#f5f3ed', 'theme_color': '#f5f3ed',
    'icons': [
        {'src': f'icons/icon-{s}.png', 'sizes': f'{s}x{s}', 'type': 'image/png', 'purpose': 'any'} for s in (192,512)
    ] + [
        {'src': f'icons/maskable-{s}.png', 'sizes': f'{s}x{s}', 'type': 'image/png', 'purpose': 'maskable'} for s in (192,512)
    ]
}
(DEST / 'manifest.webmanifest').write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+'\n')
for name in ('pwa.js', 'pwa.css', 'README.md'):
    shutil.copyfile(ROOT / name, DEST / name)
# Include dynamic dictionaries, local fonts, icons and licensing in the same atomic install.
assets = sorted(p.relative_to(DEST).as_posix() for p in DEST.rglob('*') if p.is_file() and p.name not in ('QA.md','README.md','PRACTICE-SOURCES.md'))
hash_input = hashlib.sha256()
for path in assets:
    hash_input.update(path.encode() + b'\0' + (DEST / path).read_bytes() + b'\0')
# The lifecycle template is part of the version too, so a lifecycle fix triggers an update.
template = (ROOT / 'sw-template.js').read_text()
hash_input.update(template.encode())
version = hash_input.hexdigest()[:16]
sw = template.replace('__ASSET_HASH__', version).replace('__PRECACHE__', json.dumps(assets, ensure_ascii=False, indent=2))
(DEST / 'sw.js').write_text(sw)
report = {'version': RELEASE_VERSION, 'cacheVersion': version, 'precache': assets, 'runtimeFiles': len(assets), 'bytes': sum((DEST/p).stat().st_size for p in assets)}
(ROOT / 'build-manifest.json').write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n')
with zipfile.ZipFile(OUTPUT, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for p in sorted(DEST.rglob('*')):
        if p.is_file(): z.write(p, 'slavonic-web/' + p.relative_to(DEST).as_posix())
print(json.dumps({'zip':str(OUTPUT),'cacheVersion':version,'assets':len(assets),'bytes':OUTPUT.stat().st_size}, ensure_ascii=False))
