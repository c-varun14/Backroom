"""Lock a client's Discord channels down with roles. Safe to run again.

Order matters: the bot keeps access first, the client gets a role next, and
only then does @everyone lose View. A failure part way leaves people with more
access, never locked out. Uses the bot token from .secrets; never prints it.
"""
import argparse
import json
import sys
import time
from pathlib import Path

import requests

from discord_status import VIEW_CHANNEL, READ_HISTORY, privacy_problems

ROOT = Path(__file__).resolve().parent.parent
API = 'https://discord.com/api/v10'
SEND = 2048
ATTACH = 32768
EMBED = 16384
SEND_IN_THREADS = 1 << 38
TALK = VIEW_CHANNEL | READ_HISTORY | SEND | ATTACH | EMBED | SEND_IN_THREADS


class Discord:
    def __init__(self, token):
        self.headers = {'Authorization': 'Bot ' + token, 'X-Audit-Log-Reason': 'Backroom layout'}

    def call(self, method, path, body=None):
        for _ in range(5):
            response = requests.request(method, API + path, headers=self.headers, json=body, timeout=20)
            if response.status_code == 429:
                time.sleep(float(response.json().get('retry_after', 1)) + 0.2)
                continue
            if not response.ok:
                raise SystemExit(f'Discord refused {method} {path.split("?")[0]}: HTTP {response.status_code}')
            return response.json() if response.content else None
        raise SystemExit('Discord kept rate limiting; try again shortly')


def env():
    pairs = (line.strip().split('=', 1) for line in (ROOT / '.secrets/discord.env').read_text().splitlines() if '=' in line)
    return {key: value.strip('"\'') for key, value in pairs}


def ensure_role(api, guild, roles, name):
    role = next((r for r in roles if r['name'] == name), None)
    if role:
        return role
    role = api.call('POST', f'/guilds/{guild}/roles', {'name': name, 'permissions': '0', 'mentionable': False, 'hoist': False})
    roles.append(role)
    print('Role created: ' + name)
    return role


def give_role(api, guild, member, role):
    if role['id'] in member.get('roles', []):
        return
    api.call('PUT', f"/guilds/{guild}/members/{member['user']['id']}/roles/{role['id']}")
    member.setdefault('roles', []).append(role['id'])
    print(f"Role given: {role['name']} to {member['user']['username']}")


def overwrite(api, channel, target, kind, allow=0, deny=0):
    """Merge into any existing overwrite so unrelated bits are kept."""
    existing = next((o for o in channel.get('permission_overwrites', []) if o['id'] == target), {})
    new_allow = (int(existing.get('allow', 0)) | allow) & ~deny
    new_deny = (int(existing.get('deny', 0)) | deny) & ~allow
    if existing and int(existing['allow']) == new_allow and int(existing['deny']) == new_deny:
        return
    api.call('PUT', f"/channels/{channel['id']}/permissions/{target}", {'type': kind, 'allow': str(new_allow), 'deny': str(new_deny)})


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--client-name', required=True, help='Shown in the role, such as Morrowcrumb')
    parser.add_argument('--client-user', required=True, help='Discord username of the client account')
    parser.add_argument('--config', default=str(ROOT / '.switch-runtime/block1.json'))
    args = parser.parse_args()
    secrets = env()
    guild = secrets['DISCORD_GUILD_ID']
    api = Discord(secrets['DISCORD_BOT_TOKEN'])
    config = json.loads(Path(args.config).read_text())
    client_channel_id, studio_channel_id = config['clientChannelId'], config['studioChannelId']

    info = api.call('GET', f'/guilds/{guild}')
    bot = api.call('GET', '/users/@me')
    members = api.call('GET', f'/guilds/{guild}/members?limit=1000')
    roles = api.call('GET', f'/guilds/{guild}/roles')
    client = next((m for m in members if m['user']['username'] == args.client_user), None)
    if client is None or client['user'].get('bot') or client['user']['id'] == info['owner_id']:
        raise SystemExit('That client account was not found, or it is the owner or a bot')
    owner = next(m for m in members if m['user']['id'] == info['owner_id'])
    bot_role = next(r for r in roles if r.get('tags', {}).get('bot_id') == bot['id'])

    lead = ensure_role(api, guild, roles, 'Lead')
    team = ensure_role(api, guild, roles, 'Team')
    everyone_client = ensure_role(api, guild, roles, 'Client')
    this_client = ensure_role(api, guild, roles, 'Client · ' + args.client_name)
    give_role(api, guild, owner, lead)
    give_role(api, guild, client, everyone_client)
    give_role(api, guild, client, this_client)

    client_channel = api.call('GET', f'/channels/{client_channel_id}')
    studio_channel = api.call('GET', f'/channels/{studio_channel_id}')
    for channel in (client_channel, studio_channel):
        overwrite(api, channel, bot_role['id'], 0, allow=TALK)
        overwrite(api, channel, lead['id'], 0, allow=TALK)
    overwrite(api, client_channel, this_client['id'], 0, allow=TALK)
    overwrite(api, studio_channel, team['id'], 0, allow=TALK)
    for channel in (client_channel, studio_channel):
        fresh = api.call('GET', f"/channels/{channel['id']}")
        overwrite(api, fresh, guild, 0, deny=VIEW_CHANNEL)
        print('Locked: #' + channel['name'])

    channels = [api.call('GET', f'/channels/{c}') for c in (client_channel_id, studio_channel_id)]
    members = api.call('GET', f'/guilds/{guild}/members?limit=1000')
    problems = privacy_problems(channels, members, roles, guild, info['owner_id'], {studio_channel_id})
    if problems:
        print('PRIVACY PROBLEM: ' + '; '.join(problems))
        sys.exit(1)
    print('Privacy check passed: only Lead and Team can see the studio.')


if __name__ == '__main__':
    main()
