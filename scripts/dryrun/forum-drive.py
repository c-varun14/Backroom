"""SAMPLE forum rehearsal operator. No network/process work occurs on import.

up provisions; resume drives seven durable steps; status is local/read-only.
All live commands are for Claude to run outside the implementation sandbox.
Credentials are supplied in a private JSON file outside .secrets/; never echoed.
"""
import argparse
from contextlib import contextmanager
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import secrets
import signal
import subprocess
import sys
import time
import uuid

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
# Reuse the existing credential-redacting HTTP adapter and validated role reader.
# Importing these modules does NOT call their .secrets-backed login helpers.
from block1_setup import ROOT, BASE, SetupError, call as raw_call
from harness_config import role_config, provider_ready
import requests

STATE = ROOT / '.switch-runtime/forum-rehearsal'
CONFIG = STATE / 'config.json'
PRIVATE = STATE / 'private/credentials.json'
DRIVER = STATE / 'driver.json'
REPORT = ROOT / 'reports/rehearsal-forum.md'
RUNTIME = ROOT / 'scripts/dryrun/forum-runtime.ts'
CONTROLLER = ROOT / '.switch-runtime/controller/package/cli.mjs'
LONG_WAIT = 60 * 60  # Every workflow step can wait an hour; no short agent timeout.
POLL = 3
UUID = r'[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}'

DOCUMENTS = {
    '01-phone-required.md': '''# SAMPLE — fictional Cedar Studio, visitor requests
Add a small request a quote feature to the existing base app. Visitors supply
name, email, a required phone number and a short description of their request.
Save requests durably. Use the existing admin sign-in for a private section
listing requests with their contact details and description. No payments,
automatic pricing, outgoing emails, file uploads or additional integrations.
''',
    '02-email-only.md': '''# SAMPLE — fictional Cedar Studio, contact policy
For the request a quote form, collect name, email and a short request description.
Email is the only contact method: do not ask for or store a phone number.
The admin section must show saved requests only to an authorized administrator.
Keep the existing base design and authentication. No payments, automatic
pricing, outgoing emails, file uploads or additional integrations.
''',
}
STARTER = ('request: SAMPLE fictional Cedar Studio. Please read both attached '
           'documents and ask us about conflicts before preparing the final requirements. '
           'We want a request a quote form and a private admin list on the existing base app.')
ANSWER = ('SAMPLE client decision: use email only. Do not collect or store phone numbers. '
          'Visitors must provide name, email and a short request description. '
          'Keep the existing admin sign-in and show saved requests only to an authorized '
          'administrator. Keep the other requirements and exclusions from both documents.')
STEPS = [
    'Phase and conflict questions reach SAMPLE client',
    'SAMPLE client answer and final document',
    'SAMPLE owner release and client Looks right',
    'Stack plan and SAMPLE owner approval',
    'Spec, builder and build-ready evidence',
    'Fresh independent review and automatic fix loop',
    'SAMPLE Deploy, Send to client and accept',
]


def atomic(path, value):
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    temporary = path.with_name(path.name + '.tmp')
    temporary.write_text(json.dumps(value, indent=2) + '\n')
    temporary.chmod(0o600)
    temporary.replace(path)


def read(path):
    return json.loads(path.read_text())


def config():
    c = read(CONFIG)
    ids = [c.get(k) for k in ('ownerId', 'clientId', 'deskId', 'controllerId',
                              'clientRoomId', 'studioRoomId', 'workRoomId') if c.get(k)]
    if (c.get('sample') is not True or not re.fullmatch(r'forum-rehearsal-[a-f0-9]{8}', c.get('projectId', ''))
            or c.get('namespace') != c['projectId'] or c.get('base') != BASE
            or c.get('workspace') != str(STATE / 'product') or 'github' in c
            or any(not re.fullmatch(UUID, i) for i in ids) or len(set(ids)) != len(ids)):
        raise SetupError('Invalid isolated SAMPLE configuration')
    return c


def private():
    return read(PRIVATE)


def assert_namespace():
    if config().get('pidNamespace') != os.readlink('/proc/self/ns/pid'):
        raise SetupError('SAMPLE process namespace changed; resume/stop in the original host namespace')


@contextmanager
def operator_lock():
    STATE.mkdir(parents=True, exist_ok=True, mode=0o700)
    with (STATE / 'operator.lock').open('a') as file:
        try:
            fcntl.flock(file, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise SetupError('Another SAMPLE forum operator is running')
        yield


def scoped_call(session, method, path, body=None):
    """Positive allowlist, based solely on this run's recorded resource IDs."""
    c = config()
    allowed = path == '/gateway/auth/login'
    if method == 'POST' and path in ('/gateway/users', '/agents', '/gateway/api-keys',
                                     '/gateway/rooms', '/gateway/documents', '/gateway/packages',
                                     '/gateway/management/enrollment-codes', '/gateway/management/agents'):
        allowed = True
    if method == 'GET' and path in ('/gateway/management/controllers', '/gateway/management/agents'):
        allowed = True
    rooms = [c[k] for k in ('clientRoomId', 'studioRoomId', 'workRoomId') if c.get(k)]
    agents = [c['deskId']] if c.get('deskId') else []
    agents += c.get('agentIds', [])
    for room in rooms:
        if path == '/gateway/rooms/' + room and method == 'GET':
            allowed = True
        if path in (f'/gateway/chats/{room}/members', f'/gateway/rooms/{room}/agents') and method == 'POST':
            allowed = True
        if path == f'/gateway/chats/{room}/messages' and method == 'POST':
            allowed = True
        if path.startswith(f'/gateway/rooms/{room}/documents/') and method == 'POST':
            allowed = path.rsplit('/', 1)[-1] in c.get('documentIds', [])
        if path == f'/gateway/rooms/{room}/packages/{c.get("packageId")}' and method == 'POST':
            allowed = True
    for agent in agents:
        if path == f'/gateway/agents/{agent}/addressing-policy' and method == 'PUT':
            allowed = True
        if path == f'/gateway/management/agents/{agent}' and method == 'PATCH':
            allowed = True
    if path == f'/gateway/packages/{c.get("packageId")}/documents/{c.get("memoryDocumentId")}' and method == 'POST':
        allowed = True
    if c.get('deskId') and re.fullmatch(
            f'/gateway/agent-sessions/{c["deskId"]}/backroom-[a-f0-9]{{20}}/approvals/{UUID}/answer', path) and method == 'POST':
        expected = hashlib.sha256(c['projectId'].encode()).hexdigest()[:20]
        allowed = '/backroom-' + expected + '/' in path
    if not allowed:
        raise SetupError('Non-rehearsal HTTP operation refused')
    return raw_call(session, method, path, body)


def login(role):
    s = requests.Session()
    if role == 'admin':
        name = os.environ.get('FORUM_REHEARSAL_ADMIN_FILE', '')
        path = Path(name).expanduser().resolve() if name else None
        if (not path or '.secrets' in path.parts or not path.is_file()
                or path.stat().st_mode & 0o077):
            raise SetupError('Set FORUM_REHEARSAL_ADMIN_FILE to a mode-0600 JSON login file outside .secrets/')
        credentials = read(path)
    else:
        credentials = private()[role]
    user = scoped_call(s, 'POST', '/gateway/auth/login', credentials)
    c = config()
    if role != 'admin' and user['id'] != c[role + 'Id']:
        raise SetupError('SAMPLE account identity mismatch')
    return s


def ledger(actor, action, evidence=None):
    row = {'sample': True, 'actor': 'SAMPLE ' + actor, 'action': action,
           'realHumanApproval': False, 'at': time.time(), 'evidence': evidence or {}}
    with (STATE / 'actor-ledger.jsonl').open('a') as file:
        file.write(json.dumps(row) + '\n')


def roles():
    # No demo overlay, custom command agents, provider keys or fallback models.
    os.environ['BACKROOM_HARNESS_CONFIG'] = str(ROOT / 'backroom.yaml')
    selected = {role: role_config(role) for role in ('front', 'lead', 'builder', 'reviewer')}
    if (any(selected[r]['harness'] != 'claude' for r in ('front', 'lead'))
            or selected['builder'] != {'harness': 'codex', 'model': 'gpt-6-luna'}
            or selected['reviewer'] != {'harness': 'codex', 'model': 'gpt-6.1-sol'}):
        raise SetupError('SAMPLE rehearsal requires backroom.yaml real lead/front, Luna builder and Sol reviewer')
    return selected


def instructions(role, c):
    base = (ROOT / 'studio-kit/agents' / (role + '.md')).read_text()
    # Keep the current playbooks; override only the obsolete Stage-1 cap/examples.
    if role == 'lead':
        base = base.replace('Stage 1 ONLY in the assigned work room.', 'Stages are assigned one at a time by desk.')
        base = base.replace('No architecture, code, deployment, other agents, shell commands, native file reads, or credential reads.',
                            'No code execution, deployment, subagents, shell commands, native file reads or credential reads.')
        base = base.replace("Write for a bakery owner, in Varun's voice.", 'Write for this client in the studio team voice, using we.')
        base += '\n' + (ROOT / 'studio-kit/codex-spec-format.md').read_text()
        base += '\n' + (ROOT / 'studio-kit/stack-menu.md').read_text()
        protocol = '''Stages 1–4 are explicitly authorized only as desk assigns them. For Phase intake,
read both complete source documents via load_internal_documents. Raise unresolved conflicts as
plain questions with KIND: reply. Once answered, return KIND: brief with final requirements.
Copy the exact draft N rev G first line from desk, then KIND, ---CLIENT TEXT--- and
---INTERNAL NOTES---. Later create_room_document then post_message with architecture document <id>,
spec document <id>, answer document <id>, or lesson <slug> <version> document <id>.
The plan must begin Stack: better-t-stack and contain AC-1, AC-2... checks linked to requirements.
This product workspace is an existing fresh base clone: never scaffold over it. The filled spec
must preserve existing auth/design and include all client decisions, exact commands, criterion
checks, build-report.md, a real PNG screenshot and build-verification.json. No fake screenshots
or test output. Use only supplied client facts; no assumed bakery scope or unrelated features.'''
    elif role == 'front':
        protocol = 'Only answer the exact talk post/revision using ACTION, SAY and NOTES. No native tools or client-room access.'
    elif role == 'builder':
        protocol = '''Implement only the approved filled spec in the assigned fresh base clone.
Use installed base tooling; no new harness dependencies. Preserve the base scaffold, existing
admin authentication and accepted data. Run the stack/spec commands and independently exercise
every AC in the real running app with fictional test data. Supply one AC-n: PASS - <evidence>
line per criterion in build-report.md and actual command/output blocks. Capture a real PNG and
build-verification.json with the actual local running URL, relative PNG path and sample:false.
SAMPLE refers to the client; sample:false means the image is a real app capture, not a fixture.
Keep the running local app available for review. No deploy contract file is needed: this
stack deploys through Nix. Never invent a deployment result. Bounded local commits in
this disposable product clone are authorized after checks during the later live rehearsal;
never commit Backroom. Return build-ready build-report.md at a clean exact checkpoint.
Ask blockers via ask: <question>. Desk routes failures and questions; wait for its assignment.'''
    else:
        protocol = '''Fresh independent review, never reuse another reviewer's session. Load ONLY
the assignment and source IDs desk names. Never read room history, read_context, builder
conversation or builder reports as review evidence. Inspect exact HEAD and clean tree, run
approved stack checks and independently exercise every AC against the real local running app.
Product source is read-only; write reports only in this identity's own directory. Tests may
create disposable fictional fixtures; never modify accepted data. Return exactly review N SHA
pass|fail, then one AC-n: PASS|FAIL - <observed evidence> line for each assigned criterion and
concise findings. No product edits or commits. A review never releases or deploys anything.'''
    return base + f'''\n\nSAMPLE FORUM REHEARSAL PROTOCOL — takes precedence over older example handoffs:
{protocol}
All owner/client actions here are labelled SAMPLE fixtures, never real human approvals.
A desk assignment in this isolated work room authorizes this rehearsal's next bounded task.
Work room: {c['workRoomId']}. Only product root: {c['workspace']}.
Never access another project, .secrets/, environment dumps, other sessions or other containers.
Only a separately named isolated rehearsal service may be started for local app checks; never
reuse an existing project's database or container. No sudo, pushes, remotes, hosting, tunnels,
GitHub, client posts, owner approvals or deployment. Use plan logins only; stop on low limits,
never fall back to another model. No subagents. Stop after each explicit handoff.
Deliver via Switch post_message in the assigned thread. Plain assistant text is never delivered.
No @desk/@lead mentions, send_targeted_message or self-routing. Keep client text free of internal
role names and machinery; keep SAMPLE labels in artifacts and evidence. Do not invent staff.
'''


def checked_process(args):
    result = subprocess.run(args, cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, env=process_env())
    if result.returncode:
        raise SetupError('SAMPLE subprocess failed; output withheld (command kind: ' + Path(args[0]).name + ')')


def process_env():
    # Providers must use plan logins even if the invoking shell has API variables.
    excluded = {'OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'CLAUDE_API_KEY', 'ANTHROPIC_AUTH_TOKEN', 'BACKROOM_DEBUG'}
    return {key: value for key, value in os.environ.items() if key not in excluded}


def create_agent(role, name, desired='running'):
    c = config()
    selected = roles()[role]
    directory = STATE / 'product' if role == 'builder' else STATE / 'agents' / name
    directory.mkdir(parents=True, exist_ok=True)
    advanced = {'effort': 'high' if role == 'reviewer' else 'medium'}
    if selected['harness'] == 'codex':
        advanced.update(verbosity='low', webSearch='false')
    else:
        advanced.update(maxTurns=16, disallowedTools=['Bash', 'Read', 'Write', 'Edit', 'Glob', 'Grep', 'Agent', 'WebSearch', 'WebFetch'])
    definition = {'provider': selected['harness'], 'model': selected['model'],
                  'directory': str(directory), 'isolation': 'shared', 'auto_mode': True,
                  'auto_approve': False, 'instructions': instructions(role, c), 'advanced_config': advanced}
    owner = login('owner')
    a = scoped_call(owner, 'POST', '/gateway/management/agents', {
        'name': name, 'description': 'SAMPLE isolated forum rehearsal ' + role,
        'controller_id': c['controllerId'], 'desired_state': desired, 'definition': definition})
    aid = a['agent_id']
    c.setdefault('agentIds', []).append(aid)
    c[role + 'Id'], c[role + 'Name'] = aid, name
    if role == 'reviewer':
        c.setdefault('reviewerIds', []).append(aid)
    atomic(CONFIG, c)  # Record ownership before any resource-specific mutation.
    scoped_call(owner, 'PUT', f'/gateway/agents/{aid}/addressing-policy', {'policy': None})
    scoped_call(login('admin'), 'POST', f'/gateway/rooms/{c["workRoomId"]}/agents', {'agent_ids': [aid]})
    ledger('agent provisioning', role, {'id': aid, 'model': selected['model'], 'fresh': role == 'reviewer'})
    return {'id': aid, 'name': name}


def fresh_reviewer(round_number):
    if not 1 <= round_number <= 1000:
        raise SetupError('Invalid SAMPLE reviewer round')
    c = config()
    owner = login('owner')
    key = 'freshReviewer' + str(round_number)
    if c.get(key):
        result = c[key]
        scoped_call(owner, 'PATCH', '/gateway/management/agents/' + result['id'], {'desired_state': 'running'})
        return result
    for aid in c['reviewerIds']:
        scoped_call(owner, 'PATCH', '/gateway/management/agents/' + aid, {'desired_state': 'stopped'})
    # A durable identity per round avoids reusing reviewer context after restart.
    result = create_agent('reviewer', 'reviewer-' + c['namespace'] + '-' + str(round_number) + '-' + uuid.uuid4().hex[:6])
    c = config()
    c[key] = result
    atomic(CONFIG, c)
    return result


def pid_running(name, token):
    assert_namespace()
    pidfile = STATE / (name + '.pid')
    if not pidfile.exists():
        return False
    pid = int(pidfile.read_text())
    try:
        command = Path(f'/proc/{pid}/cmdline').read_bytes().split(b'\0')
    except FileNotFoundError:
        return False
    if not any(command):  # Exited/zombie process: it cannot own a running service.
        return False
    if token.encode() not in command:
        raise SetupError('SAMPLE process identity mismatch; refusing process action')
    if Path(f'/proc/{pid}/cwd').resolve() != ROOT:
        raise SetupError('SAMPLE process working directory mismatch')
    return True


def start(name, args, token):
    if pid_running(name, token):
        return
    if name == 'runtime':
        # Safe only in the original PID namespace after the exact PID is absent.
        (STATE / 'runtime.lock').unlink(missing_ok=True)
    p = subprocess.Popen(args, cwd=ROOT, stdout=subprocess.DEVNULL,
                         stderr=subprocess.DEVNULL, start_new_session=True, env=process_env())
    (STATE / (name + '.pid')).write_text(str(p.pid))


def provider_check():
    c = config()
    selected = roles()
    owner = login('owner')
    for _ in range(120):
        machines = scoped_call(owner, 'GET', '/gateway/management/controllers')
        machine = next((m for m in machines if m['id'] == c['controllerId']), None)
        if machine and machine['state'] == 'online' and all(provider_ready(machine, r) for r in selected):
            return
        time.sleep(1)
    raise SetupError('SAMPLE controller plan logins unavailable; stop, no model fallback')


def verify():
    c = config()
    admin = login('admin')
    for field, suffix in (('clientRoomId', 'client'), ('studioRoomId', 'studio'), ('workRoomId', 'work')):
        room = scoped_call(admin, 'GET', '/gateway/rooms/' + c[field])
        if (room.get('bridge_id') or room.get('external_channel_id') or
                room['name'] != 'SAMPLE-' + c['namespace'] + '-' + suffix or room.get('internal_only') is False):
            raise SetupError('SAMPLE room isolation check failed; no runtime started')
    if c.get('setup') != 'ready':
        raise SetupError('SAMPLE setup incomplete; inspect config before resuming, do not bootstrap again')


def bootstrap():
    if CONFIG.exists():
        raise SetupError('SAMPLE forum run already exists; use status/resume, never replace it')
    selected = roles()  # Validate without credentials or server access.
    namespace = 'forum-rehearsal-' + uuid.uuid4().hex[:8]
    c = {'sample': True, 'namespace': namespace, 'projectId': namespace, 'base': BASE,
         'pidNamespace': os.readlink('/proc/self/ns/pid'), 'workspace': str(STATE / 'product'),
         'mode': 'real', 'clientSurface': 'forum', 'stack': 'better-t-stack', 'videoEnabled': False,
         'bridgeId': '00000000-0000-0000-0000-000000000000', 'ownerVerificationRequired': True,
         'doorKeyFile': str(STATE / 'private/door.key'), 'agentIds': [], 'reviewerIds': [],
         'documentIds': [], 'setup': 'provisioning', 'models': selected,
         'watchdogMs': LONG_WAIT * 1000, 'leadNudgeMs': 45 * 60 * 1000,
         'talkNudgeMs': 45 * 60 * 1000, 'talkGiveUpMs': LONG_WAIT * 1000}
    atomic(CONFIG, c)
    admin = login('admin')
    p = {}
    for role in ('owner', 'client'):
        p[role] = {'email': role + '-' + namespace + '@backroom.example', 'password': secrets.token_hex(24)}
        user = scoped_call(admin, 'POST', '/gateway/users', {'name': 'SAMPLE Forum ' + role.title(), **p[role], 'role': 'user'})
        c[role + 'Id'] = user['id']
        atomic(PRIVATE, p)
        atomic(CONFIG, c)
        ledger('account provisioning', role, {'id': user['id']})
    owner = login('owner')
    key = scoped_call(owner, 'POST', '/gateway/api-keys', {'label': 'SAMPLE ' + namespace + ' registration'})['key']
    registrar = requests.Session()
    registrar.headers['Authorization'] = 'Bearer ' + key
    p['desk'] = scoped_call(registrar, 'POST', '/agents', {
        'name': 'desk-' + namespace, 'description': 'SAMPLE plain-code forum rehearsal', 'connector_type': 'backroom-forum-rehearsal',
        'integration_profile': {'connection_model': 'always_on', 'message_exchange': True,
                                'pre_invocation_mediation': [], 'post_invocation_mediation': [], 'event_reporting': []}})
    atomic(PRIVATE, p)
    c.update(deskId=p['desk']['id'], deskName='desk-' + namespace)
    atomic(CONFIG, c)
    scoped_call(owner, 'PUT', f'/gateway/agents/{c["deskId"]}/addressing-policy', {'policy': None})
    for field, suffix in (('clientRoomId', 'client'), ('studioRoomId', 'studio'), ('workRoomId', 'work')):
        room = scoped_call(admin, 'POST', '/gateway/rooms', {
            'name': 'SAMPLE-' + namespace + '-' + suffix, 'description': 'SAMPLE isolated forum rehearsal; no Discord',
            'internal_only': True, 'agent_ids': [c['deskId']], 'read_visibility': 'private', 'write_visibility': 'private'})
        if room.get('bridge_id') or room.get('external_channel_id'):
            raise SetupError('SAMPLE room unexpectedly bridged; stop')
        c[field] = room['id']
        atomic(CONFIG, c)
        for uid in ([c['ownerId'], c['clientId']] if suffix == 'client' else [c['ownerId']]):
            scoped_call(admin, 'POST', f'/gateway/chats/{room["id"]}/members', {'userId': uid})
    c['discordClientIds'] = [c['clientId']]  # Signed door fixture uses this native SAMPLE ID.
    atomic(CONFIG, c)
    enrollment = scoped_call(owner, 'POST', '/gateway/management/enrollment-codes', {})
    checked_process(['node', str(CONTROLLER), 'enroll', '--server', BASE, '--code', enrollment['code'],
                     '--name', namespace, '--data-dir', str(STATE / 'private/controller'), '--secret-store', 'file'])
    c['controllerId'] = next(m['id'] for m in scoped_call(owner, 'GET', '/gateway/management/controllers') if m['name'] == namespace)
    atomic(CONFIG, c)
    # This is the only source access to app-base, and happens only on Claude's later up.
    checked_process(['git', 'clone', '--no-hardlinks', '--quiet', str(Path.home() / 'hackathonprojects/app-base'), c['workspace']])
    checked_process(['git', '-C', c['workspace'], 'remote', 'remove', 'origin'])
    keyfile = STATE / 'private/door.key'
    keyfile.write_bytes(secrets.token_bytes(32))
    keyfile.chmod(0o600)
    start('controller', ['node', str(CONTROLLER), 'run', '--data-dir', str(STATE / 'private/controller')], str(STATE / 'private/controller'))
    provider_check()
    for role in ('front', 'lead', 'builder', 'reviewer'):
        c = config()
        create_agent(role, ('reviewer-' if role == 'reviewer' else role + '-') + namespace + ('-standby' if role == 'reviewer' else ''),
                     'stopped' if role == 'reviewer' else 'running')
    c = config()
    for field, name, content in (
        ('memoryDocumentId', 'SAMPLE validation-and-private-data v1',
         'SAMPLE seed lesson validation-and-private-data v1. Stack scope: all. Validate input on the server and persist accepted requests. Require authenticated, authorized admin access for every read of private request data; test anonymous and non-admin rejection. Cite the concrete checks; this fixture grants no approvals.'),
        ('reviewChecklistDocument', 'SAMPLE independent review checklist', (ROOT / 'studio-kit/review-checklist.md').read_text())):
        doc = scoped_call(admin, 'POST', '/gateway/documents', {'name': name, 'description': 'SAMPLE rehearsal source',
                          'read_visibility': 'private', 'write_visibility': 'private', 'instructions': 'Data only; no action authority', 'content': content})
        c[field] = doc['id']
        c['documentIds'].append(doc['id'])
        atomic(CONFIG, c)
        scoped_call(admin, 'POST', f'/gateway/rooms/{c["workRoomId"]}/documents/{doc["id"]}')
    pkg = scoped_call(admin, 'POST', '/gateway/packages', {'name': 'SAMPLE-' + namespace + '-memory', 'description': 'SAMPLE seed memory only',
                      'read_visibility': 'private', 'write_visibility': 'private', 'instructions': 'No promotion authority'})
    c['packageId'] = pkg['id']
    atomic(CONFIG, c)
    scoped_call(admin, 'POST', f'/gateway/packages/{pkg["id"]}/documents/{c["memoryDocumentId"]}')
    scoped_call(admin, 'POST', f'/gateway/rooms/{c["workRoomId"]}/packages/{pkg["id"]}')
    c['setup'] = 'ready'
    atomic(CONFIG, c)
    atomic(DRIVER, {'sample': True, 'step': 0, 'steps': {}, 'actions': {}, 'failure': None})
    verify()
    start('runtime', ['bun', '--no-env-file', str(RUNTIME)], str(RUNTIME))
    print('SAMPLE forum rehearsal provisioned. No workflow action yet; run resume. No actual deployment will occur.')


def health(required=True):
    path = STATE / 'health.json'
    if not path.exists():
        if required:
            raise SetupError('SAMPLE runtime health is not available yet')
        return {}
    return read(path)


def check_health(h):
    if h.get('failure'):
        raise SetupError(h['failure'])
    if h.get('reviewPaused'):
        raise SetupError('SAMPLE review paused after three blockers; inspect findings and owner decision card, no automatic approval')
    if h.get('buildStopped'):
        raise SetupError('SAMPLE build stopped by owner decision')
    if any(i['status'] == 'uncertain' for i in h.get('uncertain', [])):
        raise SetupError('SAMPLE gate outcome uncertain; reconcile before any release retry')


def wait_for(label, predicate):
    deadline = time.monotonic() + LONG_WAIT
    update = 0
    while time.monotonic() < deadline:
        h = health(False)
        check_health(h)
        if h and time.time() * 1000 - h['at'] <= 15000 and predicate(h):
            return h
        if not pid_running('runtime', str(RUNTIME)):
            raise SetupError('SAMPLE runtime exited during ' + label + '; use status before resume')
        if time.monotonic() >= update:
            print('SAMPLE waiting: ' + label, flush=True)
            update = time.monotonic() + 45
        time.sleep(POLL)
    raise SetupError('SAMPLE wait exceeded 60 minutes: ' + label + '; position saved, no success inferred')


def driver():
    return read(DRIVER)


def action_once(name, actor, operation, intent=None):
    """Persist intent before HTTP. A lost response is never blindly replayed."""
    d = driver()
    old = d['actions'].get(name)
    if old:
        return old
    row = {'id': str(uuid.uuid4()), 'status': 'dispatching', 'actor': 'SAMPLE ' + actor,
           'at': time.time(), 'intent': intent or {}}
    d['actions'][name] = row
    atomic(DRIVER, d)
    result = operation(row['id'])
    d = driver()
    row.update(status='sent', evidence=result)
    d['actions'][name] = row
    atomic(DRIVER, d)
    ledger(actor, name, result)
    return row


def native_message(name, body, uploads=None):
    def send(request_id):
        c = config()
        scoped_call(login('client'), 'POST', f'/gateway/chats/{c["clientRoomId"]}/messages',
                    {'requestId': request_id, 'body': body, **({'uploadIds': uploads} if uploads else {})})
        return {'requestId': request_id, 'bodySha256': hashlib.sha256(body.encode()).hexdigest(),
                'threadMetadata': 'SAMPLE forum fixture supplies missing Discord thread anchor'}
    return action_once(name, 'native client', send)


def upload_documents():
    c = config()
    session = login('client')
    ids = []
    for name, content in DOCUMENTS.items():
        path = STATE / 'fixtures' / name
        path.parent.mkdir(exist_ok=True)
        path.write_text(content)
        def upload(upload_id):
            with path.open('rb') as file:
                response = session.post(BASE + f'/gateway/chats/{c["clientRoomId"]}/attachments',
                    files={'file': (name, file, 'text/plain')}, data={'uploadId': upload_id}, timeout=45)
            if not response.ok:
                raise SetupError('SAMPLE document upload failed; response withheld')
            return {'uploadId': upload_id, 'name': name, 'sha256': hashlib.sha256(content.encode()).hexdigest()}
        row = action_once('upload-' + name, 'native client', upload)
        if row['status'] != 'sent':
            raise SetupError('SAMPLE upload response lost; reconcile uploadId before retrying')
        ids.append(row['id'])
    return ids


def fixture(name, kind, **fields):
    row = action_once(name, 'signed door fixture', lambda action_id: write_fixture(action_id, kind, fields),
                      {'kind': kind, 'fields': fields})
    # Re-publishing a LOCAL inbox file is safe: runtime deduplicates the same ID
    # and immutable payload. This also recovers a crash before the first write.
    write_fixture(row['id'], row['intent']['kind'], row['intent']['fields'])
    return wait_for(name, lambda h: any(a['id'] == row['id'] and a['status'] == 'done' for a in h['actions']))


def write_fixture(action_id, kind, fields):
    atomic(STATE / 'fixture.json', {'id': action_id, 'kind': kind, **fields})
    return {'fixtureId': action_id, 'kind': kind, 'sample': True}


def pending_button(h, command):
    for card in reversed(h.get('ownerCards', [])):
        if card['status'] == 'open':
            for button in json.loads(card['buttons']):
                if button['command'] == command:
                    return card, button
    return None


def owner_press(name, command):
    if name in driver()['actions']:
        return  # A restart observes the effect before sending any further decision.
    h = wait_for(name + ' card', lambda h: pending_button(h, command) is not None)
    card, button = pending_button(h, command)
    def answer(_):
        c = config()
        scoped_call(login('owner'), 'POST',
            f'/gateway/agent-sessions/{c["deskId"]}/{h["ownerSession"]}/approvals/{card["request"]}/answer', {'answer': button['id']})
        return {'request': card['request'], 'button': button['label'], 'command': command,
                'route': 'gateway answer', 'realHumanApproval': False}
    action_once(name, 'native owner button', answer,
                {'request': card['request'], 'button': button['label'], 'command': command})


def client_press(name, stage):
    old = driver()['actions'].get(name)
    if old:
        return fixture(name, old['intent']['kind'], **old['intent']['fields'])
    h = wait_for(name + ' button', lambda h: any(json.loads(b['binding'])['stage'] == stage for b in h['clientButtons']))
    button = next(b for b in h['clientButtons'] if json.loads(b['binding'])['stage'] == stage)
    return fixture(name, 'press', ref=button['ref'])


def active(h, stage):
    return next((a for a in reversed(h.get('artifacts', [])) if a['stage'] == stage and a['status'] == 'active'), None)


def conflict(h):
    return next((d for d in h.get('deliveries', []) if '?' in d['text'] and
                 re.search(r'phone|telephone', d['text'], re.I) and re.search(r'email|e-mail', d['text'], re.I)), None)


def step_work(index):
    h = health(False)
    if index == 0:
        uploads = upload_documents()
        native_message('phase-starter', STARTER, uploads)
        fixture('phase-open', 'open', bodySha=hashlib.sha256(STARTER.encode()).hexdigest())
        def question(h):
            if h.get('brief') and not conflict(h):
                raise SetupError('SAMPLE lead produced a final brief before resolving the phone/email conflict')
            return conflict(h) is not None
        h = wait_for('lead phone/email conflict question delivered to SAMPLE client', question)
        return {'questionDelivery': conflict(h)['id'], 'sourceFiles': list(DOCUMENTS)}
    if index == 1:
        native_message('client-conflict-answer', ANSWER)
        h = wait_for('final brief after SAMPLE client answer', lambda h: (h.get('brief') or {}).get('status') == 'active'
                     and (h.get('ticket') or {}).get('status') == 'awaiting-owner')
        return {'document': h['brief']['artifact'], 'version': h['brief']['version']}
    if index == 2:
        if h.get('workflow', {}).get('stage') == 'brief':
            draft = h['brief']
            if draft['status'] == 'active':
                owner_press('release-final-brief', '@desk send ' + draft['code'])
            # Press only if the exact delivered version still awaits client approval.
            if health()['workflow']['stage'] == 'brief':
                client_press('client-looks-right', 'brief')
        h = wait_for('SAMPLE client brief accepted', lambda h: h['workflow']['stage'] != 'brief')
        return {'brief': h['workflow']['stages']['brief']}
    if index == 3:
        if h['workflow']['stage'] == 'architecture':
            h = wait_for('lead Stack plan', lambda h: active(h, 'architecture') is not None)
            plan = h.get('architecture') or ''
            if not plan.splitlines() or plan.splitlines()[0] != 'Stack: better-t-stack' or not re.search(r'\bAC-[1-9][0-9]*\b', plan):
                raise SetupError('SAMPLE plan must begin Stack: better-t-stack and contain AC- criteria; inspect lead document')
            owner_press('approve-stack-plan', '@desk approve architecture ' + active(h, 'architecture')['code'])
        h = wait_for('SAMPLE owner architecture approval', lambda h: h['workflow']['stage'] == 'build')
        return {'architecture': h['workflow']['stages']['architecture']}
    if index == 4:
        h = wait_for('spec and builder build-ready evidence', lambda h: bool(h.get('spec') and h.get('criteria') and h.get('buildSeen')))
        return {'spec': h['spec'], 'criteria': h['criteria'], 'buildReady': h['buildSeen']}
    if index == 5:
        h = wait_for('fresh independent review (failures route back automatically)',
                     lambda h: h.get('reviewVerdict') == 'pass' and active(h, 'build') is not None)
        if not (h.get('reviewer') or {}).get('id') or h['reviewer']['sha'] != h['candidate']:
            raise SetupError('SAMPLE fresh reviewer identity or exact SHA mismatch')
        return {'reviewer': h['reviewer'], 'commit': h['candidate']}
    if index == 6:
        if h['workflow']['stage'] == 'build':
            sha = h['candidate']
            if not h.get('deployment'):
                owner_press('owner-deploy', '@desk deploy ' + sha)
            h = wait_for('SAMPLE RehearsalDeployer exact commit record',
                         lambda h: (h.get('deployment') or {}).get('sha') == sha)
            owner_press('owner-send-to-client', '@desk deliver ' + active(h, 'build')['code'])
        h = wait_for('SAMPLE product delivered to client', lambda h: h['workflow']['stage'] in ('client_review', 'learn'))
        if h['workflow']['stage'] == 'client_review':
            client_press('client-product-accept', 'client_review')
        h = wait_for('SAMPLE client accepts exact product commit',
                     lambda h: h['workflow']['stage'] == 'learn' and 'client' in h['workflow']['stages']['client_review']['approvals'])
        return {'accepted': h['workflow']['stages']['client_review'], 'deployment': h['deployment'],
                'actuallyDeployed': False, 'next': 'Claude deploys this exact reviewed commit for real separately'}
    raise SetupError('Invalid SAMPLE step')


def render_live_report():
    d = driver()
    h = health(False)
    marker = '\n## SAMPLE live rehearsal ledger (generated by forum-drive.py)\n'
    original = REPORT.read_text() if REPORT.exists() else '# Forum rehearsal\n'
    original = original.split(marker)[0]
    lines = [marker, '\nAll actions below are scripted SAMPLE fixtures; no real human approvals.\n',
             'Agent turns count result-bearing Switch messages, deduplicated by event ID. Session-start notices are recorded separately. Internal model/tool turns are not inferred.\n',
             '\n| Step | State | Elapsed seconds | SAMPLE agent result turns |\n| --- | --- | ---: | --- |\n']
    for i, title in enumerate(STEPS):
        row = d['steps'].get(str(i), {})
        elapsed = round((row.get('ended') or time.time()) - row['started'], 1) if row else 0
        after = row.get('after', h.get('agentActivity', []))
        before = {(r['role'], r['kind']): r['count'] for r in row.get('before', [])}
        counts = {r['role']: r['count'] - before.get((r['role'], r['kind']), 0) for r in after if r['kind'] == 'result'}
        lines.append(f"| {i + 1}. {title} | {row.get('status', 'pending')} | {elapsed} | {json.dumps(counts, sort_keys=True)} |\n")
    lines += ['\nCurrent position: ' + str(d['step'] + 1) + ' of 7 (8 means all seven steps completed).\n',
              '\nSafe failure: ' + (d.get('failure') or 'none recorded') + '\n',
              '\n```json\n' + json.dumps({'sample': True, 'steps': d['steps'], 'actions': d['actions'],
                  'agentActivity': h.get('agentActivity'), 'deployment': h.get('deployment')}, indent=2) + '\n```\n',
              '\nRehearsalDeployer records an exact commit and public-shaped `.example` SAMPLE URL; no app is deployed and no public HTTP health check is performed. Claude must deploy the recorded commit for real separately. Video and lesson promotion are outside these seven steps.\n']
    REPORT.write_text(original + ''.join(lines))


def resume():
    assert_namespace()
    if driver()['step'] == len(STEPS):
        status()
        return
    check_health(health(False))
    verify()
    roles()
    start('controller', ['node', str(CONTROLLER), 'run', '--data-dir', str(STATE / 'private/controller')], str(STATE / 'private/controller'))
    provider_check()
    # Re-arm only this run's role identities after an explicit stop. Never alter real agents.
    c = config()
    owner = login('owner')
    current = health(False).get('reviewer', {}).get('id') if health(False).get('reviewer') else None
    for aid in [c['frontId'], c['leadId'], c['builderId']] + ([current] if current else []):
        scoped_call(owner, 'PATCH', '/gateway/management/agents/' + aid, {'desired_state': 'running'})
    start('runtime', ['bun', '--no-env-file', str(RUNTIME)], str(RUNTIME))
    wait_for('SAMPLE client/studio connections', lambda h: h['connectedRooms'] == 2)
    d = driver()
    d['failure'] = None
    atomic(DRIVER, d)
    while d['step'] < len(STEPS):
        i = d['step']
        row = d['steps'].setdefault(str(i), {'started': time.time(), 'before': health()['agentActivity']})
        row['status'] = 'running'
        atomic(DRIVER, d)
        print(f'SAMPLE step {i + 1}/7: {STEPS[i]}', flush=True)
        evidence = step_work(i)
        d = driver()
        d['steps'][str(i)].update(status='complete', ended=time.time(), evidence=evidence, after=health()['agentActivity'])
        d['step'] = i + 1
        atomic(DRIVER, d)
        render_live_report()
    print('SAMPLE seven-step forum rehearsal complete. Exact commit saved; no actual deployment. Stopping only rehearsal processes.', flush=True)
    stop()


def stop():
    assert_namespace()
    c = config()
    owner = login('owner')
    for aid in c.get('agentIds', []):
        scoped_call(owner, 'PATCH', '/gateway/management/agents/' + aid, {'desired_state': 'stopped'})
    for _ in range(60):
        agents = scoped_call(owner, 'GET', '/gateway/management/agents')
        active_agents = [a for a in agents if a['agent_id'] in c['agentIds'] and
                         (a.get('status') or {}).get('process') not in ('stopped', 'absent', None)]
        if not active_agents:
            break
        time.sleep(1)
    else:
        raise SetupError('SAMPLE agents did not stop; controller left alive for convergence')
    for name, token in (('runtime', str(RUNTIME)), ('controller', str(STATE / 'private/controller'))):
        if pid_running(name, token):
            os.kill(int((STATE / (name + '.pid')).read_text()), signal.SIGTERM)
            for _ in range(60):
                if not pid_running(name, token):
                    break
                time.sleep(0.5)
            else:
                raise SetupError('SAMPLE process still stopping; no forced kill')
    ledger('operator', 'stop dedicated SAMPLE agents/controller/runtime')
    print('SAMPLE agents, runtime and dedicated controller stopped. Product clone and evidence retained; no Docker deployment to clean up.')


def status():
    if not CONFIG.exists():
        print('SAMPLE forum rehearsal has not been provisioned. Implementation only; no Switch run claimed.')
        return
    c = config()
    d = driver() if DRIVER.exists() else {}
    h = health(False)
    print(json.dumps({'sample': True, 'project': c['projectId'], 'setup': c['setup'],
        'step': d.get('step', 0) + 1, 'of': 7, 'current': STEPS[d.get('step', 0)] if d.get('step', 0) < 7 else 'complete',
        'failure': d.get('failure') or h.get('failure'), 'healthAgeSeconds': round(time.time() - h['at'] / 1000, 1) if h else None,
        'workflowStage': h.get('workflow', {}).get('stage'), 'reviewVerdict': h.get('reviewVerdict'),
        'reviewPaused': h.get('reviewPaused'), 'candidate': h.get('candidate'), 'deployment': h.get('deployment'),
        'agentActivity': h.get('agentActivity'), 'steps': d.get('steps'), 'realHumanApproval': False}, indent=2))


def main():
    os.umask(0o077)
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['up', 'resume', 'status', 'stop', 'verify', 'reviewer'])
    parser.add_argument('round', nargs='?', type=int)
    args = parser.parse_args()
    if args.action == 'status':
        status()
        return
    if args.action == 'verify':
        verify()
        return
    if args.action == 'reviewer':
        # Called only by runtime; separate from the long-lived driver operator lock.
        print(json.dumps(fresh_reviewer(args.round or 0)))
        return
    with operator_lock():
        try:
            {'up': bootstrap, 'resume': resume, 'stop': stop}[args.action]()
        except (Exception, KeyboardInterrupt) as error:
            if DRIVER.exists():
                d = driver()
                # Exception text from requests/providers may contain credentials. Never persist it.
                d['failure'] = str(error) if isinstance(error, SetupError) else 'SAMPLE operator interrupted or failed; raw details withheld'
                atomic(DRIVER, d)
                render_live_report()
            raise


if __name__ == '__main__':
    try:
        main()
    except SetupError as error:
        print(str(error), file=sys.stderr)
        raise SystemExit(1)
    except KeyboardInterrupt:
        print('SAMPLE operator interrupted; durable position saved. Runtime may still be working; use status/resume or stop.', file=sys.stderr)
        raise SystemExit(130)
    except Exception as error:
        print('SAMPLE forum rehearsal failed (' + type(error).__name__ + '); raw details withheld. Use status before resume.', file=sys.stderr)
        raise SystemExit(1)
