"""Offline checks only: fictional channels, roles and owner IDs."""
import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('discord_status', Path(__file__).parents[1] / 'discord_status.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class DiscordStatusTests(unittest.TestCase):
    def test_permissions_include_role_and_member_overwrites(self):
        roles = [{'id': 'guild', 'permissions': str(1024 | 65536)}, {'id': 'reader', 'permissions': '0'}]
        member = {'user': {'id': 'bot'}, 'roles': ['reader']}
        channel = {'permission_overwrites': [{'id': 'guild', 'type': 0, 'deny': '1024', 'allow': '0'}]}
        self.assertFalse(module.can_read_channel(channel, member, roles, 'guild'))
        channel['permission_overwrites'].append({'id': 'reader', 'type': 0, 'deny': '0', 'allow': '1024'})
        self.assertTrue(module.can_read_channel(channel, member, roles, 'guild'))
        channel['permission_overwrites'].append({'id': 'bot', 'type': 1, 'deny': '65536', 'allow': '0'})
        self.assertFalse(module.can_read_channel(channel, member, roles, 'guild'))
        roles[0]['permissions'] = '8'
        self.assertTrue(module.can_read_channel(channel, member, roles, 'guild'))

    def test_privacy_reports_a_client_who_can_see_the_studio(self):
        roles = [{'id': 'guild', 'name': '@everyone', 'permissions': str(1024)}, {'id': 'lead', 'name': 'Lead', 'permissions': '0'}]
        members = [{'user': {'id': 'owner', 'username': 'owner'}, 'roles': []},
                   {'user': {'id': 'bot', 'username': 'bot', 'bot': True}, 'roles': []},
                   {'user': {'id': 'staff', 'username': 'staff'}, 'roles': ['lead']},
                   {'user': {'id': 'client', 'username': 'client'}, 'roles': []}]
        studio = {'id': 'studio', 'name': 'studio', 'permission_overwrites': [{'id': 'guild', 'type': 0, 'allow': '1024', 'deny': '0'}]}
        self.assertEqual(module.privacy_problems([studio], members, roles, 'guild', 'owner', {'studio'}), ['client can see #studio'])
        studio['permission_overwrites'] = [{'id': 'guild', 'type': 0, 'allow': '0', 'deny': '1024'}]
        self.assertEqual(module.privacy_problems([studio], members, roles, 'guild', 'owner', {'studio'}), [])

    def check_visibility(self, denied=False, owner=True):
        paths = []
        class Response:
            def __init__(self, value, ok=True): self.value, self.ok = value, ok
            def json(self): return self.value
        def get(url, headers, timeout):
            path = url.removeprefix('https://discord.com/api/v10')
            paths.append(path)
            if path == '/users/@me': return Response({'id': 'bot'})
            if path.endswith('/members/bot'): return Response({'user': {'id': 'bot'}, 'roles': []})
            if path.endswith('/roles'): return Response([{'id': 'guild', 'permissions': str(1024 | 65536)}])
            if path == '/channels/studio': return Response({'id': 'studio', 'name': 'studio', 'permission_overwrites': []})
            if path.endswith('/members?limit=1000'): return Response([])
            if path == '/guilds/guild': return Response({'owner_id': 'owner'})
            if path == '/channels/client': return Response({'id': 'client', 'permission_overwrites': []}, not denied)
            if path == '/channels/studio/messages?limit=100': return Response([{'id': 'sample', 'author': {'id': 'owner' if owner else 'client', 'bot': False}}])
            if path == '/channels/client/messages?limit=100': return Response([])
            raise AssertionError('unexpected read')
        lines, seen = module.discord_visibility({'clientChannelId': 'client', 'studioChannelId': 'studio'}, 'SAMPLE-NOT-A-CREDENTIAL', 'guild', {'owner'}, get)
        self.assertEqual(seen, owner)
        self.assertIn('NO: the bot cannot see owner messages here' if denied else 'yes', lines[0])
        self.assertIn('yes', lines[1])
        self.assertNotIn('SAMPLE-NOT-A-CREDENTIAL', '\n'.join(lines))
        return paths

    def test_readable_and_real_owner_seen(self): self.check_visibility()
    def test_blind_client_channel_and_no_owner_message(self): self.check_visibility(denied=True, owner=False)


if __name__ == '__main__': unittest.main()
