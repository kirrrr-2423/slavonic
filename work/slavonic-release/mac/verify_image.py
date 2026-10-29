from pathlib import Path
import hashlib,json,plistlib,subprocess

root=Path(__file__).resolve().parents[1]
workspace=root.parents[1]
mount=root/'build'/'verify-dmg'
mount.mkdir(parents=True,exist_ok=True)
release=json.loads((root/'app/package.json').read_text())['version']
dmg=workspace/f'outputs/Slavonic-{release}-macOS-AppleSilicon.dmg'
subprocess.run(['hdiutil','attach','-readonly','-nobrowse','-mountpoint',str(mount),str(dmg)],check=True,stdout=subprocess.DEVNULL)
try:
    app=mount/'Церковнославянский язык.app'
    resources=app/'Contents/Resources'
    plist=plistlib.loads((app/'Contents/Info.plist').read_bytes())
    assert plist['CFBundleShortVersionString']==release
    assert plist['LSMinimumSystemVersion']=='13.0'
    expected_helpers={
        'Electron Helper.app':'ru.slavonic.reference.helper',
        'Electron Helper (Renderer).app':'ru.slavonic.reference.helper.renderer',
        'Electron Helper (GPU).app':'ru.slavonic.reference.helper.gpu',
        'Electron Helper (Plugin).app':'ru.slavonic.reference.helper.plugin',
    }
    for name,identifier in expected_helpers.items():
        helper_info=plistlib.loads((app/'Contents/Frameworks'/name/'Contents/Info.plist').read_bytes())
        assert helper_info['CFBundleIdentifier']==identifier,(name,helper_info['CFBundleIdentifier'])
    assert subprocess.check_output(['lipo','-archs',str(app/'Contents/MacOS/Slavonic')],text=True).strip()=='arm64'
    subprocess.run(['codesign','--verify','--deep','--strict',str(app)],check=True)
    checked=0
    for source in (root/'app').rglob('*'):
        if source.is_file():
            if source.name=='.DS_Store' or source.name.startswith('._'):continue
            target=resources/'app'/source.relative_to(root/'app')
            assert hashlib.sha256(target.read_bytes()).digest()==hashlib.sha256(source.read_bytes()).digest(),str(source)
            checked+=1
    assert (resources/'LICENSES.chromium.html').stat().st_size>1000000
    assert (resources/'Electron-LICENSE.txt').stat().st_size>500
    assert (mount/'Applications').is_symlink()
    assert 'macOS 13' in (mount/'Установка.txt').read_text()
    helper=app/'Contents/Helpers/SlavonicFloatingKeyboard.app'
    assert subprocess.check_output(['lipo','-archs',str(helper/'Contents/MacOS/SlavonicFloatingKeyboard')],text=True).strip()=='arm64'
    original=workspace/'work/slavonic-floating-keyboard/build/SlavonicFloatingKeyboard.app'
    for relative in ['Contents/MacOS/SlavonicFloatingKeyboard','Contents/Resources/layout.json','Contents/Resources/Ponomar-Regular.otf']:
        assert hashlib.sha256((helper/relative).read_bytes()).digest()==hashlib.sha256((original/relative).read_bytes()).digest(),relative
    subprocess.run([str(helper/'Contents/MacOS/SlavonicFloatingKeyboard'),'--self-test'],check=True)
    report={'version':release,'architecture':'arm64','minimumMacOS':'13.0','mountedReadOnly':True,'signatureIntegrity':'pass','sourceFilesMatched':checked,'chromiumNoticesIncluded':True,'applicationLink':'/Applications','installerInstruction':'pass','floatingKeyboard':'bundled arm64, self-test passed'}
    (root/'mac/image-verification.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report))
finally:
    subprocess.run(['hdiutil','detach',str(mount)],check=True,stdout=subprocess.DEVNULL)
