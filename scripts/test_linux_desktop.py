import configparser
import importlib.util
import tempfile
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location('linux_desktop', Path(__file__).with_name('render_linux_desktop.py'))
desktop = importlib.util.module_from_spec(spec)
spec.loader.exec_module(desktop)
REPO = Path(__file__).resolve().parents[1]


class LinuxDesktopTests(unittest.TestCase):
    def setUp(self):
        self.source = (REPO/'build/linux/desktop').read_text(encoding='utf-8')

    def test_installed_entry_preserves_all_advertised_actions_and_arguments(self):
        output = desktop.render_desktop(self.source, '/usr/local/bin/zhusuan')
        self.assertIn('Name=珠算', output)
        self.assertIn('Exec=/usr/local/bin/zhusuan %u', output)
        self.assertIn('Actions=quick-receipt;new-project;calendar;', output)
        for action in ['quick-receipt', 'new-project', 'calendar']:
            self.assertIn(f'[Desktop Action {action}]', output)
            self.assertIn(f'Exec=/usr/local/bin/zhusuan --action={action}', output)
        before = configparser.ConfigParser(interpolation=None)
        after = configparser.ConfigParser(interpolation=None)
        before.read_string(self.source)
        after.read_string(output)
        self.assertEqual({name: dict(before[name]) for name in before.sections()},
                         {name: dict(after[name]) for name in after.sections()})

    def test_appimage_entry_uses_bundled_binary_name_for_main_and_actions(self):
        output = desktop.render_desktop(self.source, 'zhusuan')
        self.assertIn('Exec=zhusuan %u', output)
        self.assertNotIn('Exec=/usr/local/bin/', output)
        for action in ['quick-receipt', 'new-project', 'calendar']:
            self.assertIn(f'Exec=zhusuan --action={action}', output)
        self.assertIn('StartupWMClass=zhusuan', output)
        self.assertIn('Icon=zhusuan', output)

    def test_native_desktop_entry_has_no_whitespace_only_or_trailing_lines(self):
        source = self.source.replace('Exec=/usr/local/bin/zhusuan %u',
                                     'Exec=/usr/local/bin/zhusuan %u \t') + ' \t \n'
        for executable in ['/usr/local/bin/zhusuan', 'zhusuan']:
            with self.subTest(executable=executable):
                output = desktop.render_desktop(source, executable)
                self.assertTrue(output.endswith('\n'))
                self.assertTrue(all(not line or not line.isspace() for line in output.splitlines()),
                                'desktop-file-validate rejects a line containing only spaces')
                self.assertTrue(all(not line.endswith((' ', '\t')) for line in output.splitlines()))
                self.assertIn(f'Exec={executable} %u\n', output)
                self.assertIn('Actions=quick-receipt;new-project;calendar;', output)

    def test_rejects_a_declared_action_without_an_executable(self):
        source = self.source.replace('Exec=/usr/local/bin/zhusuan --action=calendar', '')
        with self.assertRaisesRegex(ValueError, 'Desktop Action calendar'):
            desktop.render_desktop(source, 'zhusuan')

    def test_rejects_a_missing_main_entry_and_unsafe_executable_names(self):
        with self.assertRaisesRegex(ValueError, 'Desktop Entry'):
            desktop.render_desktop('[Other]\nName=fixture\n', 'zhusuan')
        for executable in ['', 'zhusuan --other', 'zhusuan\nExec=other', 'zhusuan%u', '../zhusuan']:
            with self.subTest(executable=executable), self.assertRaises(ValueError):
                desktop.render_desktop(self.source, executable)

    def test_failed_render_does_not_replace_an_existing_output_or_source(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            source, output = root/'source', root/'output.desktop'
            source.write_text('[Desktop Entry]\nName=fixture\n', encoding='utf-8')
            output.write_text('previous output', encoding='utf-8')
            with self.assertRaises(ValueError):
                desktop.write_desktop(source, output, 'zhusuan')
            self.assertEqual(output.read_text(), 'previous output')
            self.assertEqual(source.read_text(), '[Desktop Entry]\nName=fixture\n')


if __name__ == '__main__':
    unittest.main()
