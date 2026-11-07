"""Real malicious repositories; all credentials and data are fictional."""
import importlib.util
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
BOUNDARY = ROOT / 'scripts/shadow_git.py'
spec = importlib.util.spec_from_file_location('shadow_git', BOUNDARY)
shadow = importlib.util.module_from_spec(spec)
spec.loader.exec_module(shadow)


class ShadowTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix='backroom-git-attack-')
        self.root = Path(self.tmp.name)
        self.repo = self.root / 'workspace'
        self.repo.mkdir()
        self.home = self.root / 'home'
        self.home.mkdir(mode=0o700)
        self.env = {**os.environ, 'HOME':str(self.home), 'GIT_CONFIG_NOSYSTEM':'1', 'GIT_CONFIG_GLOBAL':'/dev/null', 'GIT_NO_REPLACE_OBJECTS':'1'}
        self.git('init','-q','--template=')
        (self.repo / 'source.txt').write_text('approved source\n')
        (self.repo / 'pnpm-lock.yaml').write_text('approved dependencies\n')
        (self.repo / '.env.required').write_text('SAMPLE_TOKEN\n')
        (self.repo / '.gitattributes').write_text('source.txt filter=attack\n')
        self.git('add','.')
        self.git('-c','user.name=Sample','-c','user.email=sample@example.invalid','-c','commit.gpgsign=false','commit','-qm','Approved fictional sample')
        self.approved = self.git('rev-parse','HEAD').stdout.strip()
        (self.repo / 'source.txt').write_text('unreviewed source\n')
        (self.repo / '.env.required').write_text('ATTACKER_KEY\n')
        self.git('add','.')
        self.git('-c','user.name=Sample','-c','user.email=sample@example.invalid','-c','commit.gpgsign=false','commit','-qm','Unreviewed fictional sample')
        self.bad = self.git('rev-parse','HEAD').stdout.strip()
        self.git('reset','--hard',self.approved)
        self.marker = self.root / 'ATTACK_EXECUTED'
        attack = self.root / 'attack.sh'
        attack.write_text('#!/bin/sh\ntouch '+str(self.marker)+'\ncat\n')
        attack.chmod(0o700)
        with (self.repo / '.git/config').open('a') as out:
            out.write(f'\n[core]\n fsmonitor = {attack}\n[filter "attack"]\n clean = {attack}\n required = true\n[credential]\n helper = !{attack}\n[alias]\n trap = !{attack}\n[diff]\n external = {attack}\n')
        self.attack = attack
        self.run_boundary('rev-parse','HEAD')

    def tearDown(self): self.tmp.cleanup()

    def git(self,*args):
        return subprocess.run(['git','-C',str(self.repo),*args],env=self.env,capture_output=True,text=True,check=True)

    def run_boundary(self,*args,check=True,input=None):
        return subprocess.run(['python3',str(BOUNDARY),str(self.repo),*args],env=self.env,capture_output=True,text=True,check=check,input=input)

    def test_fsmonitor_clean_filter_credential_helper_and_hooks_execute_nothing(self):
        hooks = self.repo / '.git/hooks'
        hooks.mkdir(exist_ok=True)
        (hooks / 'post-index-change').symlink_to(self.attack)
        self.assertEqual(self.run_boundary('status','--porcelain').stdout,'')
        self.assertEqual(self.run_boundary('show',self.approved+':source.txt').stdout,'approved source\n')
        self.run_boundary('diff',self.approved,self.bad)
        self.run_boundary('add','source.txt')  # would run the clean filter in workspace Git
        self.run_boundary('trap',check=False)  # no workspace alias is known
        # Credential fill is a local Git operation, never an authenticated push.
        # Stub gh so it never consults a real owner login during the test.
        bin_dir = self.root / 'bin'; bin_dir.mkdir()
        gh = bin_dir / 'gh'; gh.write_text('#!/bin/sh\nexit 1\n'); gh.chmod(0o700)
        self.env['PATH'] = str(bin_dir)+':'+self.env['PATH']
        self.run_boundary('credential','fill',input='protocol=https\nhost=example.invalid\n\n',check=False)
        gh.write_text('#!/bin/sh\npwd\n')
        location=self.run_boundary('--github','api','--hostname','github.com','user').stdout.strip()
        self.assertTrue(location.startswith(str(self.home / '.backroom-git')+'/'))
        self.assertFalse(self.marker.exists())

    def test_replace_ref_cannot_change_review_declaration_diff_or_release_archive(self):
        replace = self.repo / '.git/refs/replace'
        replace.mkdir(parents=True)
        (replace / self.approved).write_text(self.bad+'\n')
        self.assertEqual(self.run_boundary('rev-parse','HEAD').stdout.strip(),self.approved)
        self.assertEqual(self.run_boundary('show',self.approved+':source.txt').stdout,'approved source\n')
        self.assertEqual(self.run_boundary('show',self.approved+':.env.required').stdout,'SAMPLE_TOKEN\n')
        self.assertIn('source.txt',self.run_boundary('diff','--name-only',self.approved,self.bad).stdout)
        import io, tarfile
        result=subprocess.run(['python3',str(BOUNDARY),str(self.repo),'archive','--format=tar',self.approved],env=self.env,capture_output=True,check=True)
        with tarfile.open(fileobj=io.BytesIO(result.stdout)) as archive:
            self.assertEqual(archive.extractfile('source.txt').read(),b'approved source\n')
        for protected in (self.home / '.backroom-git').glob('*.git'):
            self.assertFalse((protected / 'refs/replace').exists())
        self.assertFalse(self.marker.exists())

    def test_links_and_corrupt_objects_are_refused_before_git_use(self):
        objects=self.repo / '.git/objects'
        for directory in objects.iterdir():
            if len(directory.name)==2:
                candidate=next(directory.iterdir())
                original=candidate.read_bytes()
                candidate.unlink(); candidate.symlink_to(self.root / 'outside')
                (self.root / 'outside').write_bytes(original)
                self.assertNotEqual(self.run_boundary('status',check=False).returncode,0)
                candidate.unlink(); candidate.write_bytes(b'corrupt object')
                self.assertNotEqual(self.run_boundary('show',self.approved,check=False).returncode,0)
                break
        self.assertFalse(self.marker.exists())


if __name__ == '__main__': unittest.main(verbosity=2)
