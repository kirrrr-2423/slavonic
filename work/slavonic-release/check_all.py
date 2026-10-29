#!/usr/bin/env python3
"""Run source-quality checks without launching apps, posting input or building installers."""
from __future__ import annotations
import argparse
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys

sys.dont_write_bytecode = True
from prepare_release import check_prepared
from release_config import WORKSPACE_ROOT, load_release, source_directory


def run_checks(*, web: bool = False, workspace: Path = WORKSPACE_ROOT) -> dict:
    workspace = Path(workspace).resolve()
    release = workspace / 'work/slavonic-release'
    config_path = release / 'release.json'
    config = load_release(config_path)
    node = shutil.which('node')
    if not node:
        raise RuntimeError('Node.js is required for JavaScript syntax and behavioral tests')
    env = {**os.environ, 'PYTHONDONTWRITEBYTECODE': '1'}
    commands = []

    def run(label: str, arguments: list[str]) -> None:
        print(label, flush=True)
        subprocess.run(arguments, cwd=workspace, env=env, check=True)
        commands.append(label)

    # Fail before executing tests when staged desktop sources do not match the
    # configured canonical renderer. This check deliberately never prepares it.
    parity = check_prepared(config_path, workspace)
    folders = [source_directory(config, workspace), release / 'app']
    checked = 0
    for folder in folders:
        for filename in sorted(folder.rglob('*.js')):
            if any(part.startswith('.') or part == '__pycache__' for part in filename.relative_to(folder).parts):
                continue
            subprocess.run([node, '--check', str(filename)], cwd=workspace, env=env, check=True)
            checked += 1
    print(f'JavaScript syntax: {checked} canonical/desktop files passed', flush=True)

    language_tests = sorted((workspace / 'work/slavonic-demo/tests').glob('*.test.*'))
    required = {'language-core.test.cjs', 'editor.test.cjs', 'practice.test.cjs'}
    if not required.issubset({p.name for p in language_tests}):
        raise RuntimeError('Required language, editor or practice test suite is missing')
    run('Language, editor and practice behavioral tests', [node, '--test', *map(str, language_tests)])
    run('Read-only practice data validator', [sys.executable, '-B', str(workspace / 'work/slavonic-demo/build_practice.py'), '--check'])
    run('Release Python tests', [sys.executable, '-B', '-m', 'unittest', 'discover', '-s', str(release / 'tests'), '-p', 'test_*.py'])
    run('Floating helper lifecycle and PWA two-window models', [node, '--test', str(release / 'tests/floating-keyboard.test.js'), str(release / 'tests/pwa-update.test.mjs')])
    if web:
        run('Staged PWA source parity, offline assets and lifecycle checks', [node, str(release / 'web/test_web.mjs')])
    return {
        'version': config['version'], 'status': config['status'], 'publication': config['publication'],
        'result': 'passed', 'desktopParity': parity['check'], 'syntaxFiles': checked,
        'suites': commands, 'webStageChecked': web,
        'limits': 'Source and model tests only. No installer build, native UI, Word input or real-browser offline/update check.',
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--web', action='store_true', help='Also verify the separately generated web/slavonic-web stage')
    args = parser.parse_args()
    print(json.dumps(run_checks(web=args.web), ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
