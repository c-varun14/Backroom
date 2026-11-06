"""Offline provisioning contract: no Discord, Switch, agents or credential reads."""
import importlib.util
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('new_project', Path(__file__).resolve().parents[1] / 'new_project.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class ProvisionTests(unittest.TestCase):
    def test_order_permissions_and_rerun(self):
        with tempfile.TemporaryDirectory(prefix='backroom-provision-') as directory:
            root = Path(directory)
            lesson = root / 'studio-memory/architecture/server-owned-prices.md'
            lesson.parent.mkdir(parents=True)
            lesson.write_text('SAMPLE approved lesson')
            original = module.ROOT
            module.ROOT = root
            try:
                calls, agents, snapshots = [], [], []
                def discord(method, path, body=None):
                    calls.append(('discord', method, path, body))
                    if path.endswith('/roles') and method == 'GET':
                        return [{'name': 'Lead', 'id': 'lead-role'}, {'name': 'Client · Sample Bakery', 'id': 'another-client-role'}]
                    if path.endswith('/channels') and method == 'GET':
                        return []
                    if body and 'available_tags' in body:
                        return {'available_tags': [{'name': t['name'], 'id': str(i)} for i, t in enumerate(body['available_tags'])]}
                    if path.endswith('/webhooks'):
                        return {'id': 'hook', 'token': 'SAMPLE-webhook'}
                    return {'id': 'resource-' + str(len(calls))}
                def switch(method, path, body=None):
                    calls.append(('switch', method, path, body))
                    if method == 'GET':
                        return []
                    return {'id': 'switch-' + str(len(calls))}
                def agent(c, role, name, directory, desired):
                    agents.append((role, desired, c['workRoomId']))
                    return {'id': role, 'name': name}
                def save(c):
                    c.pop('_doorWebhook', None)
                    snapshots.append(dict(c))
                base = {'ownerId': 'owner', 'deskId': 'desk', 'bridgeId': 'bridge', 'buildControllerId': 'controller', 'studioRoomId': 'studio', 'discordGuildId': 'guild', 'discordBotId': 'bot'}
                state = {'workspace': str(root / 'workspace')}
                result = module.provision('Sample Bakery', 'SAMPLE pickup ordering', 'client', 'sample-bakery', base, discord, switch, agent, save, state)
                forum = next(body for service, method, path, body in calls if service == 'discord' and path.endswith('/channels') and method == 'POST')
                self.assertEqual(forum['type'], 15)
                self.assertTrue(any(o['id'] == 'bot' and o['type'] == 1 for o in forum['permission_overwrites']))
                self.assertTrue(any(o['id'] == 'guild' and int(o['deny']) & module.VIEW for o in forum['permission_overwrites']))
                bridged = next(body for service, method, path, body in calls if service == 'switch' and method == 'POST' and body and body.get('external_channel_id'))
                self.assertEqual(bridged['agent_ids'], ['desk'])
                self.assertNotIn('channel_type', bridged)
                self.assertEqual([a[:2] for a in agents], [('front', 'running'), ('lead', 'running'), ('builder', 'stopped'), ('reviewer', 'stopped')])
                self.assertEqual(result['clientSurface'], 'forum')
                self.assertNotEqual(result['discordClientRoleId'], 'another-client-role')
                count = len(calls)
                module.provision('Sample Bakery', 'SAMPLE pickup ordering', 'client', 'sample-bakery', base, discord, switch, agent, save, result)
                self.assertFalse(any(method == 'POST' and path.endswith(('/channels', '/rooms', '/threads', '/roles', '/webhooks')) for _, method, path, _ in calls[count:]))
            finally:
                module.ROOT = original

    def test_studio_anchor_and_board(self):
        calls, shared, captured = [], {}, {}
        c = {'ownerId': 'owner', 'discordGuildId': 'guild', 'discordBotId': 'bot', 'bridgeId': 'bridge', 'deskId': 'desk', 'projectName': 'Sample Project'}
        def discord(method, path, body=None):
            calls.append((method, path, body))
            if method == 'GET' and path.endswith('/roles'):
                return [{'name': 'Lead', 'id': 'lead'}, {'name': 'Team', 'id': 'team'}]
            if body and 'available_tags' in body:
                return {'available_tags': [{'name': t['name'], 'id': 'tag' + str(i)} for i, t in enumerate(body['available_tags'])]}
            if path.endswith('/webhooks'):
                return {'id': 'hook', 'token': 'SAMPLE-webhook'}
            if method == 'GET':
                return [{'id': 'bot-line', 'author': {'id': 'bot'}, 'content': 'Unknown command: ' + captured['marker']}]
            return {'id': 'resource' + str(len(calls))}
        def switch(method, path, body=None):
            if method == 'GET':
                return {'messages': [{'body': 'Unknown command: ' + captured['marker'], 'thread_id': 'switch-studio-T'}]}
            return {'id': 'studio-room'}
        def webhook(method, path, body=None):
            if body:
                captured['marker'] = body['content']
            return {'id': 'anchor'}
        def save_shared(value):
            value.pop('_webhook', None)
        result = module.provision_studio(c, shared, discord, switch, webhook, lambda _: None, save_shared, lambda _: None)
        self.assertEqual(result['studioThread'], 'switch-studio-T')
        self.assertEqual(result['studioRoomId'], 'studio-room')
        self.assertIn('studioBoardMessage', result)
        forum = next(body for method, path, body in calls if method == 'POST' and path.endswith('/channels'))
        self.assertEqual({o['id'] for o in forum['permission_overwrites']}, {'guild', 'bot', 'lead', 'team'})

    def test_names(self):
        for bad in ['', '   ', '@everyone']:
            with self.assertRaises(ValueError):
                module.project_slug(bad)
        self.assertEqual(module.unique_slug('Sample Bakery', {'sample-bakery'}), 'sample-bakery-2')


if __name__ == '__main__':
    unittest.main()
