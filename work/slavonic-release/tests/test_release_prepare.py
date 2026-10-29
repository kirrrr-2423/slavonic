"""Isolated preparation tests. No runtime, installer or user profile is launched."""
from __future__ import annotations
import copy
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

RELEASE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RELEASE))
from prepare_release import CSP, check_prepared, prepare
from release_config import load_release


class PreparationTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix='slavonic-prepare-test-')
        self.addCleanup(self.temporary.cleanup)
        self.workspace = Path(self.temporary.name)
        self.release = self.workspace / 'work/slavonic-release'
        self.app = self.release / 'app'
        self.source = self.workspace / 'renderer'
        self.app.mkdir(parents=True)
        self.source.mkdir()
        self.config = copy.deepcopy(load_release())
        self.config.update(status='development', publication='unpublished')
        self.config['source'] = 'renderer'
        self.config_path = self.release / 'release.json'
        self.write_config()
        self.native = {
            'main.js': "const options={webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false}};\n",
            'preload.js': "// Kept explicit: expose only trusted clipboard/font IPC.\n",
            'migrate.js': "// Preserve source keys and copy only missing destinations.\n",
            'floating-keyboard.js': '// Native panel launcher remains a desktop source.\n',
        }
        for name, content in self.native.items():
            (self.app / name).write_text(content)
        (self.app / 'package.json').write_text(json.dumps({'name':'slavonic-reference','main':'main.js','version':'0.0.0','engines':{'electron':'0.0.0'},'customField':'preserved'}))
        (self.release / 'desktop.css').write_bytes((RELEASE / 'desktop.css').read_bytes())
        (self.source / 'index.html').write_text('<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>ЦСЯ</title><link rel="stylesheet" href="styles.css"></head><body><script src="data.js"></script><script src="app.js"></script></body></html>')
        (self.source / 'styles.css').write_text(':root { color-scheme: light dark; }\n')
        (self.source / 'data.js').write_text('window.DATA=[];\n')
        (self.source / 'app.js').write_text('// canonical renderer\n')
        (self.source / '.DS_Store').write_bytes(b'ignored')
        (self.source / '._data.js').write_bytes(b'ignored')
        (self.source / 'fonts').mkdir()
        (self.source / 'fonts/font.woff').write_bytes(b'font fixture')

    def write_config(self):
        self.config_path.write_text(json.dumps(self.config))

    def prepare(self):
        return prepare(self.config_path, self.workspace)

    def check(self):
        return check_prepared(self.config_path, self.workspace)

    def snapshot(self):
        return {str(p.relative_to(self.workspace)): (p.read_bytes(),p.stat().st_mtime_ns) for p in self.workspace.rglob('*') if p.is_file()}

    def test_shared_parity_and_desktop_security_are_preserved(self):
        result = self.prepare()
        self.assertEqual(result['version'], self.config['version'])
        self.assertEqual(result['publication'], 'unpublished')
        for name in ('styles.css','app.js','data.js','fonts/font.woff'):
            self.assertEqual((self.app/name).read_bytes(), (self.source/name).read_bytes())
        for name, text in self.native.items():
            self.assertEqual((self.app/name).read_text(),text)
        html = (self.app/'index.html').read_text()
        self.assertIn('content="'+CSP+'"', html)
        self.assertIn('href="desktop.css"',html)
        self.assertLess(html.index('src="migrate.js"'),html.index('src="data.js"'))
        self.assertEqual(html.count('src="migrate.js"'),1)
        self.assertEqual(html.count('Content-Security-Policy'),1)
        self.assertFalse((self.app/'.DS_Store').exists())
        package = json.loads((self.app/'package.json').read_text())
        self.assertEqual(package['version'],self.config['version'])
        self.assertEqual(package['engines']['electron'],self.config['electron'])
        self.assertEqual(package['customField'],'preserved')
        self.assertEqual((self.app/'desktop.css').read_bytes(),(self.release/'desktop.css').read_bytes())
        self.assertEqual(self.check()['check'],'passed')

    def test_preparation_is_idempotent_without_rewriting_files(self):
        self.prepare(); before=self.snapshot(); self.prepare()
        self.assertEqual(before,self.snapshot())

    def test_check_command_is_read_only(self):
        self.prepare(); before=self.snapshot()
        result=subprocess.run([sys.executable,str(RELEASE/'prepare_release.py'),'--check','--config',str(self.config_path),'--workspace',str(self.workspace)],capture_output=True,text=True)
        self.assertEqual(result.returncode,0,result.stderr)
        self.assertEqual(json.loads(result.stdout)['check'],'passed')
        self.assertEqual(before,self.snapshot())

    def test_check_detects_canonical_drift_without_fixing_it(self):
        self.prepare(); (self.source/'app.js').write_text('// changed canonical\n'); before=self.snapshot()
        with self.assertRaisesRegex(ValueError,'canonical renderer'):
            self.check()
        self.assertEqual(before,self.snapshot())

    def test_manifest_detects_changed_desktop_code(self):
        self.prepare(); (self.app/'main.js').write_text('// changed trusted desktop code\n')
        with self.assertRaisesRegex(ValueError,'manifest hashes'):
            self.check()

    def test_config_is_the_single_version_and_runtime_source(self):
        self.prepare(); self.config['version']='3.4.5'; self.config['electron']='46.2.3'; self.write_config()
        with self.assertRaises(ValueError):
            self.check()
        self.prepare()
        package=json.loads((self.app/'package.json').read_text())
        self.assertEqual(package['version'],'3.4.5'); self.assertEqual(package['engines']['electron'],'46.2.3')
        self.assertIn('content="3.4.5"',(self.app/'index.html').read_text())
        self.assertEqual((self.app/'main.js').read_text(),self.native['main.js'])

    def test_only_obsolete_tracked_shared_files_are_removed(self):
        (self.source/'old.js').write_text('// tracked old renderer file\n'); self.prepare()
        (self.source/'old.js').unlink(); (self.app/'extra-native.js').write_text('// keep this file\n')
        self.prepare(); self.assertFalse((self.app/'old.js').exists()); self.assertTrue((self.app/'extra-native.js').exists())

    def test_canonical_collision_cannot_overwrite_desktop_code(self):
        (self.source/'main.js').write_text('// collision\n')
        with self.assertRaisesRegex(ValueError,'collide'):
            self.prepare()
        self.assertEqual((self.app/'main.js').read_text(),self.native['main.js'])

    def test_symlinks_cannot_import_files_outside_canonical_source(self):
        target=self.workspace/'private.txt'; target.write_text('outside fixture data')
        (self.source/'unexpected.txt').symlink_to(target)
        with self.assertRaisesRegex(ValueError,'Symbolic links'):
            self.prepare()

    def test_old_archives_are_not_modified_by_preparation(self):
        output=self.workspace/'outputs'; output.mkdir(); old=output/'Slavonic-1.1.0-All.zip'; old.write_bytes(b'previous release')
        self.prepare(); self.assertEqual(old.read_bytes(),b'previous release')
        self.assertEqual(sorted(p.name for p in output.iterdir()),['Slavonic-1.1.0-All.zip'])

    def test_rejects_invalid_versions_paths_and_publication_states(self):
        for key,value in [('version','1.2'),('electron','bad'),('source','../outside'),('source','/outside'),('publication','published')]:
            with self.subTest(key=key,value=value):
                changed={**self.config,key:value}; self.config_path.write_text(json.dumps(changed))
                with self.assertRaises(ValueError):
                    load_release(self.config_path)
        self.write_config()


if __name__=='__main__':
    unittest.main()
