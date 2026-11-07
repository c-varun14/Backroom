"""Read-only Discord channel visibility checks; never expose credentials or bodies."""


VIEW_CHANNEL = 1024
READ_HISTORY = 65536


def channel_permissions(channel, member, roles, guild_id):
    """Discord's documented order: base, @everyone, roles, then the member."""
    role_ids = set(member.get('roles', [])) | {guild_id}
    permissions = 0
    for role in roles:
        if role['id'] in role_ids:
            permissions |= int(role['permissions'])
    if permissions & 8:  # Administrator bypasses channel overwrites.
        return VIEW_CHANNEL | READ_HISTORY | permissions
    overwrites = channel.get('permission_overwrites', [])
    everyone = next((o for o in overwrites if o['id'] == guild_id), {})
    permissions = (permissions & ~int(everyone.get('deny', 0))) | int(everyone.get('allow', 0))
    deny = allow = 0
    for overwrite in overwrites:
        if overwrite['id'] in role_ids - {guild_id} and int(overwrite['type']) == 0:
            deny |= int(overwrite.get('deny', 0))
            allow |= int(overwrite.get('allow', 0))
    permissions = (permissions & ~deny) | allow
    personal = next((o for o in overwrites if o['id'] == member['user']['id'] and int(o['type']) == 1), {})
    return (permissions & ~int(personal.get('deny', 0))) | int(personal.get('allow', 0))


def can_read_channel(channel, member, roles, guild_id):
    required = VIEW_CHANNEL | READ_HISTORY
    return channel_permissions(channel, member, roles, guild_id) & required == required


def privacy_problems(channels, members, roles, guild_id, owner_id, studio_ids, studio_roles=('Lead', 'Team')):
    """Names of people who can see a studio channel but should not. Bots are
    checked too, except the bridge bot itself, which must read these rooms."""
    allowed = {r['id'] for r in roles if r.get('name') in studio_roles}
    problems = []
    for channel in channels:
        if channel['id'] not in studio_ids:
            continue
        for member in members:
            user = member['user']
            if user['id'] == owner_id or user.get('bot') or allowed & set(member.get('roles', [])):
                continue
            if channel_permissions(channel, member, roles, guild_id) & VIEW_CHANNEL:
                problems.append(f"{user['username']} can see #{channel['name']}")
    return problems


def discord_visibility(config, token, guild, owner_ids, get=None):
    if get is None:
        import requests
        get = requests.get
    def read(path):
        response = get('https://discord.com/api/v10' + path, headers={'Authorization': 'Bot ' + token}, timeout=20)
        return response.json() if response.ok else None

    bot = read('/users/@me')
    member = read(f'/guilds/{guild}/members/{bot["id"]}') if bot else None
    roles = read(f'/guilds/{guild}/roles') if member else None
    results = []
    owner_seen = False
    for field, name in [('clientChannelId', 'client-client-a'), ('studioChannelId', 'studio-client-a')]:
        channel_id = config[field]
        channel = read('/channels/' + channel_id)
        readable = bool(channel and member and roles and can_read_channel(channel, member, roles, guild))
        page = read(f'/channels/{channel_id}/messages?limit=100') if readable else None
        readable = readable and isinstance(page, list)
        results.append('#' + name + ' bot can read: ' + ('yes' if readable else 'NO: the bot cannot see owner messages here'))
        if field == 'studioChannelId' and readable:
            while page:
                if any(m.get('author', {}).get('id') in owner_ids and not m.get('author', {}).get('bot', False) for m in page):
                    owner_seen = True
                    break
                if len(page) < 100:
                    break
                page = read(f'/channels/{channel_id}/messages?limit=100&before={page[-1]["id"]}')
                if not isinstance(page, list):
                    break
    if roles:
        members = read(f'/guilds/{guild}/members?limit=1000') or []
        info = read(f'/guilds/{guild}') or {}
        studio = read('/channels/' + config['studioChannelId'])
        problems = privacy_problems([studio] if studio else [], members, roles, guild, info.get('owner_id'), {config['studioChannelId']})
        results.append('Studio privacy: ' + ('OK, clients cannot see it' if not problems else 'PROBLEM: ' + '; '.join(problems)))
    return results, owner_seen
