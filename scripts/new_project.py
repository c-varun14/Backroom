"""Idempotent forum project provisioning. No credential values or remote responses are printed.

Only main() opens connections; provision() accepts fakes for offline verification.
"""
import argparse
import json
import os
from pathlib import Path
import re
import secrets
import subprocess
import sys
import time
import unicodedata

ROOT = Path(__file__).resolve().parents[1]
KINDS = ['Phase', 'Feature', 'Bug/Change', 'Question', 'Chat']
STATUSES = ['Received', 'In progress', 'Ready for you', 'Done']
VIEW = 1 << 10
TALK = VIEW | (1 << 11) | (1 << 14) | (1 << 15) | (1 << 16) | (1 << 35) | (1 << 38)
MANAGE_THREADS = 1 << 34
MANAGE_MESSAGES = 1 << 13


def project_slug(name):
    name = name.strip()
    if not name or '@' in name or len(name) > 80:
        raise ValueError('Project name must be 1–80 characters without @')
    plain = unicodedata.normalize('NFKD', name).encode('ascii', 'ignore').decode().lower()
    slug = re.sub(r'[^a-z0-9]+', '-', plain).strip('-')[:50]
    return slug or 'project'


def unique_slug(name, occupied):
    base = project_slug(name)
    slug, n = base, 2
    while slug in occupied:
        slug = f'{base}-{n}'
        n += 1
    return slug


def write_json(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    temporary = path.with_suffix(path.suffix + '.tmp')
    temporary.write_text(json.dumps(value, indent=2))
    temporary.chmod(0o600)
    temporary.replace(path)


def provision_github(config, allowed_authors, save, owner='WebbyWasp', runner=subprocess.run):
    """Desk provisioning only. Inject runner for account-free tests; never echo output."""
    if owner != 'WebbyWasp' or not re.fullmatch(r'[a-z0-9-]{1,60}', config['projectId']):
        raise ValueError('Only WebbyWasp project repositories are allowed')
    if not isinstance(allowed_authors, list) or any(not isinstance(a, str) or not re.fullmatch(r'[A-Za-z0-9_][A-Za-z0-9_-]{0,38}', a) for a in allowed_authors):
        raise ValueError('Explicit GitHub author logins required')
    repo = owner + '/' + config['projectId']
    if config.get('github') and config['github']['repo'] != repo:
        raise ValueError('Project GitHub repository mismatch')
    workspace = Path(os.path.abspath(config['workspace']))
    workspace.mkdir(parents=True, exist_ok=True)
    def execute(args):
        # Tests inject an account-free runner. Production never opens workspace
        # Git metadata, including during retries after an agent has run.
        options = dict(cwd=str(workspace), capture_output=True, text=True)
        if runner is subprocess.run:
            options['env'] = {k:v for k,v in os.environ.items() if not k.startswith('GIT_')}
            options['env'].update(GIT_NO_REPLACE_OBJECTS='1', GIT_CONFIG_NOSYSTEM='1', GIT_CONFIG_GLOBAL='/dev/null', GIT_TERMINAL_PROMPT='0', GH_PROMPT_DISABLED='1')
            if args[0] == 'git':
                args = [sys.executable, str(ROOT / 'scripts/shadow_git.py'), str(workspace), *args[1:]]
            else:
                args = [sys.executable, str(ROOT / 'scripts/shadow_git.py'), str(workspace), '--github', *args[1:]]
        return runner(args, **options)
    def command(args, missing=False):
        try:
            result = execute(args)
        except Exception:
            raise ValueError('GitHub provisioning failed; response withheld') from None
        if result.returncode:
            if missing and re.search(r'\bHTTP 404\b', result.stderr or ''):
                return None
            raise ValueError('GitHub provisioning failed; response withheld')
        return result.stdout.strip()
    def metadata(name):
        raw = command(['gh', 'api', '--hostname', 'github.com', 'repos/' + name], missing=True)
        return json.loads(raw) if raw is not None else None
    existing = metadata(repo)
    template_used = False
    if existing is None:
        template = metadata('WebbyWasp/app-base')
        args = ['gh', 'repo', 'create', repo, '--private']
        if template is not None:
            if template.get('full_name') != 'WebbyWasp/app-base' or not template.get('is_template'):
                raise ValueError('app-base exists but is not the expected template')
            args += ['--template', 'WebbyWasp/app-base']
            template_used = True
        command(args)
        existing = metadata(repo)
    if not existing or existing.get('private') is not True or existing.get('full_name') != repo:
        raise ValueError('Private WebbyWasp project repository required')
    # Initialize this workspace explicitly; never inherit Backroom's enclosing .git.
    if not (workspace / '.git').exists():
        command(['git', 'init', '-b', 'main'])
    top = command(['git', 'rev-parse', '--show-toplevel'])
    if Path(top).resolve() != workspace:
        raise ValueError('Isolated project Git repository required')
    remote = 'https://github.com/' + repo + '.git'
    remotes = command(['git', 'remote']).splitlines()
    command(['git', 'remote', 'set-url' if 'origin' in remotes else 'add', 'origin', remote])
    heads = command(['git', 'ls-remote', '--heads', 'origin'])
    # GitHub fills a template repository a moment after creating it. An early empty
    # answer must not make this look like a bare repository.
    for _ in range(30):
        if heads or not template_used:
            break
        time.sleep(2)
        heads = command(['git', 'ls-remote', '--heads', 'origin'])
    # An empty tree checkpoint gives the first issue branch a PR base. No product
    # files are added; all application work still goes through CI and review.
    if not heads:
        head = execute(['git', 'rev-parse', '--verify', 'HEAD'])
        if head.returncode:
            if command(['git', 'status', '--porcelain']):
                raise ValueError('Clean empty project required for initialization')
            command(['git', '-c', 'core.hooksPath=/dev/null', '-c', 'commit.gpgsign=false', '-c', 'user.name=Backroom desk',
                     '-c', 'user.email=desk@backroom.invalid', 'commit', '--allow-empty', '-m', 'Initialize empty project main'])
        elif command(['git', 'ls-tree', '-r', '--name-only', 'HEAD']):
            raise ValueError('Refusing to seed main with unreviewed project files')
        sha = command(['git', 'rev-parse', 'HEAD'])
        if not re.fullmatch(r'[a-f0-9]{40}', sha):
            raise ValueError('Exact empty checkpoint required')
        command(['git', '-c', 'core.hooksPath=/dev/null', 'push', '--no-verify', '--force-with-lease=refs/heads/main:', 'origin', sha + ':refs/heads/main'])
    else:
        if not any(line.endswith('\trefs/heads/main') for line in heads.splitlines()):
            raise ValueError('Project template must provide main')
        command(['git', '-c', 'core.hooksPath=/dev/null', 'fetch', '--no-tags', 'origin', 'refs/heads/main:refs/remotes/backroom/main'])
        head = execute(['git', 'rev-parse', '--verify', 'HEAD'])
        if head.returncode:
            command(['git', '-c', 'core.hooksPath=/dev/null', 'switch', '-C', 'main', 'refs/remotes/backroom/main'])
    if runner is subprocess.run and not (workspace / '.git').exists():
        command(['git', '--export-initial'])
    config['github'] = {'repo': repo, 'allowedAuthors': allowed_authors}
    save(config)
    return config


def share_workspace(path):
    """Agents run as a separate user in the studio group, so workspaces must be group-usable."""
    root = Path(path)
    root.mkdir(parents=True, exist_ok=True)
    for folder, names, files in os.walk(root):
        # The root helper owns .codex; sharing must never relax that policy.
        names[:] = [name for name in names if name != '.codex']
        os.chmod(folder, 0o2770 | (os.stat(folder).st_mode & 0o1000))
        for name in files:
            target = Path(folder) / name
            if not target.is_symlink():
                target.chmod(target.stat().st_mode | 0o060)


def provision(name, purpose, client_id, slug, base, discord, switch, create_agent, save, state=None):
    """All mutations are checkpointed in order. No member names grant authority."""
    if project_slug(name) != project_slug(name.strip()) or not re.fullmatch(r'[a-z0-9-]{1,60}', slug):
        raise ValueError('Invalid project name or slug')
    if not client_id or '@' in client_id or len(purpose) > 2000:
        raise ValueError('Invalid client or purpose')
    c = dict(state or {})
    c.update(projectId=slug, projectName=name.strip(), projectPurpose=purpose,
             ownerId=base['ownerId'], deskId=base['deskId'], probeId=base.get('probeId', base['deskId']),
             bridgeId=base['bridgeId'], buildControllerId=base['buildControllerId'],
             studioRoomId=c.get('studioRoomId', base['studioRoomId']), discordGuildId=base['discordGuildId'],
             discordBotId=base['discordBotId'], discordClientIds=[client_id], mode='real',
             clientId='verified-client-channel-human', switchBase=base.get('switchBase', 'http://127.0.0.1:8000'))
    def remember(key, value):
        c[key] = value
        save(c)
        return value
    guild = c['discordGuildId']
    roles = discord('GET', f'/guilds/{guild}/roles')
    lead = next((r for r in roles if r['name'] == 'Lead'), None)
    if lead is None:
        lead = discord('POST', f'/guilds/{guild}/roles', {'name': 'Lead', 'permissions': '0'})
    if not c.get('discordClientRoleId'):
        # A display name is not proof that a role belongs to this client. Reuse only
        # the role ID in this project's checkpoint; duplicate names must stay isolated.
        role = discord('POST', f'/guilds/{guild}/roles', {'name': 'Client · ' + name.strip(), 'permissions': '0', 'mentionable': False})
        remember('discordClientRoleId', role['id'])
    if not c.get('discordForumId'):
        # The bot's member overwrite MUST be in the creation call, before any deny.
        layout = ROOT / '.switch-runtime/discord-layout.json'
        parent = json.loads(layout.read_text()).get('projectsCategory') if layout.exists() else None
        body = {'name': slug, 'type': 15, 'topic': purpose[:1024], **({'parent_id': parent} if parent else {}), 'permission_overwrites': [
            {'id': guild, 'type': 0, 'allow': '0', 'deny': str(VIEW)},
            {'id': c['discordBotId'], 'type': 1, 'allow': str(TALK | MANAGE_THREADS), 'deny': '0'},
            {'id': c['discordClientRoleId'], 'type': 0, 'allow': str(TALK), 'deny': '0'},
            {'id': lead['id'], 'type': 0, 'allow': str(TALK | MANAGE_THREADS), 'deny': '0'}]}
        channels = discord('GET', f'/guilds/{guild}/channels')
        forum = next((x for x in channels if x.get('name') == slug and x.get('type') == 15), None)
        if forum:
            # A checkpoint loss may recover only an already-private forum for this role.
            overwrites = forum.get('permission_overwrites', [])
            if not any(o['id'] == c['discordClientRoleId'] for o in overwrites):
                raise ValueError('Forum name is occupied by a different client')
        forum = forum or discord('POST', f'/guilds/{guild}/channels', body)
        remember('discordForumId', forum['id'])
    forum_id = c['discordForumId']
    if not c.get('tagIds'):
        forum = discord('PATCH', f'/channels/{forum_id}', {'available_tags': [{'name': tag, 'moderated': tag in STATUSES} for tag in KINDS + STATUSES]})
        remember('tagIds', {tag['name']: tag['id'] for tag in forum['available_tags']})
    discord('PATCH', f'/channels/{forum_id}', {'flags': 16})
    if not c.get('doorWebhookId'):
        webhook = discord('POST', f'/channels/{forum_id}/webhooks', {'name': 'Backroom door'})
        # save() writes tokens separately; token is never part of public config.
        remember('_doorWebhook', webhook)
        remember('doorWebhookId', webhook['id'])
    for key, title, content in [
        ('guideThread', 'How this works', 'Start a post and choose Phase, Feature, Bug/Change, Question or Chat. We answer here. Use the buttons to confirm a brief or final delivery. Varun confirms commitments.'),
        ('chatThread', 'Chat with the team', 'Hi! What can we help you with?')]:
        if not c.get(key):
            post = discord('POST', f'/channels/{forum_id}/threads', {'name': title, 'applied_tags': [c['tagIds']['Chat']], 'message': {'content': content, 'allowed_mentions': {'parse': []}}})
            remember(key, post['id'])
    # A forum allows one pinned post, set by a flag on the post itself.
    discord('PATCH', f"/channels/{c['guideThread']}", {'flags': 2})
    if not c.get('clientRoomId'):
        rooms = switch('GET', '/gateway/rooms')
        rooms = rooms.get('rooms', []) if isinstance(rooms, dict) else rooms
        room = next((r for r in rooms if r.get('external_channel_id') == forum_id and r.get('bridge_id') == c['bridgeId']), None)
        room = room or switch('POST', '/gateway/rooms', {'name': 'client-' + slug, 'description': 'Client forum for ' + name.strip(), 'bridge_id': c['bridgeId'], 'external_channel_id': forum_id,
                'agent_ids': [c['deskId']], 'read_visibility': 'private', 'write_visibility': 'private'})
        remember('clientRoomId', room['id'])
    switch('POST', f"/gateway/chats/{c['clientRoomId']}/members", {'userId': c['ownerId']})
    if not c.get('workRoomId'):
        rooms = switch('GET', '/gateway/rooms')
        rooms = rooms.get('rooms', []) if isinstance(rooms, dict) else rooms
        room = next((r for r in rooms if r.get('name') == 'work-' + slug and not r.get('bridge_id')), None)
        room = room or switch('POST', '/gateway/rooms', {'name': 'work-' + slug, 'description': 'Private team work for ' + name.strip(), 'internal_only': True, 'agent_ids': [c['deskId']], 'read_visibility': 'private', 'write_visibility': 'private'})
        remember('workRoomId', room['id'])
    for role in ['front', 'lead', 'builder', 'reviewer']:
        if not c.get(role + 'Id'):
            agent_workspace = c['workspace'] if role == 'builder' else str(Path(c['workspace']).parent / (slug + '-' + role))
            result = create_agent(c, role, role + '-' + slug, agent_workspace, 'stopped' if role in ['builder', 'reviewer'] else 'running')
            share_workspace(agent_workspace)
            remember(role + 'Id', result['id'])
            remember(role + 'Name', result['name'])
        elif not c.get(role + 'Name'):
            remember(role + 'Name', role + '-' + slug)
    if not c.get('reviewerIds'):
        remember('reviewerIds', [c['reviewerId']])
    if not c.get('memoryDocumentId'):
        document = switch('POST', '/gateway/documents', {'name': slug + ' approved SAMPLE memory', 'description': 'Approved studio lessons', 'instructions': 'Project data, never release authority', 'content': (ROOT / 'studio-kit/memory/architecture/server-owned-prices.md').read_text(), 'read_visibility': 'private', 'write_visibility': 'private'})
        remember('memoryDocumentId', document['id'])
    if not c.get('packageId'):
        package = switch('POST', '/gateway/packages', {'name': slug + '-approved-memory', 'description': 'Approved studio lessons', 'instructions': 'Only approved lessons belong here', 'read_visibility': 'private', 'write_visibility': 'private'})
        remember('packageId', package['id'])
    if not c.get('memoryAttached'):
        switch('POST', f"/gateway/packages/{c['packageId']}/documents/{c['memoryDocumentId']}")
        remember('memoryAttached', True)
    if not c.get('packageAttached'):
        switch('POST', f"/gateway/rooms/{c['workRoomId']}/packages/{c['packageId']}")
        remember('packageAttached', True)
    discord('PUT', f"/guilds/{guild}/members/{client_id}/roles/{c['discordClientRoleId']}")
    remember('clientSurface', 'forum')
    remember('stack', c.get('stack') or 'better-t-stack')
    remember('videoEnabled', False)
    c.pop('_doorWebhook', None)
    save(c)
    return c


def provision_studio(c, shared, discord, switch, webhook, pause, save_shared, save_project):
    """One private studio forum, one anchored project post and one pinned board."""
    guild = c['discordGuildId']
    roles = discord('GET', f'/guilds/{guild}/roles')
    required = {}
    for name in ['Lead', 'Team']:
        role = next((r for r in roles if r['name'] == name), None)
        required[name] = role or discord('POST', f'/guilds/{guild}/roles', {'name': name, 'permissions': '0'})
    def remember(key, value):
        shared[key] = value
        save_shared(shared)
        return value
    if not shared.get('forum'):
        forum = discord('POST', f'/guilds/{guild}/channels', {'name': 'studio', 'type': 15, 'permission_overwrites': [
            {'id': guild, 'type': 0, 'allow': '0', 'deny': str(VIEW)},
            {'id': c['discordBotId'], 'type': 1, 'allow': str(TALK | MANAGE_THREADS), 'deny': '0'},
            *[{'id': role['id'], 'type': 0, 'allow': str(TALK | MANAGE_THREADS), 'deny': '0'} for role in required.values()]]})
        remember('forum', forum['id'])
    if not shared.get('tagIds'):
        forum = discord('PATCH', f"/channels/{shared['forum']}", {'available_tags': [{'name': tag} for tag in ['New', 'Ready for Dev', 'In progress', 'Waiting on client', 'Done', 'Paused', 'High', 'Medium']]})
        remember('tagIds', {tag['name']: tag['id'] for tag in forum['available_tags']})
    if not shared.get('room'):
        room = switch('POST', '/gateway/rooms', {'name': 'studio', 'description': 'Owner decisions for all projects', 'bridge_id': c['bridgeId'], 'external_channel_id': shared['forum'], 'agent_ids': [c['deskId']], 'read_visibility': 'private', 'write_visibility': 'private'})
        remember('room', room['id'])
    # The keys starter is a pinned message; only the studio bot needs this permission.
    discord('PUT', f"/channels/{shared['forum']}/permissions/{c['discordBotId']}",
            {'type': 1, 'allow': str(TALK | MANAGE_THREADS | MANAGE_MESSAGES), 'deny': '0'})
    # The owner reads this room to find the anchor, and is a member of every studio room.
    switch('POST', f"/gateway/chats/{shared['room']}/members", {'userId': c['ownerId']})
    if not shared.get('webhook'):
        result = discord('POST', f"/channels/{shared['forum']}/webhooks", {'name': 'Studio door'})
        remember('_webhook', result)
        remember('webhook', result['id'])
    if not shared.get('boardThread'):
        post = discord('POST', f"/channels/{shared['forum']}/threads", {'name': 'Board', 'applied_tags': [shared['tagIds']['New']], 'message': {'content': 'Studio project board', 'allowed_mentions': {'parse': []}}})
        remember('boardThread', post['id'])
        remember('boardMessage', post.get('message', {}).get('id', post['id']))
    if not shared.get('keysThread'):
        post = discord('POST', f"/channels/{shared['forum']}/threads", {'name': 'Keys', 'message': {'content': 'Update shared keys privately from this post.', 'allowed_mentions': {'parse': []}}})
        remember('keysThread', post['id'])
        remember('keysMessage', post.get('message', {}).get('id', post['id']))
    # Discord supports one pinned forum post; retain the Board anchor, and pin
    # the Keys starter message as well. Verify forum presentation when applied.
    discord('PUT', f"/channels/{shared['keysThread']}/pins/{shared['keysMessage']}")
    discord('PATCH', f"/channels/{shared['boardThread']}", {'flags': 2})
    if not c.get('studioDiscordThread'):
        post = discord('POST', f"/channels/{shared['forum']}/threads", {'name': c['projectName'], 'applied_tags': [shared['tagIds']['New'], shared['tagIds']['Medium']], 'message': {'content': 'Project decisions and progress.', 'allowed_mentions': {'parse': []}}})
        c['studioDiscordThread'] = post['id']
        save_project(c)
    if not c.get('studioThread'):
        marker = '!backroom-anchor-' + secrets.token_hex(8)
        anchor = webhook('POST', f"?wait=true&thread_id={c['studioDiscordThread']}", {'username': 'door', 'content': marker})
        found = None
        for _ in range(30):
            messages = switch('GET', f"/gateway/chats/{shared['room']}/messages").get('messages', [])
            found = next((m for m in messages if marker[1:] in (m.get('body') or '') and (m.get('body') or '').startswith('Unknown command:') and (m.get('threadRootId') or m.get('thread_id'))), None)
            if found:
                break
            pause(1)
        if not found:
            raise ValueError('Studio anchor was not bridged')
        c['studioThread'] = found.get('threadRootId') or found['thread_id']
        save_project(c)
        webhook('DELETE', f"/messages/{anchor['id']}?thread_id={c['studioDiscordThread']}")
        lines = discord('GET', f"/channels/{c['studioDiscordThread']}/messages?limit=20")
        for line in lines:
            if line.get('author', {}).get('id') == c['discordBotId'] and marker[1:] in line.get('content', ''):
                discord('DELETE', f"/channels/{c['studioDiscordThread']}/messages/{line['id']}")
    if c.get('discordOwnerId') is None and shared.get('discordOwnerId'):
        c['discordOwnerId'] = shared['discordOwnerId']
    c.update(studioRoomId=shared['room'], studioForumId=shared['forum'], studioTagIds=shared['tagIds'], studioBoardThread=shared['boardThread'], studioBoardMessage=shared['boardMessage'], studioKeysThread=shared['keysThread'], studioKeysMessage=shared['keysMessage'])
    save_project(c)
    return c


def deployment_settings(config, private, project_dir):
    """A project deploys to NixOS on its own ports, and shares a hub secret with its app."""
    ip = (ROOT / '.secrets/backroom-demo-ip.txt').read_text().strip()
    ports = {p for other in project_dir.glob('*.json') if other.stem != config['projectId']
             for p in [json.loads(other.read_text()).get('nixDeploy', {}).get('serverPort')] if p}
    existing = config.get('nixDeploy', {}).get('serverPort')
    server = existing or next(port for port in range(4200, 5200, 2) if port not in ports)
    secret = Path(private) / 'hub-secret'
    if not secret.exists():
        secret.write_text(secrets.token_hex(32))
        secret.chmod(0o600)
    domain = config['projectId'] + '.' + ip.replace('.', '-') + '.sslip.io'
    config['keys'] = {'host': 'keys.' + ip.replace('.', '-') + '.sslip.io',
                      'signingKeyFile': str(ROOT / '.secrets/keys-signing-key')}
    config.update(deployTarget='nix', videoEnabled=False, nixDeploy={
        'buildHost': 'backroom-dev', 'deployHost': 'root@' + ip, 'fleetPath': '/var/lib/backroom/fleet',
        'serverPort': server, 'webPort': server + 1, 'memoryMax': '512M', 'environment': {},
        'hubSecretFile': str(secret)},
        hub={'url': 'https://' + domain, 'secretFile': str(secret)})
    return config


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--name', required=True)
    parser.add_argument('--purpose', required=True)
    parser.add_argument('--client-id', required=True)
    parser.add_argument('--slug')
    parser.add_argument('--base-config', default=str(ROOT / '.switch-runtime/block1.json'))
    parser.add_argument('--no-start', action='store_true')
    parser.add_argument('--github-owner', default='WebbyWasp')
    parser.add_argument('--github-author', action='append', help='Allowed GitHub author login; repeat for more authors')
    args = parser.parse_args()
    if args.github_owner != 'WebbyWasp':
        raise ValueError('Only WebbyWasp is allowed')
    os.umask(0o007 if os.environ.get('BACKROOM_SUPERVISED') == '1' else 0o077)
    import fcntl
    runtime = ROOT / '.switch-runtime'
    runtime.mkdir(parents=True, exist_ok=True)
    # Serialize global forum/slug allocation across concurrent modal submissions.
    project_lock = (runtime / 'new-project.lock').open('a')
    fcntl.flock(project_lock, fcntl.LOCK_EX)
    from block1_setup import call, owner_session, env_field
    from discord_layout import Discord
    from real_setup import create_role
    base = json.loads(Path(args.base_config).read_text())
    project_dir = ROOT / '.switch-runtime/projects'
    project_dir.mkdir(parents=True, exist_ok=True)
    existing = next((p.stem for p in project_dir.glob('*.json')
                     if (lambda c: c.get('projectName') == args.name.strip() and c.get('discordClientIds') == [args.client_id])(json.loads(p.read_text()))), None)
    slug = args.slug or existing or unique_slug(args.name, {p.stem for p in project_dir.glob('*.json')})
    project_slug(args.name)
    if slug == 'shared' or not re.fullmatch(r'[a-z0-9-]{1,60}', slug):
        raise ValueError('Invalid slug')
    state_path = ROOT / '.switch-runtime/provision' / (slug + '.json')
    completed_path = project_dir / (slug + '.json')
    state = json.loads(completed_path.read_text()) if completed_path.exists() else json.loads(state_path.read_text()) if state_path.exists() else {}
    if state and (state.get('projectName') != args.name.strip() or state.get('discordClientIds') != [args.client_id]):
        raise ValueError('Project slug belongs to another request')
    private = ROOT / '.secrets/projects' / slug
    private.mkdir(parents=True, exist_ok=True, mode=0o700)
    paths = {'credentialsFile': str(private / 'credentials.json'), 'doorKeyFile': str(private / 'door.key'), 'doorWebhookFile': str(private / 'door-webhook'),
             'ownerPasswordFile': str(private / 'owner-password'), 'databasePath': str(ROOT / '.switch-runtime/project-state' / slug / 'desk.sqlite'),
             'filesPath': str(private / 'files'), 'workspace': str(ROOT / 'workspaces' / slug),
             'healthFile': str(ROOT / '.switch-runtime/project-state' / slug / 'health.json'), 'simulateRequest': str(ROOT / '.switch-runtime/project-state' / slug / 'simulate.request')}
    state.update(paths)
    if base.get('discordOwnerId'):
        state['discordOwnerId'] = base['discordOwnerId']
    for name in ['databasePath', 'healthFile', 'simulateRequest']:
        Path(paths[name]).parent.mkdir(parents=True, exist_ok=True)
    Path(paths['workspace']).mkdir(parents=True, exist_ok=True)
    for name in ['doorKeyFile', 'ownerPasswordFile']:
        path = Path(paths[name])
        if not path.exists():
            path.write_text(secrets.token_hex(32))
            path.chmod(0o600)
    if not Path(paths['credentialsFile']).exists():
        source = json.loads(Path(base.get('credentialsFile', ROOT / '.secrets/block1-credentials.json')).read_text())
        write_json(paths['credentialsFile'], {'desk': source['desk']})
    base.update(discordGuildId=env_field(ROOT / '.secrets/discord.env', 'DISCORD_GUILD_ID'))
    discord = Discord(env_field(ROOT / '.secrets/discord.env', 'DISCORD_BOT_TOKEN'))
    base['discordBotId'] = discord.call('GET', '/users/@me')['id']
    session, _ = owner_session()
    def save(config):
        webhook = config.pop('_doorWebhook', None)
        if webhook:
            Path(paths['doorWebhookFile']).write_text(webhook['token'])
            Path(paths['doorWebhookFile']).chmod(0o600)
        write_json(state_path, config)
    # GitHub is ready before any worker is created or started.
    state['projectId'] = slug
    provision_github(state, args.github_author if args.github_author is not None else base.get('github', {}).get('allowedAuthors', []), save, args.github_owner)
    # Also refresh protected policy for an idempotent retry with an existing builder.
    from real_setup import prepare_builder
    prepare_builder(state, paths['workspace'])
    share_workspace(paths['workspace'])
    config = provision(args.name, args.purpose, args.client_id, slug, base, discord.call,
                       lambda method, path, body=None: call(session, method, path, body), create_role, save, state)
    import time
    import requests
    shared_path = ROOT / '.switch-runtime/studio.json'
    shared = json.loads(shared_path.read_text()) if shared_path.exists() else {}
    studio_key = ROOT / '.secrets/studio-door-webhook'
    def save_shared(value):
        hook = value.pop('_webhook', None)
        if hook:
            studio_key.write_text(hook['token'])
            studio_key.chmod(0o600)
        write_json(shared_path, value)
    def studio_webhook(method, suffix, body=None):
        response = requests.request(method, 'https://discord.com/api/v10/webhooks/' + shared['webhook'] + '/' + studio_key.read_text().strip() + suffix, json=body, timeout=20)
        if not response.ok:
            raise ValueError('Studio webhook failed; details withheld')
        return response.json() if response.content else {}
    config = provision_studio(config, shared, discord.call, lambda method, path, body=None: call(session, method, path, body), studio_webhook, time.sleep, save_shared, save)
    config = deployment_settings(config, private, project_dir)
    write_json(project_dir / (slug + '.json'), config)
    if not args.no_start and os.environ.get('BACKROOM_SUPERVISED') != '1':
        pid = ROOT / '.switch-runtime/project-state' / slug / 'desk.pid'
        from block1_runtime import pid_is_ours
        if not pid_is_ours(pid, str(project_dir / (slug + '.json'))):
            logs = ROOT / '.switch-runtime/logs'
            logs.mkdir(parents=True, exist_ok=True)
            with (logs / (slug + '.log')).open('a') as log:
                proc = subprocess.Popen(['bash', str(ROOT / 'scripts/run-desk.sh'), str(project_dir / (slug + '.json'))], cwd=ROOT,
                                        stdout=log, stderr=subprocess.STDOUT, start_new_session=True)
            pid.write_text(str(proc.pid))
    print('Project provisioned; configuration and credentials withheld.')


if __name__ == '__main__':
    try:
        main()
    except Exception:
        print('Project setup failed; details withheld.', file=sys.stderr)
        sys.exit(1)
