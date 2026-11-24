import os
from pathlib import Path
import shutil
import subprocess
import unittest


ROOT = Path(__file__).resolve().parents[1]


class PlatformPackagingTests(unittest.TestCase):
    def test_msix_task_uses_existing_wails_config_and_executable_name(self):
        taskfile = (ROOT / 'build/windows/Taskfile.yml').read_text(encoding='utf-8')
        task_start = taskfile.index('  create:msix:package:')
        task_end = taskfile.index('\n  install:msix:tools:', task_start)
        task = taskfile[task_start:task_end]

        self.assertIn('--config "{{.ROOT_DIR}}/build/config.yml"', task)
        self.assertIn('--name "{{.APP_NAME}}.exe"', task)
        self.assertTrue((ROOT / 'build/config.yml').is_file())
        self.assertNotIn('wails.json', task)

    @unittest.skipUnless(shutil.which('docker'), 'Docker Compose CLI is required')
    def test_default_sqlite_service_config_does_not_require_database_profile_passwords(self):
        env = {
            key: value
            for key, value in os.environ.items()
            if key not in {'DB_PASSWORD', 'MYSQL_ROOT_PASSWORD', 'JWT_SECRET'}
        }
        env['JWT_SECRET'] = 'isolated-compose-config-test-secret'
        result = subprocess.run(
            ['docker', 'compose', '--env-file', os.devnull, 'config', '--quiet', 'app'],
            cwd=ROOT,
            env=env,
            capture_output=True,
            text=True,
            timeout=20,
        )

        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)


if __name__ == '__main__':
    unittest.main()
