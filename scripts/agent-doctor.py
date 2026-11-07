#!/usr/bin/env python3
"""Check an agent workspace without making persistent changes."""
import argparse
import os
from pathlib import Path
import shutil
import stat
import subprocess
import tempfile
import tomllib
import urllib.request


def check(name, condition, fix):
    print(f"{'PASS' if condition else 'FAIL'} {name}" + ('' if condition else f" — fix: {fix}"))
    return bool(condition)


TRUSTED_PATH = '/run/current-system/sw/bin:/opt/backroom/tools/bin:/usr/bin:/bin'
PLAYWRIGHT = '/srv/backroom/studio-kit/video/node_modules/playwright-core'


def tool(name):
    return shutil.which(name, path=TRUSTED_PATH)


def tool_environment():
    # Never inherit NODE_OPTIONS, NODE_PATH, Git injection or workspace PATH.
    return {'PATH': TRUSTED_PATH, 'HOME': '/nonexistent', 'LANG': 'C.UTF-8',
            'GIT_CONFIG_NOSYSTEM': '1', 'GIT_CONFIG_GLOBAL': '/dev/null',
            'GIT_NO_REPLACE_OBJECTS': '1', 'GIT_TEMPLATE_DIR': '/dev/null',
            'GIT_AUTHOR_NAME': 'Backroom Doctor', 'GIT_AUTHOR_EMAIL': 'doctor@backroom.invalid',
            'GIT_COMMITTER_NAME': 'Backroom Doctor', 'GIT_COMMITTER_EMAIL': 'doctor@backroom.invalid'}


def run(args, cwd=None, timeout=30, **kwargs):
    return subprocess.run(args, cwd=cwd or '/', stdin=subprocess.DEVNULL,
                          stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                          timeout=timeout, env=kwargs.pop('env', tool_environment()), **kwargs)


def browser_probe(node, chromium, module=PLAYWRIGHT):
    resolved = False
    screenshot_ok = False
    # Both module resolution and evaluation happen outside the product. The
    # module argument is an absolute, preinstalled studio path, never a package
    # name resolved from workspace/node_modules.
    with tempfile.TemporaryDirectory(prefix='backroom-tools-check-') as temporary:
        try:
            resolved = bool(node and run([node, '-e', 'require.resolve(process.argv[1])', module], cwd=temporary).returncode == 0)
            if resolved and chromium:
                screenshot = Path(temporary) / 'check.png'
                script = "const {chromium}=require(process.argv[1]); (async()=>{const b=await chromium.launch({headless:true,executablePath:process.env.BACKROOM_CHROMIUM});const p=await b.newPage();await p.setContent('<title>doctor</title>');await p.screenshot({path:process.env.BACKROOM_SCREENSHOT});await b.close()})().catch(()=>process.exit(1))"
                result = run([node, '-e', script, module], cwd=temporary, timeout=30,
                    env={**tool_environment(), 'HOME': temporary,
                         'XDG_CACHE_HOME': str(Path(temporary) / 'cache'),
                         'XDG_CONFIG_HOME': str(Path(temporary) / 'config'),
                         'BACKROOM_CHROMIUM': chromium, 'BACKROOM_SCREENSHOT': str(screenshot)})
                screenshot_ok = result.returncode == 0 and screenshot.is_file()
        except Exception:
            screenshot_ok = False
    return resolved, screenshot_ok


def builder_policy(workspace):
    """Check the exact per-project policy and its protection from replacement."""
    workspace = Path(workspace)
    folder = workspace / '.codex'
    config = folder / 'config.toml'
    try:
        parent_info, directory_info, file_info = workspace.lstat(), folder.lstat(), config.lstat()
        if (stat.S_ISLNK(parent_info.st_mode) or not parent_info.st_mode & stat.S_ISVTX or
                parent_info.st_uid == os.getuid() or
                not stat.S_ISDIR(directory_info.st_mode) or directory_info.st_uid != 0 or
                stat.S_IMODE(directory_info.st_mode) != 0o750 or
                not stat.S_ISREG(file_info.st_mode) or file_info.st_uid != 0 or
                file_info.st_nlink != 1 or stat.S_IMODE(file_info.st_mode) != 0o640 or
                os.access(config, os.W_OK) or os.access(folder, os.W_OK)):
            return False
        expected = {'sandbox_workspace_write': {
            'writable_roots': [str(workspace / '.git')], 'network_access': True}}
        return tomllib.loads(config.read_text()) == expected
    except Exception:
        return False


def doctor(workspace):
    workspace = Path(workspace).resolve()
    results = []
    results.append(check('protected builder .codex/config.toml', builder_policy(workspace),
                         'run prepare-builder through backroom-provision for this project; keep its root-owned policy and sticky workspace'))
    with tempfile.TemporaryDirectory(prefix='backroom-doctor-') as temporary:
        scratch = Path(temporary) / 'repo'
        scratch.mkdir()
        def git(*args):
            binary = tool('git')
            if not binary:
                return subprocess.CompletedProcess([], 1)
            return run([binary, '-c', 'core.hooksPath=/dev/null', '-c', 'core.fsmonitor=false',
                        '-c', 'credential.helper=', *args], cwd=scratch)
        results.append(check('git scratch-branch commit', git('init', '--template=', '-q', '-b', 'doctor-check').returncode == 0 and
            git('commit', '--allow-empty', '-qm', 'doctor check').returncode == 0,
            'install git and configure writable scratch repositories'))
    git_dir = workspace / '.git'
    results.append(check('.git writable', git_dir.exists() and os.access(git_dir, os.W_OK),
                         'grant the builder write access to this workspace .git directory'))
    try:
        request = urllib.request.Request('https://api.github.com/rate_limit', headers={'User-Agent': 'backroom-agent-doctor'})
        with urllib.request.urlopen(request, timeout=8) as response:
            network_ok = 200 <= response.status < 400
    except Exception:
        network_ok = False
    results.append(check('network', network_ok, 'allow the agent network through its sandbox and host firewall'))
    node = tool('node')
    chromium = tool('chromium') or tool('chromium-browser')
    resolved, screenshot_ok = browser_probe(node, chromium)
    results.append(check('Chromium screenshot', screenshot_ok,
                         'repair Chromium and the trusted studio video tool installation'))
    results.append(check('playwright-core resolvable', resolved,
                         'repair /srv/backroom/studio-kit/video/node_modules; product dependencies are not required'))
    postgres_ok = False
    with tempfile.TemporaryDirectory(prefix='backroom-pg-') as temporary:
        data = Path(temporary) / 'data'
        sock = Path(temporary) / 'socket'
        sock.mkdir()
        initdb = tool('initdb')
        pg_ctl = tool('pg_ctl')
        if initdb and pg_ctl:
            started_ok = False
            try:
                initialized = run([initdb, '-D', str(data), '-A', 'trust', '-U', 'doctor'], timeout=45)
                if initialized.returncode == 0:
                    started = run([pg_ctl, '-D', str(data), '-o', f"-k {sock} -p 55439 -c listen_addresses=''", '-l', str(Path(temporary) / 'postgres.log'), '-w', 'start'], cwd=temporary, timeout=45)
                    if started.returncode == 0:
                        started_ok = True
                        stopped = run([pg_ctl, '-D', str(data), '-m', 'immediate', '-w', 'stop'], timeout=45)
                        postgres_ok = stopped.returncode == 0
            except Exception:
                postgres_ok = False
            finally:
                if started_ok and not postgres_ok:
                    try:
                        run([pg_ctl, '-D', str(data), '-m', 'immediate', '-w', 'stop'], timeout=45)
                    except Exception:
                        pass
    results.append(check('Postgres start and stop', postgres_ok,
                         'install PostgreSQL server binaries and permit a temporary local instance'))
    results.append(check('pnpm', bool(tool('pnpm')), 'install pnpm for the agent user'))
    results.append(check('bun', bool(tool('bun')), 'install bun for the agent user'))
    return all(results)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--workspace', required=True)
    args = parser.parse_args()
    raise SystemExit(0 if doctor(args.workspace) else 1)


if __name__ == '__main__':
    main()
