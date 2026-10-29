#!/usr/bin/env python3
"""Verify NSIS container and every shipped payload hash; does not simulate Windows execution."""
from __future__ import annotations
from collections import Counter
import hashlib
import json
from pathlib import Path
import struct
import subprocess
from build import APP, HERE, ROOT, RELEASE_CONFIG, SEVENZIP, check_prepared, pe_machine
from prepare_release import files as prepared_files

def digest(path: Path) -> str:
    with path.open('rb') as f:
        return hashlib.file_digest(f, 'sha256').hexdigest()

def validate_manifest(manifest: dict, config: dict, app: Path) -> dict:
    """Reject stale or mismatched manifests before touching an installer/tool."""
    if manifest.get('version') != config['version'] or manifest.get('electron') != config['electron']:
        raise ValueError('Windows build manifest belongs to another release or Electron version; build the current sources first')
    current = {name:digest(path) for name,path in prepared_files(app).items()}
    if manifest.get('canonicalApp') != current:
        raise ValueError('Windows build manifest does not match the current prepared application hashes')
    installer = manifest.get('installer',{})
    if installer.get('file') != f'windows-Slavonic-{config["version"]}-Setup.exe':
        raise ValueError('Windows build manifest has an unexpected installer filename')
    delivered = installer.get('deliveredFile')
    if delivered is not None and delivered != f'Slavonic-{config["version"]}-Windows-Setup.exe':
        raise ValueError('Windows build manifest has an unexpected delivered installer filename')
    runtimes = manifest.get('runtime',{})
    if set(runtimes) != {'x64','arm64'}:
        raise ValueError('Windows build manifest must describe both x64 and ARM64 payloads')
    for arch,runtime in runtimes.items():
        payload = runtime.get('files',{})
        if any(payload.get('resources/app/'+name) != sha for name,sha in current.items()):
            raise ValueError(f'Windows {arch} payload does not match the prepared application hashes')
    return current

def main():
    check_prepared()
    manifest = json.loads((HERE / 'build-manifest.json').read_text())
    validate_manifest(manifest, RELEASE_CONFIG, APP)
    setup = ROOT / 'build' / manifest['installer']['file']
    if not setup.is_file() and manifest['installer'].get('deliveredFile'):
        setup = ROOT.parent.parent / 'outputs' / manifest['installer']['deliveredFile']
    assert digest(setup) == manifest['installer']['sha256']
    assert pe_machine(setup) == 0x14c
    with setup.open('rb') as f:
        blob = f.read(1024 * 1024)  # Installer manifest is in the PE resource/header region.
    assert b'level="asInvoker"' in blob or b'level=\'asInvoker\'' in blob
    assert b'level="requireAdministrator"' not in blob
    subprocess.run([str(SEVENZIP), 't', str(setup)], check=True)
    report = {'version':RELEASE_CONFIG['version'], 'electron':RELEASE_CONFIG['electron'],
              'installerSha256': digest(setup), 'peMachine': 'x86 bootstrap',
              'executionLevel': 'asInvoker', 'archiveTest': 'pass'}
    listing = subprocess.check_output([str(SEVENZIP), 'l', '-slt', str(setup)], text=True)
    entries = []
    for block in listing.split('----------\n', 1)[1].strip().split('\n\n'):
        entry = dict(line.split(' = ', 1) for line in block.splitlines() if ' = ' in line)
        if 'Path' in entry and 'Size' in entry and entry.get('Folder') != '+':
            entries.append(entry)
    assert entries
    # 7-Zip emits archive entries in listing order to stdout. Split using exact sizes,
    # hash every byte, and keep only small PE headers. This avoids ~700 MB of duplicate files.
    process = subprocess.Popen([str(SEVENZIP), 'x', '-so', str(setup)], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    seen = Counter()
    headers = {}
    for index, entry in enumerate(entries):
        remaining = int(entry['Size']) if entry['Size'] else None
        assert remaining is not None or index == len(entries)-1, 'Unknown-sized entry must be last'
        hasher = hashlib.sha256()
        header = b''
        while remaining is None or remaining:
            chunk = process.stdout.read(1024 * 1024 if remaining is None else min(1024 * 1024, remaining))
            if not chunk and remaining is None:
                break
            assert chunk, 'Unexpected end of extracted stream'
            if len(header) < 4096:
                header += chunk[:4096 - len(header)]
            hasher.update(chunk)
            if remaining is not None:
                remaining -= len(chunk)
        sha = hasher.hexdigest()
        seen[sha] += 1
        headers[sha] = header
    assert process.stdout.read(1) == b'', 'Unaccounted extracted bytes'
    errors = process.stderr.read().decode(errors='replace')
    assert process.wait() == 0, errors
    expected = set()
    for arch, runtime in manifest['runtime'].items():
        assert runtime['files']['resources/app/main.js'] == manifest['canonicalApp']['main.js']
        expected.update(runtime['files'].values())
        for h in runtime['files'].values():
            assert seen[h] > 0, f'Missing or altered {arch} payload {h}'
        header = headers[runtime['files']['Slavonic.exe']]
        assert header[:2] == b'MZ'
        offset = struct.unpack_from('<I', header, 0x3c)[0]
        assert header[offset:offset+4] == b'PE\0\0'
        assert struct.unpack_from('<H', header, offset+4)[0] == int(runtime['machine'], 16)
        report[arch] = {'payloadFiles': len(runtime['files']), 'allPayloadHashesPresent': True,
                        'executableMachine': runtime['machine']}
    canonical = set(manifest['canonicalApp'].values())
    assert canonical.issubset(seen.keys())
    assert digest(HERE / 'slavonic.ico') in seen
    assert any(entry['Path'].replace('\\', '/').split('/')[-1].lower() == 'uninstall.exe' for entry in entries)
    report.update({'distinctVerifiedPayloadHashes': len(expected), 'extractedFiles': len(entries),
                   'extractionMode': 'streaming; all file bytes hashed without disk duplicates',
                   'canonicalRendererHashesPresent': True, 'uninstallerPresent': True,
                   'liveWindowsExecuted': False})
    (HERE / 'verification.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(report, ensure_ascii=False, indent=2))

if __name__ == '__main__':
    main()
