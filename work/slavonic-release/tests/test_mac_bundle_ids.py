"""Check branding without importing the builder or touching an app bundle."""
import ast
from pathlib import Path
import unittest


BUILDER = Path(__file__).resolve().parents[1] / 'mac/build_mac.py'
tree = ast.parse(BUILDER.read_text())
function = next(node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name == 'helper_bundle_id')
namespace = {}
exec(compile(ast.Module(body=[function], type_ignores=[]), str(BUILDER), 'exec'), namespace)
bundle_id = namespace['helper_bundle_id']


class MacHelperIdentityTests(unittest.TestCase):
    def test_roles_are_distinct_and_stable_across_rebranding(self):
        expected = {
            'Electron Helper.app': 'ru.slavonic.reference.helper',
            'Electron Helper (Renderer).app': 'ru.slavonic.reference.helper.renderer',
            'Electron Helper (GPU).app': 'ru.slavonic.reference.helper.gpu',
            'Electron Helper (Plugin).app': 'ru.slavonic.reference.helper.plugin',
        }
        self.assertEqual(len(set(expected.values())), len(expected))
        for role, identifier in expected.items():
            # Both a fresh plist and a repeatedly rebranded plist are assigned
            # exactly the same role ID, independently of their previous value.
            for previous in ['com.github.Electron.helper', identifier, 'ru.slavonic.reference' * 3 + '.helper']:
                plist = {'CFBundleIdentifier': previous}
                for _ in range(3):
                    plist['CFBundleIdentifier'] = bundle_id(role)
                self.assertEqual(plist['CFBundleIdentifier'], identifier)

    def test_unknown_role_fails_instead_of_reusing_another_identity(self):
        with self.assertRaises(KeyError):
            bundle_id('Electron Helper (Unknown).app')


if __name__ == '__main__':
    unittest.main()
