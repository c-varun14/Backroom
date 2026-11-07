# Lane content report

Completed 2026-11-05. All business data is fictional SAMPLE data.

Created 26 content/code files plus this report. The initial client attachments total 1,569 whitespace-delimited words. Every file under `sample-client/` starts with a fictional SAMPLE line. The input guide excludes the evaluator answer key, later revision and adversarial fixtures from normal initial agent input.

## Files

- `projects.yaml`
- `sample-client/01-owner-brief.md`
- `sample-client/02-counter-notes.md`
- `sample-client/03-chat-export.txt`
- `sample-client/README.md`
- `sample-client/adversarial/cross-project-data.md`
- `sample-client/adversarial/destructive-shell.md`
- `sample-client/adversarial/secret-exfiltration.md`
- `sample-client/adversarial/unapproved-send.md`
- `sample-client/expected-brief-notes.md`
- `sample-client/revision.md`
- `sample-projects/old-shop/README.md`
- `sample-projects/old-shop/package.json`
- `sample-projects/old-shop/server.js`
- `sample-projects/old-shop/server.test.js`
- `studio-kit/architecture-format.md`
- `studio-kit/brief-format.md`
- `studio-kit/codex-spec-format.md`
- `studio-kit/review-checklist.md`
- `studio-kit/stack-menu.md`
- `studio-memory/SCHEMA.md`
- `studio-memory/architecture/server-owned-prices.md`
- `studio-memory/integrations/README.md`
- `studio-memory/mistakes/README.md`
- `studio-memory/packages/approved-index.md`
- `studio-memory/pending/polar-webhook-signatures.md`
- `reports/lane-content.md` — this report.

The three messy inputs deliberately disagree about pickup hours, order cut-off and capacity units. The evaluator notes preserve real requirements and require client resolution rather than guessing. The later revision adds two pickup sessions with 24/16-unit limits, migration handling and reopened approvals.

The studio kit supplies all five requested formats. Memory follows the review-before-promotion rule from the explicitly permitted read of `<PRIVATE_AGENCY_REFERENCE>` only. The price lesson is approved SAMPLE fixture state, with fictional review provenance; it is not a claim of a real owner decision. The Polar lesson is pending and excluded from the approved sample package index.

The self-contained earlier Bun app has no dependencies and exactly one happy-path test. It deliberately trusts a browser price and exposes the order list without authentication. Both flaws were reproduced below and remain unfixed for the later fix PR demonstration. Orders are temporary in-memory data; the app binds to loopback. The bakery itself was not built in this lane.

## External checks and UNVERIFIED items

- Exact web searches for `"Morrowcrumb" bakery` and `"Morrowcrumb Bakery"` on 2026-11-05 returned no results. No obvious existing bakery brand was found; trademark availability is UNVERIFIED.
- [Polar's current webhook delivery documentation](https://polar.sh/docs/integrate/webhooks/delivery) was read on 2026-11-05. The pending lesson cites its raw-body verification helper and failure handling. Live SDK compatibility, dashboard configuration and sandbox behaviour are explicitly marked **UNVERIFIED**. No SDK was installed and no live webhook was sent.
- [Bun's HTTP server documentation](https://bun.sh/docs/runtime/http/server) and [test runner documentation](https://bun.sh/docs/test) were checked. Local execution used Bun 1.3.14, as recorded below.
- No browser interaction or visual QA was performed. HTTP responses and the presence of the sample form were checked; browser interaction remains UNVERIFIED.
- No live approval, Switch package attachment, deployment, fix PR or security isolation claim is established by these fixtures.

## Scope

Only the specified content directories, `projects.yaml` and this explicitly requested report were written by this lane. Switch and Docker were not touched. No secrets or real client files were read. No commit, push, remote repository, client message or deployment was made. Other working-tree changes were observed while this lane ran and were left alone.

## Verification commands and real output

All commands below were run in this session. Exit codes are recorded even when a check failed. Two check-wrapper problems were corrected: Python lacked PyYAML, so registry parsing used Bun's built-in YAML parser; the first whitespace wrapper treated Git's normal new-file difference exit code 1 as an error even though Git emitted no whitespace diagnostics. The initial login-shell Bun commands also emitted an fnm symlink warning; Bun itself still ran and exited zero. Later commands used a non-login shell without changing the environment configuration.

### Runtime version

Working directory: `<PROJECT_ROOT>/sample-projects/old-shop`  
Exit code: `0`

Command:

```sh
bun --version
```

Real combined output:

```text
error: Can't create the symlink for multishells at "/run/user/1000/fnm_multishells/20_1793885233465". Maybe there are some issues with permissions for the directory? Read-only file system (os error 30)
1.3.14
```

### Earlier app: one happy-path test

Working directory: `<PROJECT_ROOT>/sample-projects/old-shop`  
Exit code: `0`

Command:

```sh
bun test
```

Real combined output:

```text
error: Can't create the symlink for multishells at "/run/user/1000/fnm_multishells/20_1793885233465". Maybe there are some issues with permissions for the directory? Read-only file system (os error 30)
bun test v1.3.14 (0d9b296a)

server.test.js:
(pass) accepts a normal sample tea order and returns its total [0.60ms]

 1 pass
 0 fail
 4 expect() calls
Ran 1 test across 1 file. [10.00ms]
```

### Initial content check: unavailable PyYAML

Working directory: `<PROJECT_ROOT>`  
Exit code: `1`

Command:

```sh
python3 - <<'PY'
from pathlib import Path
import json
import re
root = Path('.')
source = [root/'sample-client'/name for name in ['01-owner-brief.md', '02-counter-notes.md', '03-chat-export.txt']]
counts = [(p.name, len(p.read_text().split())) for p in source]
for name, count in counts:
    print(f'{name}: {count} words')
total = sum(count for _, count in counts)
assert 1350 <= total <= 1700, total
print(f'Three source documents: {total} words (target about 1500)')
client_files = sorted(p for p in (root/'sample-client').rglob('*') if p.is_file())
assert all(p.read_text().splitlines()[0].startswith('FICTIONAL SAMPLE') for p in client_files)
print(f'SAMPLE first-line markers: {len(client_files)}/{len(client_files)} client files')
required = ['stack-menu.md', 'brief-format.md', 'architecture-format.md', 'codex-spec-format.md', 'review-checklist.md']
assert all((root/'studio-kit'/name).is_file() for name in required)
assert '## Lessons used' in (root/'studio-kit/architecture-format.md').read_text()
print('Studio kit: 5 required formats; Lessons used present')
assert all((root/'studio-memory'/name).is_dir() for name in ['integrations', 'packages', 'architecture', 'mistakes', 'pending'])
assert all('SAMPLE' in p.read_text().splitlines()[0] for p in (root/'studio-memory').rglob('*.md'))
print('Memory: 5 required folders; every Markdown file marked SAMPLE')
package = json.loads((root/'sample-projects/old-shop/package.json').read_text())
assert not package.get('dependencies') and not package.get('devDependencies')
tests = list((root/'sample-projects/old-shop').rglob('*.test.js'))
assert len(tests) == 1 and len(re.findall(r'\btest\(', tests[0].read_text())) == 1
print('Earlier app: no dependencies; exactly one test')
import yaml
registry = yaml.safe_load((root/'projects.yaml').read_text())
project = registry['projects'][0]
assert project['id'] == 'old-shop' and (root/project['repo']).is_dir()
assert project['sample'] is True and 'server-owned-prices' in project['affected_by_lessons']
print('Registry: YAML parsed; sample old-shop path and lesson mapping valid')
PY
```

Real combined output:

```text
01-owner-brief.md: 550 words
02-counter-notes.md: 545 words
03-chat-export.txt: 581 words
Three source documents: 1676 words (target about 1500)
SAMPLE first-line markers: 10/10 client files
Studio kit: 5 required formats; Lessons used present
Memory: 5 required folders; every Markdown file marked SAMPLE
Earlier app: no dependencies; exactly one test
Traceback (most recent call last):
  File "<stdin>", line 27, in <module>
ModuleNotFoundError: No module named 'yaml'
```

### Working-tree observation

Working directory: `<PROJECT_ROOT>`  
Exit code: `0`

Command:

```sh
git diff --check; git status --short
```

Real combined output:

```text
A  .gitignore
AM AGENTS.md
A  docs/PLAN.md
A  specs/block-0.md
?? desk/
?? projects.yaml
?? reports/
?? sample-client/
?? sample-projects/
?? specs/lane-content.md
?? specs/lane-desk-core.md
?? spikes/
?? studio-kit/
?? studio-memory/
```

### Corrected content check

Working directory: `<PROJECT_ROOT>`  
Exit code: `0`

Command:

```sh
python3 - <<'PY'
from pathlib import Path
import json
import re
root = Path('.')
source = [root/'sample-client'/name for name in ['01-owner-brief.md', '02-counter-notes.md', '03-chat-export.txt']]
counts = [(p.name, len(p.read_text().split())) for p in source]
for name, count in counts:
    print(f'{name}: {count} words')
total = sum(count for _, count in counts)
assert 1350 <= total <= 1700, total
print(f'Three source documents: {total} words (target about 1500)')
client_files = sorted(p for p in (root/'sample-client').rglob('*') if p.is_file())
assert all(p.read_text().splitlines()[0].startswith('FICTIONAL SAMPLE') for p in client_files)
print(f'SAMPLE first-line markers: {len(client_files)}/{len(client_files)} client files')
required = ['stack-menu.md', 'brief-format.md', 'architecture-format.md', 'codex-spec-format.md', 'review-checklist.md']
assert all((root/'studio-kit'/name).is_file() for name in required)
assert '## Lessons used' in (root/'studio-kit/architecture-format.md').read_text()
print('Studio kit: 5 required formats; Lessons used present')
assert all((root/'studio-memory'/name).is_dir() for name in ['integrations', 'packages', 'architecture', 'mistakes', 'pending'])
assert all('SAMPLE' in p.read_text().splitlines()[0] for p in (root/'studio-memory').rglob('*.md'))
print('Memory: 5 required folders; every Markdown file marked SAMPLE')
package = json.loads((root/'sample-projects/old-shop/package.json').read_text())
assert not package.get('dependencies') and not package.get('devDependencies')
tests = list((root/'sample-projects/old-shop').rglob('*.test.js'))
assert len(tests) == 1 and len(re.findall(r'\btest\(', tests[0].read_text())) == 1
print('Earlier app: no dependencies; exactly one test')
print('Content checks complete; registry parsing is checked separately with Bun')
PY
```

Real combined output:

```text
01-owner-brief.md: 512 words
02-counter-notes.md: 513 words
03-chat-export.txt: 544 words
Three source documents: 1569 words (target about 1500)
SAMPLE first-line markers: 10/10 client files
Studio kit: 5 required formats; Lessons used present
Memory: 5 required folders; every Markdown file marked SAMPLE
Earlier app: no dependencies; exactly one test
Content checks complete; registry parsing is checked separately with Bun
```

### Registry parsed with built-in Bun YAML

Working directory: `<PROJECT_ROOT>`  
Exit code: `0`

Command:

```sh
bun --eval '
import { existsSync } from "node:fs";
const registry = Bun.YAML.parse(await Bun.file("projects.yaml").text());
const project = registry.projects[0];
if (project.id !== "old-shop" || !existsSync(project.repo) || project.sample !== true ||
    !project.affected_by_lessons.includes("server-owned-prices")) {
  throw new Error("Invalid sample registry");
}
console.log("Registry: YAML parsed; sample old-shop path and lesson mapping valid");
'
```

Real combined output:

```text
Registry: YAML parsed; sample old-shop path and lesson mapping valid
```

### Both deliberate flaws reproduced

Working directory: `<PROJECT_ROOT>/sample-projects/old-shop`  
Exit code: `0`

Command:

```sh
bun --eval '
import { createApp, catalog } from "./server.js";
const handle = createApp();
const placed = await handle(new Request("http://localhost/api/orders", {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ productId: "tea-tin", quantity: 2, unitPriceCents: 1,
    name: "Sample Rowan", email: "rowan@example.test" })
}));
const { order } = await placed.json();
const listed = await handle(new Request("http://localhost/api/orders"));
const { orders } = await listed.json();
if (placed.status !== 201 || order.totalCents !== 2 ||
    listed.status !== 200 || orders[0]?.email !== "rowan@example.test") {
  throw new Error("Expected deliberate flaws were not reproduced");
}
console.log("forged price: status=" + placed.status + " expectedCatalogTotal=" +
  catalog["tea-tin"].unitPriceCents * 2 + " acceptedTotal=" + order.totalCents);
console.log("unauthenticated list: status=" + listed.status +
  " exposedSampleEmail=" + orders[0].email);
'
```

Real combined output:

```text
forged price: status=201 expectedCatalogTotal=2400 acceptedTotal=2
unauthenticated list: status=200 exposedSampleEmail=rowan@example.test
```

### Local HTTP smoke check

Working directory: `<PROJECT_ROOT>/sample-projects/old-shop`  
Exit code: `0`

Command:

```sh
bun --eval '
import { createApp } from "./server.js";
const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: createApp() });
try {
  const response = await fetch(server.url);
  const html = await response.text();
  if (response.status !== 200 || !html.includes("FICTIONAL SAMPLE") ||
      !html.includes("order-form")) throw new Error("Homepage smoke check failed");
  const missing = await fetch(new URL("/missing", server.url));
  if (missing.status !== 404) throw new Error("Expected 404");
  console.log("HTTP smoke: GET / = 200; sample form present; GET /missing = 404");
} finally {
  await server.stop(true);
}
'
```

Real combined output:

```text
HTTP smoke: GET / = 200; sample form present; GET /missing = 404
```

### Initial whitespace wrapper: incorrect exit-code assumption

Working directory: `<PROJECT_ROOT>`  
Exit code: `1`

Command:

```sh
python3 - <<'PY'
from pathlib import Path
import subprocess
paths = sorted(p for folder in ['sample-client', 'studio-kit', 'studio-memory', 'sample-projects/old-shop'] for p in Path(folder).rglob('*') if p.is_file())
paths.append(Path('projects.yaml'))
for path in paths:
    result = subprocess.run(['git', 'diff', '--no-index', '--check', '/dev/null', str(path)], capture_output=True, text=True)
    if result.returncode != 0 or result.stdout or result.stderr:
        raise SystemExit(f'{path}: {result.returncode}\n{result.stdout}{result.stderr}')
print(f'Whitespace check: {len(paths)} lane files; no errors')
for path in sorted(paths):
    print(path)
PY
```

Real combined output:

```text
sample-client/01-owner-brief.md: 1

```

### Corrected whitespace check and file inventory

Working directory: `<PROJECT_ROOT>`  
Exit code: `0`

Command:

```sh
python3 - <<'PY'
from pathlib import Path
import subprocess
paths = sorted(p for folder in ['sample-client', 'studio-kit', 'studio-memory', 'sample-projects/old-shop'] for p in Path(folder).rglob('*') if p.is_file())
paths.append(Path('projects.yaml'))
for path in paths:
    result = subprocess.run(['git', 'diff', '--no-index', '--check', '/dev/null', str(path)], capture_output=True, text=True)
    if result.returncode not in (0, 1) or result.stdout or result.stderr:
        raise SystemExit(f'{path}: {result.returncode}\n{result.stdout}{result.stderr}')
print(f'Whitespace check: {len(paths)} lane files; no errors')
for path in sorted(paths):
    print(path)
PY
```

Real combined output:

```text
Whitespace check: 26 lane files; no errors
projects.yaml
sample-client/01-owner-brief.md
sample-client/02-counter-notes.md
sample-client/03-chat-export.txt
sample-client/README.md
sample-client/adversarial/cross-project-data.md
sample-client/adversarial/destructive-shell.md
sample-client/adversarial/secret-exfiltration.md
sample-client/adversarial/unapproved-send.md
sample-client/expected-brief-notes.md
sample-client/revision.md
sample-projects/old-shop/README.md
sample-projects/old-shop/package.json
sample-projects/old-shop/server.js
sample-projects/old-shop/server.test.js
studio-kit/architecture-format.md
studio-kit/brief-format.md
studio-kit/codex-spec-format.md
studio-kit/review-checklist.md
studio-kit/stack-menu.md
studio-memory/SCHEMA.md
studio-memory/architecture/server-owned-prices.md
studio-memory/integrations/README.md
studio-memory/mistakes/README.md
studio-memory/packages/approved-index.md
studio-memory/pending/polar-webhook-signatures.md
```

Work stops after writing this report, as requested.


Publication note: private paths/identities are redacted with stable SAMPLE aliases. Original command outcomes and artifact hashes refer to the original local run, not these privacy-edited bytes.
