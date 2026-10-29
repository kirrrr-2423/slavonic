"""Shared source of release versions and canonical renderer location."""
from __future__ import annotations
import json
from pathlib import Path
import re

RELEASE_ROOT = Path(__file__).resolve().parent
WORKSPACE_ROOT = RELEASE_ROOT.parents[1]
CONFIG_PATH = RELEASE_ROOT / 'release.json'


def load_release(config_path: Path | str | None = None) -> dict:
    path = Path(config_path) if config_path is not None else CONFIG_PATH
    data = json.loads(path.read_text(encoding='utf-8'))
    if not isinstance(data, dict) or data.get('schema') != 1:
        raise ValueError('release.json: unsupported schema')
    for key in ('version', 'electron'):
        if not isinstance(data.get(key), str) or not re.fullmatch(r'\d+\.\d+\.\d+', data[key]):
            raise ValueError(f'release.json: {key} must use major.minor.patch')
    if data.get('status') not in ('development', 'candidate', 'released'):
        raise ValueError('release.json: invalid status')
    if data.get('publication') not in ('unpublished', 'published'):
        raise ValueError('release.json: invalid publication state')
    value = data.get('source')
    if not isinstance(value, str) or not value or Path(value).is_absolute() or '..' in Path(value).parts or '\\' in value:
        raise ValueError('release.json: source must stay inside the workspace')
    if data['status'] == 'development' and data['publication'] != 'unpublished':
        raise ValueError('A development release cannot be marked published')
    return data


def source_directory(config: dict | None = None, workspace: Path | str | None = None) -> Path:
    data = config if config is not None else load_release()
    root = Path(workspace) if workspace is not None else WORKSPACE_ROOT
    source = (root / data['source']).resolve()
    if not source.is_relative_to(root.resolve()):
        raise ValueError('Canonical source resolves outside the workspace')
    return source
