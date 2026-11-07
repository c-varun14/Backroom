"""Real local archive/destination regressions for review findings 4 and 5."""
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import stat
import subprocess
import tarfile
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('sync_apply', ROOT / 'scripts/studio-sync-apply.py')
apply = importlib.util.module_from_spec(spec)
spec.loader.exec_module(apply)


def metadata(content, mode='100644'):
    return {'sha256': hashlib.sha256(content).hexdigest(), 'mode': mode}


def archive(files, directories=True):
    stream = io.BytesIO()
    with tarfile.open(fileobj=stream, mode='w') as bundle:
        if directories:
            parents = sorted({str(parent) for name in files for parent in Path(name).parents if str(parent) != '.'})
            for name in parents:
                item = tarfile.TarInfo(name + '/')
                item.type = tarfile.DIRTYPE
                bundle.addfile(item)
        for name, content in files.items():
            item = tarfile.TarInfo(name)
            item.size = len(content)
            bundle.addfile(item, io.BytesIO(content))
    return stream.getvalue()


class SyncReviewTests(unittest.TestCase):
    def test_4_actual_git_archive_directory_entries_are_accepted(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            repo = root / 'repo'
            (repo / 'src/nested').mkdir(parents=True)
            (repo / 'src/nested/app.txt').write_bytes(b'fictional app')
            env = {**os.environ, 'GIT_CONFIG_NOSYSTEM': '1', 'GIT_CONFIG_GLOBAL': '/dev/null',
                   'GIT_AUTHOR_NAME': 'Sample', 'GIT_AUTHOR_EMAIL': 'sample@example.invalid',
                   'GIT_COMMITTER_NAME': 'Sample', 'GIT_COMMITTER_EMAIL': 'sample@example.invalid'}
            def git(*args, input=None):
                return subprocess.run(['git', *args], cwd=repo, env=env, input=input, check=True,
                                      stdout=subprocess.PIPE, stderr=subprocess.PIPE).stdout
            git('init', '-q')
            git('add', '.')
            tree = git('write-tree').decode().strip()
            commit = git('commit-tree', tree, '-m', 'Fictional archive checkpoint').decode().strip()
            data = git('archive', '--format=tar', commit)
            with tarfile.open(fileobj=io.BytesIO(data)) as bundle:
                self.assertTrue(any(member.isdir() for member in bundle.getmembers()))
            target = root / 'destination'
            target.mkdir()
            expected = {'src/nested/app.txt': metadata(b'fictional app')}
            events = []
            def control(action):
                events.append(action)
                if action == 'start': apply.verify(target, expected)
            apply.apply(target, expected, data, root / 'managed.json', control, (os.getuid(), os.getgid()))
            self.assertEqual((target / 'src/nested/app.txt').read_bytes(), b'fictional app')
            self.assertEqual(events, ['stop', 'start'])

    def test_4_links_devices_traversal_and_unknown_directories_stay_refused(self):
        for name, kind in [('../escape', tarfile.REGTYPE), ('/absolute', tarfile.REGTYPE),
                           ('src/link', tarfile.SYMTYPE), ('src/hard', tarfile.LNKTYPE),
                           ('src/device', tarfile.CHRTYPE), ('unrelated/', tarfile.DIRTYPE)]:
            with self.subTest(name=name), tempfile.TemporaryDirectory() as temporary:
                root = Path(temporary)
                target = root / 'target'
                target.mkdir()
                keep = target / 'keep.txt'
                keep.write_bytes(b'fictional keep')
                stream = io.BytesIO()
                with tarfile.open(fileobj=stream, mode='w') as bundle:
                    item = tarfile.TarInfo(name)
                    item.type = kind
                    item.linkname = '/fictional/outside'
                    bundle.addfile(item)
                events = []
                with self.assertRaises(ValueError):
                    apply.apply(target, {'src/app.txt': metadata(b'new')}, stream.getvalue(), root / 'managed.json', events.append, (os.getuid(), os.getgid()))
                self.assertEqual(keep.read_bytes(), b'fictional keep')
                self.assertEqual(events, [])

    def test_5_only_previously_managed_stale_source_is_removed(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            target = root / 'target'
            target.mkdir()
            keep_files = ['.git/config', '.secrets/fictional', '.switch-runtime/fictional',
                          'workspaces/sample/app.txt', '.handoff-contracts/sample.json',
                          'studio-kit/video/node_modules/sample/index.js', 'operator-notes.txt']
            for name in keep_files:
                file = target / name
                file.parent.mkdir(parents=True, exist_ok=True)
                file.write_bytes(b'fictional preserved bytes')
            stale = target / 'stale-source.txt'
            stale.write_bytes(b'old source')
            record = root / 'managed.json'
            record.write_text(json.dumps({'stale-source.txt': metadata(b'old source')}))
            files = {'src/app.txt': b'new source'}
            expected = {name: metadata(data) for name, data in files.items()}
            events = []
            def control(action):
                if action == 'start':
                    apply.verify(target, expected)
                    self.assertFalse(stale.exists())
                events.append(action)
            apply.apply(target, expected, archive(files), record, control, (os.getuid(), os.getgid()))
            self.assertFalse(stale.exists())
            self.assertTrue(all((target / name).exists() for name in keep_files))
            self.assertEqual(json.loads(record.read_text()), expected)
            self.assertEqual(events, ['stop', 'start'])
            # Idempotent second application retains dependencies and unmanaged state.
            apply.apply(target, expected, archive(files), record, events.append, (os.getuid(), os.getgid()))
            self.assertTrue(all((target / name).exists() for name in keep_files))

    def test_5_invalid_destination_is_refused_before_any_deletion_or_service_stop(self):
        for poison in ['file-link', 'parent-link', 'dependency-link', 'parent-file']:
            with self.subTest(poison=poison), tempfile.TemporaryDirectory() as temporary:
                root = Path(temporary)
                target = root / 'target'
                target.mkdir()
                stale = target / 'stale.txt'
                stale.write_bytes(b'old source')
                record = root / 'managed.json'
                record.write_text(json.dumps({'stale.txt': metadata(b'old source')}))
                deps = target / 'studio-kit/video/node_modules'
                deps.mkdir(parents=True)
                dependency = deps / 'sample.js'
                dependency.write_bytes(b'fictional installed dependency')
                if poison == 'file-link':
                    (target / 'src').mkdir()
                    (target / 'src/app.txt').symlink_to(root / 'outside')
                elif poison == 'parent-link':
                    (target / 'src').symlink_to(root)
                elif poison == 'parent-file':
                    (target / 'src').write_bytes(b'not a directory')
                else:
                    deps.rename(deps.with_name('retained-dependencies'))
                    deps.symlink_to(deps.with_name('retained-dependencies'))
                events = []
                with self.assertRaises(ValueError):
                    apply.apply(target, {'src/app.txt': metadata(b'new')}, archive({'src/app.txt': b'new'}), record, events.append, (os.getuid(), os.getgid()))
                self.assertTrue(stale.exists())
                self.assertTrue(dependency.exists())
                self.assertEqual(events, [])

    def test_5_bad_archive_hash_and_missing_member_leave_destination_untouched(self):
        for files in [{'src/app.txt': b'wrong bytes'}, {}]:
            with tempfile.TemporaryDirectory() as temporary:
                root = Path(temporary)
                target = root / 'target'
                target.mkdir()
                keep = target / 'keep.txt'
                keep.write_bytes(b'fictional unchanged')
                events = []
                with self.assertRaises(ValueError):
                    apply.apply(target, {'src/app.txt': metadata(b'expected')}, archive(files), root / 'managed.json', events.append, (os.getuid(), os.getgid()))
                self.assertEqual(keep.read_bytes(), b'fictional unchanged')
                self.assertEqual(events, [])

    def test_5_copy_failure_keeps_consumers_stopped_and_retains_previous_manifest(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            target = root / 'target'
            target.mkdir()
            record = root / 'managed.json'
            record.write_text('{}')
            events = []
            original = apply.shutil.copyfileobj
            def failing(source, output):
                if str(output.name).startswith(str(target)):
                    raise OSError('fictional copy failure')
                return original(source, output)
            with patch.object(apply.shutil, 'copyfileobj', side_effect=failing), self.assertRaises(OSError):
                apply.apply(target, {'app.txt': metadata(b'new')}, archive({'app.txt': b'new'}), record, events.append, (os.getuid(), os.getgid()))
            self.assertEqual(events, ['stop'])
            self.assertEqual(record.read_text(), '{}')

    def test_5_dependency_permission_repair_does_not_mutate_external_hardlink(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            target = root / 'target'
            deps = target / 'studio-kit/video/node_modules'
            deps.mkdir(parents=True)
            outside = root / 'store-file'
            outside.write_bytes(b'fictional shared dependency')
            outside.chmod(0o600)
            os.link(outside, deps / 'installed.js')
            apply.apply(target, {'app.txt': metadata(b'new')}, archive({'app.txt': b'new'}), root / 'managed.json', lambda _: None, (os.getuid(), os.getgid()))
            self.assertEqual(stat.S_IMODE(outside.stat().st_mode), 0o600)
            self.assertTrue((deps / 'installed.js').stat().st_mode & 0o040)
            self.assertNotEqual(outside.stat().st_ino, (deps / 'installed.js').stat().st_ino)

    def test_5_manifest_cannot_authorize_deleting_preserved_or_dependency_files(self):
        for name in ['.git/config', '.secrets/fictional', 'workspaces/sample/app.txt', 'studio-kit/video/node_modules/a.js', '../escape']:
            with self.subTest(name=name), self.assertRaises(ValueError):
                apply.manifest({name: metadata(b'fictional')})

    def test_5_fixed_remote_entry_refuses_wrong_host_before_mutation(self):
        with patch.object(apply.os, 'geteuid', return_value=0), patch.object(apply.socket, 'gethostname', return_value='fictional-wrong-host'), patch.object(apply, 'apply') as mutate:
            with self.assertRaisesRegex(ValueError, 'wrong studio host'): apply.main()
            mutate.assert_not_called()


if __name__ == '__main__':
    unittest.main(verbosity=2)
