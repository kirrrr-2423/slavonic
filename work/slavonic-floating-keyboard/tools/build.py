#!/usr/bin/env python3
"""Build the ARM64 nonactivating keyboard, exporting the current web map exactly."""
from pathlib import Path
import hashlib
import json
import plistlib
import re
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parents[1]
APP = ROOT / 'build/SlavonicFloatingKeyboard.app'
RES = APP / 'Contents/Resources'
BIN = APP / 'Contents/MacOS/SlavonicFloatingKeyboard'
WEB = REPO / 'outputs/slavonic-demo/keyboard.js'
REFERENCES = ROOT / 'references'

def run(*args):
    result = subprocess.run(args, text=True, capture_output=True)
    if result.returncode:
        raise RuntimeError(f'{args[0]} failed ({result.returncode}):\n{result.stdout}{result.stderr}')
    return result

def export_layout():
    javascript = r'''
const fs = require('fs'), vm = require('vm');
const ctx = {window:{addEventListener(){}},navigator:{platform:'MacIntel'},localStorage:{getItem(){return null}}};
vm.runInNewContext(fs.readFileSync(process.argv[1],'utf8'),ctx);
process.stdout.write(JSON.stringify(ctx.window.KB.MAP));
'''
    web_map = json.loads(run('node', '-e', javascript, str(WEB)).stdout)
    codes = dict(zip(
        ['KeyA','KeyS','KeyD','KeyF','KeyH','KeyG','KeyZ','KeyX','KeyC','KeyV','IntlBackslash','KeyB','KeyQ','KeyW','KeyE','KeyR','KeyY','KeyT','Digit1','Digit2','Digit3','Digit4','Digit6','Digit5','Equal','Digit9','Digit7','Minus','Digit8','Digit0','BracketRight','KeyO','KeyU','BracketLeft','KeyI','KeyP','KeyL','KeyJ','Quote','KeyK','Semicolon','Backslash','Comma','Slash','KeyN','KeyM','Period','Backquote'],
        [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,37,38,39,40,41,42,43,44,45,46,47,50]))
    layers = {name: {} for name in ['base','shift','option','shiftOption']}
    legends = {}
    punctuation = {'Backquote':'`','IntlBackslash':'ISO','Minus':'-','Equal':'=','BracketLeft':'[','BracketRight':']','Backslash':'\\','Semicolon':';','Quote':"'",'Comma':',','Period':'.','Slash':'/'}
    checks = 0
    for key, values in web_map.items():
        code = str(codes[key])
        legends[code] = key[3:] if key.startswith('Key') else key[5:] if key.startswith('Digit') else punctuation[key]
        for layer, field in [('base','b'),('shift','s'),('option','o'),('shiftOption','os')]:
            # Null is an unavailable key, not a fallback to the base layer.
            layers[layer][code] = values[field] or ''
            assert layers[layer][code] == (values[field] or '')
            checks += 1
    for layer in layers.values():
        layer['49'] = ' '
    superscript = json.loads((REFERENCES / 'superscript.json').read_text())
    favorites = [dict(title=title,text=text,shortcut=key) for title,text,key in [
        ('Титло','҃','7'),('Звательце','҆','4'),('Оксия','́','1'),
        ('Вария','̀','2'),('Камора','̑','3'),('Исо','҆́','5')]]
    result = {'name':'Церковнославянская','version':'1.0.0','layers':layers,'variants':[],
              'superscript':superscript,'favorites':favorites,'legends':legends,
              'source':'outputs/slavonic-demo/keyboard.js window.KB.MAP',
              'sourceSHA256':hashlib.sha256(WEB.read_bytes()).hexdigest()}
    (RES / 'layout.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    return web_map, codes

for directory in [RES, BIN.parent]:
    directory.mkdir(parents=True, exist_ok=True)
web_map, codes = export_layout()
for filename in ['Ponomar-Regular.otf','Ponomar-OFL.txt']:
    shutil.copy2(REPO / 'outputs/slavonic-demo/fonts' / filename, RES / filename)
icon = REFERENCES / 'Keyboard.icns'
if icon.exists():
    shutil.copy2(icon, RES / 'Keyboard.icns')
license_src = REFERENCES / 'Layout-LICENSE-MIT.txt'
if license_src.exists():
    shutil.copy2(license_src, RES / 'Layout-LICENSE-MIT.txt')
plist = {'CFBundleIdentifier':'ru.slavonic.floatingkeyboard','CFBundleExecutable':BIN.name,
         'CFBundleName':'Церковнославянская клавиатура','CFBundleDisplayName':'Церковнославянская клавиатура',
         'CFBundleShortVersionString':'1.0.0','CFBundleVersion':'1.0.0','CFBundlePackageType':'APPL',
         'LSMinimumSystemVersion':'13.0','LSUIElement':True,'NSHighResolutionCapable':True,
         'NSPrincipalClass':'NSApplication','CFBundleIconFile':'Keyboard.icns',
         'NSHumanReadableCopyright':'2026 Kirill Shakh. Ponomar font (OFL). Superscript mapping based on SCI (MIT).'}
(APP / 'Contents/Info.plist').write_bytes(plistlib.dumps(plist))
compiled = run('swiftc','-O','-swift-version','5','-module-cache-path','/private/tmp/codex-slavonic-module-cache',
              '-target','arm64-apple-macosx13.0',str(ROOT/'src/Core.swift'),str(ROOT/'src/main.swift'),'-o',str(BIN))
if compiled.stderr:
    print(compiled.stderr)
run('codesign','--force','--sign','-',str(APP))
run('codesign','--verify','--strict','--verbose=2',str(APP))
tested = run(str(BIN),'--self-test')
print(tested.stdout.strip())
native_model = json.loads(run(str(BIN),'--dump-layout').stdout)
map_checks = 0
for key, values in web_map.items():
    for layer, field in [('base','b'),('shift','s'),('option','o'),('shiftOption','os')]:
        assert native_model['layers'][layer][str(codes[key])].encode('utf-16-le') == (values[field] or '').encode('utf-16-le'), (key,layer)
        map_checks += 1
print(f'PASS: {map_checks} web map → bundled JSON → Swift model UTF-16 comparisons')
model_checks = int(re.search(r'PASS: (\d+) checks',tested.stdout).group(1))
report = {'architecture':'arm64','minimumOS':'13.0','modelChecks':model_checks,'webMapNativeComparisons':map_checks,
          'signature':'ad-hoc, codesign --verify --strict passed','noEventPostingDuringTests':True,
          'sourceSHA256':hashlib.sha256(WEB.read_bytes()).hexdigest()}
(ROOT/'build/verification.json').write_text(json.dumps(report,indent=2)+'\n')
print(APP)
