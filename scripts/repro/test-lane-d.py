import importlib.util
import contextlib
import io
from pathlib import Path
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]


def load(name, file):
    spec = importlib.util.spec_from_file_location(name, ROOT / file)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


supervisor = load('studio_supervise', 'scripts/studio_supervise.py')
sync = load('studio_sync', 'scripts/studio-sync.py')
canary = load('e2e_canary', 'scripts/e2e-canary.py')


class LaneDTests(unittest.TestCase):
    def test_supervisor_restart_delay_doubles_caps_and_resets(self):
        delay = 0
        observed = []
        for _ in range(8):
            delay = supervisor.next_restart_delay(delay, False)
            observed.append(delay)
        self.assertEqual(observed, [2, 4, 8, 16, 32, 60, 60, 60])
        self.assertEqual(supervisor.next_restart_delay(60, True), 2)

    def test_supervisor_child_logs_are_inherited(self):
        import inspect
        source = inspect.getsource(supervisor.supervise)
        self.assertIn('stdout=None, stderr=None', source)
        self.assertNotIn('stdout=subprocess.DEVNULL', source)

    def test_sync_tree_uses_exact_commit_and_excludes_state(self):
        with tempfile.TemporaryDirectory() as temporary:
            repo = Path(temporary)
            subprocess.run(['git', 'init', '-q'], cwd=repo, check=True)
            (repo / 'app.txt').write_text('fictional app')
            (repo / '.secrets').mkdir()
            (repo / '.secrets/private').write_text('not read')
            subprocess.run(['git', 'add', 'app.txt'], cwd=repo, check=True)
            subprocess.run(['git', '-c', 'user.name=Sample', '-c', 'user.email=sample@example.invalid',
                            'commit', '-qm', 'sample'], cwd=repo, check=True)
            old_root = sync.ROOT
            sync.ROOT = repo
            try:
                commit = subprocess.run(['git', 'rev-parse', 'HEAD'], cwd=repo, text=True,
                                         stdout=subprocess.PIPE, check=True).stdout.strip()
                entries = sync.tree(commit)
                self.assertEqual(set(entries), {'app.txt'})
                output = io.StringIO()
                with contextlib.redirect_stdout(output):
                    sync.dry_run(commit, entries)
                self.assertIn('update app.txt', output.getvalue())
                self.assertIn('remove stale tracked files', output.getvalue())
            finally:
                sync.ROOT = old_root

    def test_canary_reports_first_injected_failure(self):
        for failed in canary.SERVER_HOPS:
            calls, lines = [], []
            def check(hop):
                calls.append(hop)
                return hop != failed, 'fictional detail'
            with self.subTest(failed=failed):
                self.assertFalse(canary.run_canary(check, lambda hop: (True, 'probe'), out=lines.append))
                self.assertEqual(calls, list(canary.SERVER_HOPS[:canary.SERVER_HOPS.index(failed) + 1]))
                self.assertEqual(lines[-1], 'FAIL first broken hop: ' + failed)

    def test_canary_never_passes_unrun_conversation_hops(self):
        lines = []
        self.assertTrue(canary.run_canary(lambda hop: (True, 'ok'), lambda hop: (None, 'needs room'), out=lines.append))
        self.assertIn('NOT RUN Discord door — needs room', lines)
        self.assertEqual(lines[-1], 'PASS server path (conversation hops not run)')
        self.assertFalse(any(line.startswith('PASS Discord door') for line in lines))
        lines.clear()
        self.assertFalse(canary.run_canary(lambda hop: (True, 'ok'), lambda hop: (None, 'needs room'),
                                           require_conversation=True, out=lines.append))
        self.assertTrue(lines[-1].startswith('FAIL conversation hops not run'))
        lines.clear()
        self.assertFalse(canary.run_canary(lambda hop: (True, 'ok'), lambda hop: (hop != 'lead reply', 'probe'), out=lines.append))
        self.assertEqual(lines[-1], 'FAIL first broken hop: lead reply')

    def test_canary_hop_errors_are_failures_and_every_server_hop_has_a_probe(self):
        lines = []
        def broken(hop):
            raise OSError('fictional /srv/secret-path')
        self.assertFalse(canary.run_canary(broken, out=lines.append))
        self.assertEqual(lines[0], 'FAIL Switch — OSError')
        for hop in canary.SERVER_HOPS:
            name = 'hop_' + canary.re.sub(r'[^a-z]+', '_', hop.lower()).strip('_')
            self.assertTrue(callable(getattr(canary.Server, name, None)), hop)

if __name__ == '__main__':
    unittest.main()
