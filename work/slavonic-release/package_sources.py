#!/usr/bin/env python3
"""Package current reviewable sources, with hashes and no runtimes or historical build reports."""
from __future__ import annotations
import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
import sys
import zipfile

sys.dont_write_bytecode = True
from prepare_release import check_prepared
from release_config import WORKSPACE_ROOT, load_release, source_directory

PREFIX = 'slavonic-source/'
RELEASE_FILES = (
    'release.json', 'release_config.py', 'prepare_release.py', 'prepare-manifest.json',
    'desktop.css', 'APP_READY', 'check_all.py', 'package_sources.py', 'quality.yml', 'README-SOURCE.md',
)
MAC_FILES = ('build_mac.py', 'verify_image.py')
WINDOWS_FILES = ('build.py', 'verify.py', 'installer.nsi', 'slavonic.ico')
WEB_FILES = ('build_web.py', 'test_web.mjs', 'pwa.js', 'pwa.css', 'sw-template.js', 'README.md')
NATIVE_FILES = ('README.md', 'src/main.swift', 'src/Core.swift', 'tools/build.py',
                'references/superscript.json', 'references/Keyboard.icns', 'references/Layout-LICENSE-MIT.txt')
CHECKSUM_FILES = ('SHASUMS256.txt', 'windows-SHASUMS256.txt')
PRACTICE_FILES = ('build_practice.py', 'lessons-1-3.json', 'lessons-4-9.json', 'lessons-10-18.json', 'smirnova-lessons.json')
SOURCE_SUFFIXES = {'.js', '.cjs', '.mjs', '.css', '.html', '.json', '.md', '.txt', '.py', '.swift', '.nsi',
                   '.otf', '.ttf', '.woff', '.woff2', '.png', '.svg', '.ico', '.icns', '.webmanifest'}
IGNORED_PARTS = {'__pycache__'}
GENERATED_PARTS = {'node_modules', 'build', 'downloads', 'slavonic-web', 'venv'}


def source_files(workspace: Path | str = WORKSPACE_ROOT) -> dict[str, Path]:
    """Return an explicit archive-path -> source-file map; never scan the workspace broadly."""
    workspace = Path(workspace).resolve()
    release = workspace / 'work/slavonic-release'
    config = load_release(release / 'release.json')
    selected = {}

    def add(path: Path, target: str | None = None) -> None:
        if path.is_symlink():
            raise ValueError(f'Symbolic links cannot enter the source archive: {path.relative_to(workspace)}')
        if not path.is_file():
            raise ValueError(f'Required source is missing: {path.relative_to(workspace)}')
        if not path.resolve().is_relative_to(workspace):
            raise ValueError('Source resolves outside the workspace')
        name = target or path.relative_to(workspace).as_posix()
        relative = PurePosixPath(name)
        if relative.is_absolute() or '..' in relative.parts or '\\' in name:
            raise ValueError(f'Unsafe archive path: {name}')
        if name in selected:
            raise ValueError(f'Duplicate archive path: {name}')
        selected[name] = path

    def tree(folder: Path) -> None:
        if not folder.is_dir() or folder.is_symlink():
            raise ValueError(f'Required source directory is missing or linked: {folder.relative_to(workspace)}')
        for path in sorted(folder.rglob('*')):
            relative = path.relative_to(folder)
            if any(part.startswith('.') or part in IGNORED_PARTS for part in relative.parts):
                continue
            if any(part in GENERATED_PARTS for part in relative.parts):
                raise ValueError(f'Generated directory inside source tree: {path.relative_to(workspace)}')
            if path.is_symlink():
                raise ValueError(f'Symbolic links cannot enter the source archive: {path.relative_to(workspace)}')
            if path.is_file():
                if path.suffix.lower() not in SOURCE_SUFFIXES:
                    raise ValueError(f'Unexpected binary or unsupported source resource: {path.relative_to(workspace)}')
                add(path)

    tree(source_directory(config, workspace))
    tree(release / 'app')
    tree(workspace / 'work/slavonic-demo/tests')
    tree(release / 'tests')
    for name in RELEASE_FILES:
        add(release / name)
    for directory, names in [('mac', MAC_FILES), ('windows', WINDOWS_FILES), ('web', WEB_FILES)]:
        for name in names:
            add(release / directory / name)
    for name in NATIVE_FILES:
        add(workspace / 'work/slavonic-floating-keyboard' / name)
    # Only these official text checksums enter downloads/. Archives, tools and
    # past download/build reports are deliberately outside the source allowlist.
    for name in CHECKSUM_FILES:
        add(release / 'downloads' / name)
    for name in PRACTICE_FILES:
        add(workspace / 'work/slavonic-demo' / name)
    # The checked-in template remains reviewable beside the packager and is also
    # placed where GitHub discovers it after the source tree is extracted.
    add(release / 'quality.yml', '.github/workflows/quality.yml')
    add(release / 'README-SOURCE.md', 'README.md')
    return dict(sorted(selected.items()))


def package_sources(workspace: Path | str = WORKSPACE_ROOT, output: Path | str | None = None) -> dict:
    workspace = Path(workspace).resolve()
    release = workspace / 'work/slavonic-release'
    config_path = release / 'release.json'
    config = load_release(config_path)
    output = Path(output) if output is not None else workspace / f'outputs/Slavonic-{config["version"]}-source.zip'
    output = output.resolve()
    if output.exists():
        raise FileExistsError(f'Existing source archive will not be overwritten: {output}')
    check_prepared(config_path, workspace)
    selected = source_files(workspace)
    payload = {name: path.read_bytes() for name, path in selected.items()}
    check_prepared(config_path, workspace)
    if load_release(config_path) != config or any(path.read_bytes() != payload[name] for name, path in selected.items()):
        raise ValueError('Sources changed during packaging; retry after integration is finished')
    manifest = {
        'schema': 1, 'release': config, 'kind': 'source-only',
        'files': {name: {'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()} for name, data in payload.items()},
        'limits': 'Source archive only; no runtime, installer, build result or claim of native/browser manual QA.',
    }
    payload['SOURCE-MANIFEST.json'] = (json.dumps(manifest, ensure_ascii=False, indent=2) + '\n').encode()
    output.parent.mkdir(parents=True, exist_ok=True)
    created = False
    try:
        # Exclusive creation also protects against another packager starting
        # between the earlier existence check and this write.
        with output.open('xb') as handle:
            created = True
            with zipfile.ZipFile(handle, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
                for name, data in sorted(payload.items()):
                    info = zipfile.ZipInfo(PREFIX + name, date_time=(1980, 1, 1, 0, 0, 0))
                    info.compress_type = zipfile.ZIP_DEFLATED
                    info.external_attr = 0o100644 << 16
                    archive.writestr(info, data, compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)
        with zipfile.ZipFile(output) as archive:
            if archive.testzip() is not None or len(archive.namelist()) != len(payload):
                raise ValueError('Source archive failed CRC/count verification')
            for name, data in payload.items():
                if archive.read(PREFIX + name) != data:
                    raise ValueError(f'Source archive payload mismatch: {name}')
    except BaseException:
        if created:
            output.unlink(missing_ok=True)
        raise
    with output.open('rb') as handle:
        archive_sha = hashlib.file_digest(handle, 'sha256').hexdigest()
    return {
        'version': config['version'], 'status': config['status'], 'publication': config['publication'],
        'archive': str(output), 'sourceFiles': len(selected), 'archiveEntries': len(payload),
        'bytes': output.stat().st_size, 'sha256': archive_sha,
        'checks': 'Prepared source parity, source snapshot, ZIP CRC/count and every payload byte matched',
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, help='Optional new archive path; existing files are never overwritten')
    args = parser.parse_args()
    print(json.dumps(package_sources(output=args.output), ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
