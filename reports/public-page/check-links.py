"""Audit README/docs public links without visiting services or protected rough-cut files."""
from pathlib import Path
import re
import subprocess
files = [Path('README.md')] + [p for p in Path('docs').rglob('*') if p.is_file() and p.suffix in {'.md', '.html'} and 'rough-cut' not in p.parts]
links = 0
for path in files:
    for pair in re.findall(r'\]\(([^)]+)\)|(?:href|src)=[\"\']([^\"\']+)', path.read_text()):
        target = next(x for x in pair if x)
        if ':' in target or target.startswith('#'):
            continue
        dest = (path.parent / target.split('#')[0]).resolve()
        links += 1
        ignored = subprocess.run(['git', 'check-ignore', '--no-index', str(dest)], capture_output=True).returncode == 0
        if ignored or not dest.exists():
            raise SystemExit(str(path) + ': unavailable public target ' + target)
print(f'README/docs audit: {links} local links checked; missing=0; git-ignored=0. Protected rough-cut excluded.')
