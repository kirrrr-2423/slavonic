"""Isolated source-archive tests; no real release artifact is created or overwritten."""
from __future__ import annotations
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import shutil
import subprocess
import sys
import tempfile
import unittest
import zipfile

sys.dont_write_bytecode = True
RELEASE = Path(__file__).resolve().parents[1]
WORKSPACE = RELEASE.parents[1]
sys.path.insert(0, str(RELEASE))
from package_sources import CHECKSUM_FILES, MAC_FILES, NATIVE_FILES, PRACTICE_FILES, PREFIX, RELEASE_FILES, WEB_FILES, WINDOWS_FILES, package_sources, source_files
from prepare_release import prepare
from release_config import load_release


class SourcePackageTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory(prefix='slavonic-package-test-')
        self.addCleanup(temporary.cleanup)
        self.workspace = Path(temporary.name)
        self.release = self.workspace / 'work/slavonic-release'
        self.release.mkdir(parents=True)
        self.config = load_release()
        self.config.update(status='development', publication='unpublished')
        self.config['version'] = '9.8.7'
        self.config['source'] = 'outputs/slavonic-demo'
        self.source = self.workspace / self.config['source']
        self.source.mkdir(parents=True)
        self.app = self.release / 'app'
        self.app.mkdir()
        for name in RELEASE_FILES:
            if name in {'prepare-manifest.json', 'release.json'}:
                continue
            self.copy(RELEASE / name, self.release / name)
        (self.release / 'release.json').write_text(json.dumps(self.config))
        (self.release / 'README-SOURCE.md').write_text('Source fixture. No installer or manual QA claims.\n')
        for directory, names in [('mac',MAC_FILES),('windows',WINDOWS_FILES),('web',WEB_FILES)]:
            for name in names:
                self.copy(RELEASE / directory / name, self.release / directory / name)
        for name in NATIVE_FILES:
            self.copy(WORKSPACE / 'work/slavonic-floating-keyboard' / name, self.workspace / 'work/slavonic-floating-keyboard' / name)
        for name in CHECKSUM_FILES:
            self.copy(RELEASE / 'downloads' / name, self.release / 'downloads' / name)
        for name in PRACTICE_FILES:
            self.copy(WORKSPACE / 'work/slavonic-demo' / name, self.workspace / 'work/slavonic-demo' / name)
        for name in ['main.js','preload.js','migrate.js','floating-keyboard.js']:
            (self.app / name).write_text('// isolated desktop fixture\n')
        (self.app / 'package.json').write_text(json.dumps({'name':'slavonic-reference','main':'main.js','version':'0.0.0'}))
        (self.app / 'icon.png').write_bytes(b'icon fixture')
        (self.source / 'index.html').write_text('<html><head><link rel="stylesheet" href="styles.css"></head><body><script src="app.js"></script></body></html>')
        (self.source / 'app.js').write_text('// canonical source fixture\n')
        (self.source / 'styles.css').write_text('body { color: black; }\n')
        (self.source / 'fonts').mkdir()
        (self.source / 'fonts/Ponomar-Regular.otf').write_bytes(b'font resource fixture')
        tests = self.workspace / 'work/slavonic-demo/tests'
        tests.mkdir(parents=True)
        for name in ['language-core.test.cjs','editor.test.cjs','practice.test.cjs']:
            (tests / name).write_text('// behavioral test fixture\n')
        (self.release / 'tests').mkdir()
        (self.release / 'tests/test_fixture.py').write_text('# isolated fixture test\n')
        prepare(self.release / 'release.json', self.workspace)
        self.output = self.workspace / 'outputs/Slavonic-9.8.7-source.zip'

    @staticmethod
    def copy(source, target):
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, target)

    def create(self, output=None):
        return package_sources(self.workspace, output)

    def test_complete_safe_paths_and_every_payload_hash(self):
        report = self.create()
        self.assertEqual(report['version'],'9.8.7')
        self.assertEqual(report['publication'],'unpublished')
        with zipfile.ZipFile(self.output) as archive:
            names = archive.namelist()
            self.assertIsNone(archive.testzip())
            self.assertEqual(len(names),len(set(names)))
            for name in names:
                self.assertTrue(name.startswith(PREFIX))
                self.assertFalse(PurePosixPath(name).is_absolute())
                self.assertNotIn('..',PurePosixPath(name).parts)
                self.assertNotIn('\\',name)
            for expected in [
                'outputs/slavonic-demo/app.js', 'outputs/slavonic-demo/fonts/Ponomar-Regular.otf',
                'work/slavonic-demo/tests/practice.test.cjs', 'work/slavonic-release/app/desktop.css',
                'work/slavonic-release/release.json','work/slavonic-release/release_config.py',
                'work/slavonic-release/prepare_release.py','work/slavonic-release/prepare-manifest.json',
                'work/slavonic-release/mac/build_mac.py','work/slavonic-release/windows/installer.nsi',
                'work/slavonic-release/web/sw-template.js','work/slavonic-floating-keyboard/src/main.swift',
                'work/slavonic-release/downloads/SHASUMS256.txt','work/slavonic-release/downloads/windows-SHASUMS256.txt',
                'work/slavonic-demo/build_practice.py','work/slavonic-demo/lessons-1-3.json',
                'work/slavonic-floating-keyboard/references/superscript.json','.github/workflows/quality.yml','README.md',
            ]:
                self.assertIn(PREFIX+expected,names)
            manifest = json.loads(archive.read(PREFIX+'SOURCE-MANIFEST.json'))
            self.assertEqual(manifest['release'],self.config)
            self.assertEqual(manifest['kind'],'source-only')
            self.assertEqual(len(manifest['files']),report['sourceFiles'])
            for name,info in manifest['files'].items():
                data = archive.read(PREFIX+name)
                self.assertEqual(len(data),info['bytes'])
                self.assertEqual(hashlib.sha256(data).hexdigest(),info['sha256'])
            self.assertEqual(archive.read(PREFIX+'.github/workflows/quality.yml'),(self.release/'quality.yml').read_bytes())

    def test_generated_binaries_metadata_historical_reports_and_old_archives_are_excluded(self):
        ignored = {
            'work/slavonic-release/build/old.exe': b'executable',
            'work/slavonic-release/downloads/runtime.zip': b'runtime',
            'work/slavonic-release/web/slavonic-web/index.html': b'old stage',
            'work/slavonic-release/mac/build-report.json': b'old build result',
            'work/slavonic-release/windows/verification.json': b'old installer result',
            'work/slavonic-release/publish-tree-request.json': b'old publication request',
            'outputs/Slavonic-1.1.0-All.zip': b'previous archive',
            'outputs/slavonic-demo/.DS_Store': b'metadata',
            'outputs/slavonic-demo/._app.js': b'AppleDouble',
            'work/slavonic-release/app/__pycache__/test.pyc': b'bytecode',
        }
        for name,data in ignored.items():
            target = self.workspace/name; target.parent.mkdir(parents=True,exist_ok=True); target.write_bytes(data)
        self.create()
        with zipfile.ZipFile(self.output) as archive:
            for name in ignored:
                self.assertNotIn(PREFIX+name,archive.namelist())
        for name,data in ignored.items():
            self.assertEqual((self.workspace/name).read_bytes(),data)

    def test_existing_archive_is_never_overwritten(self):
        self.output.write_bytes(b'previous source archive')
        with self.assertRaises(FileExistsError):
            self.create()
        self.assertEqual(self.output.read_bytes(),b'previous source archive')

    def test_stale_canonical_sources_cannot_be_packaged(self):
        (self.source/'app.js').write_text('// changed after preparation\n')
        with self.assertRaisesRegex(ValueError,'canonical renderer'):
            self.create()
        self.assertFalse(self.output.exists())

    def test_unexpected_binary_inside_selected_sources_is_refused(self):
        (self.app/'untracked.exe').write_bytes(b'untracked executable')
        prepare(self.release/'release.json',self.workspace)
        with self.assertRaisesRegex(ValueError,'Unexpected binary'):
            self.create()
        self.assertFalse(self.output.exists())

    def test_symlink_cannot_leak_an_outside_file(self):
        outside = self.workspace/'private.txt'; outside.write_text('not an application source')
        (self.source/'leak.txt').symlink_to(outside)
        with self.assertRaisesRegex(ValueError,'Symbolic links'):
            self.create()
        self.assertFalse(self.output.exists())

    def test_archive_is_deterministic_for_the_same_snapshot(self):
        self.create()
        second = self.workspace/'outputs/second-source.zip'
        self.create(second)
        self.assertEqual(self.output.read_bytes(),second.read_bytes())

    def test_importing_packaging_and_checks_does_not_run_them(self):
        before = {str(p.relative_to(self.workspace)):p.read_bytes() for p in self.workspace.rglob('*') if p.is_file()}
        command = 'import sys; sys.path.insert(0,sys.argv[1]); import package_sources, check_all; print("import only")'
        result = subprocess.run([sys.executable,'-B','-c',command,str(RELEASE)],cwd=self.workspace,env={**os.environ,'PYTHONDONTWRITEBYTECODE':'1'},capture_output=True,text=True)
        self.assertEqual(result.returncode,0,result.stderr)
        self.assertEqual(result.stdout.strip(),'import only')
        after = {str(p.relative_to(self.workspace)):p.read_bytes() for p in self.workspace.rglob('*') if p.is_file()}
        self.assertEqual(before,after)

    def test_ci_template_runs_only_source_and_staged_web_checks(self):
        workflow = (RELEASE/'quality.yml').read_text()
        self.assertIn('permissions:\n  contents: read',workflow)
        self.assertIn('prepare_release.py',workflow)
        self.assertIn('web/build_web.py',workflow)
        self.assertIn('check_all.py --web',workflow)
        self.assertNotIn('build_mac.py',workflow)
        self.assertNotIn('windows/build.py',workflow)
        self.assertNotIn('gh release',workflow)


if __name__=='__main__':
    unittest.main()
