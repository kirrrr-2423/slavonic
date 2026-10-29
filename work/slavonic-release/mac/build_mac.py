from pathlib import Path
import argparse,hashlib,json,plistlib,shutil,subprocess,sys

def helper_bundle_id(application_name):
 # Derive identity from the role, never from an already branded plist. Reusing
 # a runtime must produce exactly the same IDs as a clean extraction.
 roles = {
  'Electron Helper.app': 'helper',
  'Electron Helper (Renderer).app': 'helper.renderer',
  'Electron Helper (GPU).app': 'helper.gpu',
  'Electron Helper (Plugin).app': 'helper.plugin',
 }
 return 'ru.slavonic.reference.' + roles[application_name]

parser=argparse.ArgumentParser()
parser.add_argument('--reuse-runtime',action='store_true',help='Reuse the previously signed ARM64 runtime to save temporary disk space')
args=parser.parse_args()
R=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(R))
from release_config import load_release
from prepare_release import check_prepared
release_config=load_release()
check_prepared()
OUT=R.parents[1]/'outputs'
ARCH='arm64'
VERSION=release_config['electron']
RELEASE=release_config['version']
assert json.loads((R/'app/package.json').read_text())['version']==RELEASE,'Run prepare_release.py before building'
floating=R.parent/'slavonic-floating-keyboard/build/SlavonicFloatingKeyboard.app'
if not floating.is_dir():
 raise SystemExit('First build work/slavonic-floating-keyboard/build/SlavonicFloatingKeyboard.app')
archive=R/'downloads'/f'electron-v{VERSION}-darwin-{ARCH}.zip'
expected=next(line.split()[0] for line in (R/'downloads/SHASUMS256.txt').read_text().splitlines() if line.split()[-1].lstrip("*")==archive.name)
actual=hashlib.sha256(archive.read_bytes()).hexdigest()
assert actual==expected,'Official runtime checksum mismatch'
print('Runtime SHA-256 verified',flush=True)
stage=R/'build'/'mac-arm64'
stage.mkdir(parents=True,exist_ok=True)
source=stage/'Electron.app'
app=stage/'Церковнославянский язык.app'
if args.reuse_runtime:
 subprocess.run(['codesign','--verify','--deep','--strict',str(app)],check=True)
 prior=json.loads((R/'mac/build-report.json').read_text())
 assert prior['runtimeVersion']==VERSION and prior['runtimeSHA256']==actual,'Cached runtime does not match verified runtime'
else:
 subprocess.run(['ditto','-x','-k',str(archive),str(stage)],check=True)
 if app.exists():shutil.rmtree(app)
 source.rename(app)
contents=app/'Contents';resources=contents/'Resources'
for name in ['default_app.asar']:(resources/name).unlink(missing_ok=True)
if (resources/'app').exists():shutil.rmtree(resources/'app')
shutil.copytree(R/'app',resources/'app',dirs_exist_ok=True,ignore=shutil.ignore_patterns('.DS_Store','._*'))
helpers=contents/'Helpers';helpers.mkdir(exist_ok=True)
if (helpers/floating.name).exists():shutil.rmtree(helpers/floating.name)
shutil.copytree(floating,helpers/floating.name)
(resources/'Electron-LICENSE.txt').write_text((stage/'LICENSE').read_text() if (stage/'LICENSE').exists() else 'See Electron framework LICENSE and LICENSES.chromium.html')
shutil.copy2(stage/'LICENSES.chromium.html', resources/'LICENSES.chromium.html')
# A branded icon from the existing application artwork.
iconset=R/'mac'/'Slavonic.iconset'
if iconset.exists():shutil.rmtree(iconset)
iconset.mkdir()
for size in [16,32,128,256,512]:
 for scale in [1,2]:
  pixels=size*scale
  if pixels>1024:continue
  name=f'icon_{size}x{size}'+('@2x' if scale==2 else '')+'.png'
  subprocess.run(['sips','-z',str(pixels),str(pixels),str(R/'app/icon.png'),'--out',str(iconset/name)],check=True,stdout=subprocess.DEVNULL)
icon=R/'mac/Slavonic.icns'
subprocess.run(['iconutil','-c','icns',str(iconset),'-o',str(icon)],check=True)
shutil.copy2(icon,resources/'Slavonic.icns')
plist_path=contents/'Info.plist'
info=plistlib.loads(plist_path.read_bytes())
old_exec=contents/'MacOS'/info['CFBundleExecutable']
old_exec.rename(contents/'MacOS/Slavonic')
info.update(CFBundleExecutable='Slavonic',CFBundleIdentifier='ru.slavonic.reference',CFBundleName='Церковнославянский язык',CFBundleDisplayName='Церковнославянский язык',CFBundleShortVersionString=RELEASE,CFBundleVersion=RELEASE,CFBundleIconFile='Slavonic.icns',NSHumanReadableCopyright='Церковнославянский язык. Ponomar (OFL), FreeSerif, SCI (MIT).',LSApplicationCategoryType='public.app-category.education')
plist_path.write_bytes(plistlib.dumps(info))
for helper_plist in (contents/'Frameworks').glob('Electron Helper*.app/Contents/Info.plist'):
 p=plistlib.loads(helper_plist.read_bytes())
 p['CFBundleIdentifier']=helper_bundle_id(helper_plist.parents[1].name)
 helper_plist.write_bytes(plistlib.dumps(p))
subprocess.run(['codesign','--force','--deep','--sign','-',str(app)],check=True)
subprocess.run(['codesign','--verify','--deep','--strict','--verbose=2',str(app)],check=True)
report={'version':RELEASE,'architecture':'arm64','runtimeVersion':VERSION,'runtimeSource':f'https://github.com/electron/electron/releases/download/v{VERSION}/{archive.name}','runtimeSHA256':actual,'minimumMacOS':info.get('LSMinimumSystemVersion'),'signing':'ad-hoc','notarized':False,'application':str(app),'floatingKeyboard':str(helpers/floating.name)}
(R/'mac/build-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
# Drag-and-drop disk image. Existing installed programs are never replaced by this build.
image_root=R/'build/mac-image';image_root.mkdir(exist_ok=True)
link=image_root/'Церковнославянский язык.app'
if link.exists():shutil.rmtree(link)
subprocess.run(['ditto',str(app),str(link)],check=True)
applications=image_root/'Applications'
if not applications.exists():applications.symlink_to('/Applications')
(image_root/'Установка.txt').write_text(f'Церковнославянский язык {RELEASE} — Apple Silicon\nТребуется macOS 13 или новее.\n\nПеретащите приложение в Applications.\nДля запуска программы интернет не нужен.\n\nПлавающая клавиатура: откройте раздел «Клавиатура» → «Отделить клавиатуру» (или меню «Вид», ⇧⌘K).\nПеремещайте панель за верхнюю полосу, меняйте размер за угол.\nДля ввода в Word и другие приложения нажмите «Разрешить ввод» и разрешите приложение, указанное в системном запросе, в Системных настройках → Конфиденциальность и безопасность → Универсальный доступ.\nВыберите поле ввода в нужной программе и нажимайте экранные клавиши. В Word выберите шрифт Ponomar.\n«Вернуть в программу» восстанавливает основной редактор с вашим текстом.\n\nДля физической клавиатуры системная раскладка устанавливается отдельно из SlavonicKeyboard-1.0.0.dmg.\n\nЭта локальная сборка подписана ad-hoc, без Apple Developer ID и нотариализации.\nНе удаляйте прежнюю версию до проверки новой. Тексты и настройки находятся в пользовательском профиле.\n')
dmg=OUT/f'Slavonic-{RELEASE}-macOS-AppleSilicon.dmg'
if dmg.exists():dmg.unlink()
subprocess.run(['hdiutil','create','-volname',f'Церковнославянский {RELEASE}','-srcfolder',str(image_root),'-ov','-format','UDZO',str(dmg)],check=True)
subprocess.run(['hdiutil','verify',str(dmg)],check=True)
print(dmg,flush=True)
