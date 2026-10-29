"""Validate manifest/source binding with small fixtures, without an installer or Windows runtime."""
import copy
import hashlib
import importlib.util
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.dont_write_bytecode = True
RELEASE = Path(__file__).resolve().parents[1]


def load_build():
    spec=importlib.util.spec_from_file_location('slavonic_windows_build_fixture',RELEASE/'windows/build.py')
    module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
    return module


build = load_build()
# verify.py uses the Windows-local build module, not a same-named unrelated
# module on a test runner's import path. No build main() executes on import.
with patch.dict(sys.modules, {'build':build}):
    spec=importlib.util.spec_from_file_location('slavonic_windows_verify_fixture',RELEASE/'windows/verify.py')
    verify=importlib.util.module_from_spec(spec);spec.loader.exec_module(verify)


class WindowsManifestTests(unittest.TestCase):
    def setUp(self):
        temp=tempfile.TemporaryDirectory(prefix='slavonic-manifest-test-');self.addCleanup(temp.cleanup)
        self.app=Path(temp.name)
        (self.app/'main.js').write_text('// current native source\n')
        (self.app/'package.json').write_text('{"version":"9.8.7"}')
        self.hashes={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in self.app.iterdir()}
        self.config={'version':'9.8.7','electron':'45.1.0'}
        self.manifest={'version':'9.8.7','electron':'45.1.0','canonicalApp':self.hashes.copy(),
                       'installer':{'file':'windows-Slavonic-9.8.7-Setup.exe','deliveredFile':'Slavonic-9.8.7-Windows-Setup.exe'},
                       'runtime':{arch:{'files':{'resources/app/'+name:sha for name,sha in self.hashes.items()}} for arch in ['x64','arm64']}}

    def validate(self,manifest=None):
        return verify.validate_manifest(manifest or self.manifest,self.config,self.app)

    def test_current_manifest_matches_every_file_and_architecture(self):
        self.assertEqual(self.validate(),self.hashes)

    def test_legacy_release_or_runtime_is_refused(self):
        for key,value in [('version','1.1.0'),('electron','0.0.0')]:
            with self.subTest(key=key):
                manifest=copy.deepcopy(self.manifest);manifest[key]=value
                with self.assertRaisesRegex(ValueError,'another release'):
                    self.validate(manifest)

    def test_changed_missing_and_extra_canonical_hashes_are_refused(self):
        for change in ['changed','missing','extra']:
            with self.subTest(change=change):
                manifest=copy.deepcopy(self.manifest)
                if change=='changed':manifest['canonicalApp']['main.js']='old hash'
                elif change=='missing':del manifest['canonicalApp']['main.js']
                else:manifest['canonicalApp']['old.js']='extra hash'
                with self.assertRaisesRegex(ValueError,'current prepared application hashes'):
                    self.validate(manifest)

    def test_current_app_modification_is_refused_even_with_current_version(self):
        (self.app/'main.js').write_text('// changed since installer build\n')
        with self.assertRaisesRegex(ValueError,'current prepared application hashes'):
            self.validate()

    def test_both_runtime_payloads_must_contain_every_canonical_hash(self):
        for arch in ['x64','arm64']:
            manifest=copy.deepcopy(self.manifest);manifest['runtime'][arch]['files']['resources/app/package.json']='old package'
            with self.assertRaisesRegex(ValueError,'payload does not match'):
                self.validate(manifest)

    def test_missing_architecture_and_path_traversal_names_are_refused(self):
        manifest=copy.deepcopy(self.manifest);del manifest['runtime']['arm64']
        with self.assertRaisesRegex(ValueError,'both x64 and ARM64'):
            self.validate(manifest)
        for key in ['file','deliveredFile']:
            manifest=copy.deepcopy(self.manifest);manifest['installer'][key]='../../outside.exe'
            with self.assertRaisesRegex(ValueError,'unexpected'):
                self.validate(manifest)

    def test_7zip_can_use_a_user_supplied_toolchain(self):
        with patch.dict(os.environ,{'SLAVONIC_7ZZ':'/custom/toolchain/7zz'}):
            self.assertEqual(load_build().SEVENZIP,Path('/custom/toolchain/7zz'))


if __name__=='__main__':
    unittest.main()
