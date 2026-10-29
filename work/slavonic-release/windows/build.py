#!/usr/bin/env python3
"""Build a per-user x64/ARM64 NSIS setup from verified official Electron archives."""
from __future__ import annotations
import hashlib
import json
import os
from pathlib import Path
import shutil
import struct
import subprocess
import sys
import zipfile

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
APP = ROOT / 'app'
sys.path.insert(0, str(ROOT))
from release_config import load_release
from prepare_release import check_prepared, files as prepared_files
RELEASE_CONFIG = load_release()
VERSION = RELEASE_CONFIG['version']
ELECTRON = RELEASE_CONFIG['electron']
SOURCE = f'https://github.com/electron/electron/releases/download/v{ELECTRON}'
PROJECT = ROOT.parent
TOOLS = PROJECT / 'slavonic-keyboard/windows/tools'
NSIS = Path(os.environ.get('SLAVONIC_MAKENSIS', TOOLS / 'makensis/3.13/bin/makensis'))
SEVENZIP = Path(os.environ.get('SLAVONIC_7ZZ', TOOLS / 'sevenzip/26.05/bin/7zz'))

def digest(path: Path) -> str:
    with path.open('rb') as f:
        return hashlib.file_digest(f, 'sha256').hexdigest()

def nquote(value: str) -> str:
    assert '"' not in value and '$' not in value and '\n' not in value
    return '"' + value + '"'

def pe_machine(path: Path) -> int:
    with path.open('rb') as f:
        assert f.read(2) == b'MZ', path
        f.seek(0x3c)
        offset = struct.unpack('<I', f.read(4))[0]
        f.seek(offset)
        assert f.read(4) == b'PE\0\0', path
        return struct.unpack('<H', f.read(2))[0]

def main():
    check_prepared()
    setup = ROOT / f'build/windows-Slavonic-{VERSION}-Setup.exe'
    if setup.exists():
        raise FileExistsError(f'Existing release installer will not be overwritten: {setup}')
    assert (ROOT / 'APP_READY').is_file(), 'Canonical app has not been finalized'
    package = json.loads((APP / 'package.json').read_text())
    assert package['version'] == VERSION
    assert (HERE / 'slavonic.ico').is_file(), 'Create the installer icon first'
    checksums_path = ROOT / 'downloads/windows-SHASUMS256.txt'
    checksums = {name.lstrip('*'): sha for sha, name in
                 (line.split() for line in checksums_path.read_text().splitlines())}
    report = {
        'application': 'Церковнославянский язык', 'version': VERSION,
        'electron': ELECTRON,
        'checksumSource': SOURCE + '/SHASUMS256.txt',
        'checksumFileSha256': digest(checksums_path),
        'runtime': {},
        'canonicalApp': {name: digest(p) for name,p in prepared_files(APP).items()},
        'limits': ['Windows runtime installation and launch have not been executed on this macOS build host.',
                   'Installer has no Authenticode publisher signature.'],
    }
    paths = set()
    dirs = set()
    for arch, machine in [('x64', 0x8664), ('arm64', 0xaa64)]:
        official_name = f'electron-v{ELECTRON}-win32-{arch}.zip'
        archive = ROOT / f'downloads/windows-electron-v{ELECTRON}-{arch}.zip'
        sha = digest(archive)
        assert sha == checksums[official_name], f'SHA-256 mismatch for {arch}'
        dest = ROOT / f'build/windows-{arch}'
        if dest.exists():
            shutil.rmtree(dest)
        with zipfile.ZipFile(archive) as z:
            for item in z.infolist():
                assert not item.filename.startswith('/') and '..' not in Path(item.filename).parts
            assert z.testzip() is None
            z.extractall(dest)
        (dest / 'electron.exe').rename(dest / 'Slavonic.exe')
        if (dest / 'electron_wer.dll').is_file():
            (dest / 'electron_wer.dll').rename(dest / 'Slavonic_wer.dll')
        (dest / 'resources/default_app.asar').unlink(missing_ok=True)
        shutil.copytree(APP, dest / 'resources/app', ignore=shutil.ignore_patterns('.*','__pycache__'))
        assert pe_machine(dest / 'Slavonic.exe') == machine
        assert (dest / 'version').read_text().strip() == ELECTRON
        files = sorted(p for p in dest.rglob('*') if p.is_file())
        file_report = {str(p.relative_to(dest)): digest(p) for p in files}
        report['runtime'][arch] = {
            'sourceUrl': SOURCE + '/' + official_name,
            'archiveSha256': sha, 'archiveBytes': archive.stat().st_size,
            'machine': hex(machine), 'payloadBytes': sum(p.stat().st_size for p in files),
            'files': file_report,
        }
        lines = ['; Generated from exact payload: ' + arch]
        current = None
        for p in files:
            relative = p.relative_to(dest)
            folder = str(relative.parent).replace('/', '\\')
            target = '$INSTDIR' + ('' if folder == '.' else '\\' + folder)
            if target != current:
                lines.append('SetOutPath "' + target + '"')
                current = target
            lines.append('File ' + nquote(str(p)))
            paths.add(str(relative).replace('/', '\\'))
            for parent in relative.parents:
                if str(parent) != '.':
                    dirs.add(str(parent).replace('/', '\\'))
        (HERE / f'payload-{arch}.nsh').write_text('\n'.join(lines) + '\n')
    uninstall = ['; Only explicitly shipped files are removed. User-data profile is never touched.']
    uninstall += ['Delete "$INSTDIR\\' + p + '"' for p in sorted(paths)]
    uninstall += ['RMDir "$INSTDIR\\' + p + '"' for p in sorted(dirs, key=lambda x: (-x.count('\\'), x))]
    (HERE / 'uninstall-files.nsh').write_text('\n'.join(uninstall) + '\n')
    env = os.environ.copy()
    env['NSISDIR'] = str(NSIS.parent.parent / 'share/nsis')
    subprocess.run([str(NSIS), '-WX', '-V3', '-DVERSION=' + VERSION, 'installer.nsi'], cwd=HERE, env=env, check=True)
    setup = ROOT / f'build/windows-Slavonic-{VERSION}-Setup.exe'
    assert pe_machine(setup) == 0x14c  # NSIS bootstrap runs on x64 and ARM64 via Windows compatibility.
    report['installer'] = {'file': setup.name, 'bytes': setup.stat().st_size, 'sha256': digest(setup),
                           'nsis': '3.13', 'scope': 'current-user', 'executionLevel': 'asInvoker'}
    (HERE / 'build-manifest.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'setupBytes': setup.stat().st_size, 'setupSha256': report['installer']['sha256'],
                      'officialRuntimeSha256': {a:r['archiveSha256'] for a,r in report['runtime'].items()}}, indent=2), flush=True)

if __name__ == '__main__':
    main()
