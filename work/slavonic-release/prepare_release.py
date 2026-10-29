#!/usr/bin/env python3
"""Prepare desktop sources from the canonical renderer; --check never writes files."""
from __future__ import annotations
import argparse
import hashlib
import html
import json
from pathlib import Path
import re
import sys
# --check is also read-only when run before any Python module cache exists.
sys.dont_write_bytecode = True
from release_config import CONFIG_PATH, WORKSPACE_ROOT, load_release, source_directory

CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data:; connect-src 'none'; object-src 'none'; base-uri 'self'; frame-src 'none'"
RESERVED = {'main.js', 'preload.js', 'migrate.js', 'package.json', 'desktop.css', 'floating-keyboard.js', 'icon.png'}
MANIFEST = 'prepare-manifest.json'


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def files(folder: Path) -> dict[str, Path]:
    result = {}
    for path in sorted(folder.rglob('*')):
        relative = path.relative_to(folder)
        if any(part.startswith('.') or part == '__pycache__' for part in relative.parts):
            continue
        if path.is_symlink():
            raise ValueError(f'Symbolic links are not valid release sources: {relative}')
        if path.is_file():
            result[relative.as_posix()] = path
    return result


def desktop_index(source: str, version: str, title: str | None = None) -> str:
    # Keep all canonical scripts/UI. Only these explicit desktop additions differ.
    if not re.search(r'<head\b[^>]*>', source, re.I) or '</head>' not in source or not re.search(r'<script\b', source, re.I):
        raise ValueError('Canonical index.html must contain head and external scripts')
    if re.search(r'http-equiv=[\"\']Content-Security-Policy', source, re.I) or 'src="migrate.js"' in source:
        raise ValueError('Canonical renderer unexpectedly contains desktop-only security or migration tags')
    if title:
        source = re.sub(r'<title>.*?</title>', lambda _m: '<title>' + html.escape(title) + '</title>', source, count=1, flags=re.I | re.S)
    source = re.sub(r'(<head\b[^>]*>)', lambda m: m[1] + f'\n<meta http-equiv="Content-Security-Policy" content="{CSP}">', source, count=1, flags=re.I)
    source = source.replace('</head>', f'<meta name="application-version" content="{version}">\n<link rel="stylesheet" href="desktop.css">\n</head>', 1)
    return re.sub(r'(<script\b)', '<script src="migrate.js"></script>\\1', source, count=1, flags=re.I)


def write_if_changed(path: Path, data: bytes) -> None:
    if not path.is_file() or path.read_bytes() != data:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)


def inputs(config_path: Path, workspace: Path):
    config = load_release(config_path)
    release = config_path.resolve().parent
    app = release / 'app'
    source = source_directory(config, workspace)
    if not source.is_dir() or not (source / 'index.html').is_file():
        raise ValueError(f'Canonical renderer not found: {source}')
    shared = files(source)
    collision = RESERVED.intersection(shared)
    if collision:
        raise ValueError(f'Canonical files collide with desktop sources: {sorted(collision)}')
    for path in (app / 'package.json', app / 'main.js', app / 'preload.js', app / 'migrate.js', release / 'desktop.css'):
        if not path.is_file():
            raise ValueError(f'Required desktop source missing: {path}')
    package = json.loads((app / 'package.json').read_text(encoding='utf-8'))
    package['version'] = config['version']
    package.setdefault('engines', {})['electron'] = config['electron']
    generated = {
        'index.html': desktop_index(shared['index.html'].read_text(encoding='utf-8'), config['version'], package.get('productName')).encode(),
        'package.json': (json.dumps(package, ensure_ascii=False, indent=2) + '\n').encode(),
        'desktop.css': (release / 'desktop.css').read_bytes(),
    }
    return config, release, app, shared, generated


def expected_manifest(config: dict, app: Path, shared: dict[str, Path]) -> dict:
    return {
        'schema': 1, 'release': config,
        'sourceFiles': {name: digest(path.read_bytes()) for name, path in shared.items()},
        'appFiles': {name: digest(path.read_bytes()) for name, path in files(app).items()},
    }


def check_prepared(config_path: Path | str = CONFIG_PATH, workspace: Path | str = WORKSPACE_ROOT) -> dict:
    config_path, workspace = Path(config_path), Path(workspace)
    config, release, app, shared, generated = inputs(config_path, workspace)
    errors = []
    for name, source in shared.items():
        expected = generated.get(name, source.read_bytes())
        target = app / name
        if not target.is_file() or target.read_bytes() != expected:
            errors.append(f'Desktop source differs from canonical renderer: {name}')
    for name, expected in generated.items():
        if not (app / name).is_file() or (app / name).read_bytes() != expected:
            errors.append(f'Generated desktop source is stale: {name}')
    manifest_path = release / MANIFEST
    expected = expected_manifest(config, app, shared)
    if not manifest_path.is_file():
        errors.append('Preparation manifest is missing')
    else:
        try:
            actual = json.loads(manifest_path.read_text(encoding='utf-8'))
            if actual != expected:
                errors.append('Preparation manifest hashes or release configuration are stale')
        except (ValueError, OSError):
            errors.append('Preparation manifest cannot be read')
    if errors:
        raise ValueError('\n'.join(errors))
    return {'version': config['version'], 'status': config['status'], 'publication': config['publication'], 'sharedFiles': len(shared), 'appFiles': len(expected['appFiles']), 'check': 'passed'}


def prepare(config_path: Path | str = CONFIG_PATH, workspace: Path | str = WORKSPACE_ROOT) -> dict:
    config_path, workspace = Path(config_path), Path(workspace)
    config, release, app, shared, generated = inputs(config_path, workspace)
    manifest_path = release / MANIFEST
    previous = {}
    if manifest_path.is_file():
        previous = json.loads(manifest_path.read_text(encoding='utf-8')).get('sourceFiles', {})
        if not isinstance(previous, dict):
            raise ValueError('Preparation manifest has invalid tracked source files')
    # Remove only obsolete files tracked by our previous preparation, never native app sources.
    for name in previous.keys() - shared.keys():
        relative = Path(name)
        if relative.is_absolute() or '..' in relative.parts or name in RESERVED:
            raise ValueError(f'Unsafe tracked source path: {name}')
        (app / relative).unlink(missing_ok=True)
    for name, source in shared.items():
        write_if_changed(app / name, generated.get(name, source.read_bytes()))
    for name, data in generated.items():
        write_if_changed(app / name, data)
    report = expected_manifest(config, app, shared)
    write_if_changed(manifest_path, (json.dumps(report, ensure_ascii=False, indent=2) + '\n').encode())
    return check_prepared(config_path, workspace)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='Read-only parity, version, security and hash check')
    parser.add_argument('--config', type=Path, default=CONFIG_PATH)
    parser.add_argument('--workspace', type=Path, default=WORKSPACE_ROOT)
    args = parser.parse_args()
    try:
        report = (check_prepared if args.check else prepare)(args.config, args.workspace)
    except (OSError, ValueError) as exc:
        parser.exit(1, f'{exc}\n')
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
