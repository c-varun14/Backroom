"""Offline provisioning contract: no Discord, Switch, agents or credential reads."""
import importlib.util
from pathlib import Path
import tempfile
import unittest
from types import SimpleNamespace

spec = importlib.util.spec_from_file_location('new_project', Path(__file__).resolve().parents[1] / 'new_project.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class ProvisionTests(unittest.TestCase):
    def test_github_private_template_empty_rerun_and_owner(self):
        import json
        for has_template in [False, True]:
            with tempfile.TemporaryDirectory(prefix='backroom-github-provision-') as directory:
                calls, saved, repos = [], [], {}
                local_head = False
                if has_template:
                    repos['WebbyWasp/app-base'] = {'full_name': 'WebbyWasp/app-base', 'is_template': True}
                def runner(args, **kwargs):
                    nonlocal local_head
                    calls.append(args)
                    out, code, error = '', 0, ''
                    if args[:2] == ['gh', 'api']:
                        name = args[-1].removeprefix('repos/')
                        if name in repos:
                            out = json.dumps(repos[name])
                        else:
                            code, error = 1, 'Not Found (HTTP 404)'
                    elif args[:3] == ['gh', 'repo', 'create']:
                        repos[args[3]] = {'full_name': args[3], 'private': True, 'size': 0}
                    elif '--show-toplevel' in args:
                        out = directory
                    elif args[:3] == ['git', 'ls-remote', '--heads']:
                        if has_template or repos.get('WebbyWasp/sample-bakery', {}).get('initialized'):
                            out = 'a' * 40 + '\trefs/heads/main'
                    elif args == ['git', 'rev-parse', '--verify', 'HEAD']:
                        code = 0 if local_head else 1
                    elif args == ['git', 'rev-parse', 'HEAD']:
                        out = 'a' * 40
                    elif 'commit' in args:
                        local_head = True
                    elif 'push' in args:
                        repos['WebbyWasp/sample-bakery']['initialized'] = True
                    return SimpleNamespace(returncode=code, stdout=out, stderr=error)
                c = {'projectId': 'sample-bakery', 'workspace': directory}
                result = module.provision_github(c, ['sample-owner'], lambda c: saved.append(dict(c)), runner=runner)
                create = next(a for a in calls if a[:3] == ['gh', 'repo', 'create'])
                self.assertIn('--private', create)
                self.assertEqual('--template' in create, has_template)
                self.assertEqual(any('--allow-empty' in a for a in calls), not has_template)
                self.assertFalse(any('add' in a and 'git' == a[0] and 'remote' not in a for a in calls))
                self.assertEqual(result['github'], {'repo': 'WebbyWasp/sample-bakery', 'allowedAuthors': ['sample-owner']})
                module.provision_github(c, ['sample-owner'], lambda c: None, runner=runner)
                self.assertEqual(sum(a[:3] == ['gh', 'repo', 'create'] for a in calls), 1)
                self.assertTrue(any(a[-2:] == ['origin', 'https://github.com/WebbyWasp/sample-bakery.git'] for a in calls))
                count = len(calls)
                with self.assertRaises(ValueError):
                    module.provision_github(c, [], lambda _: None, owner='someone-else', runner=runner)
                self.assertEqual(len(calls), count)

    def test_github_public_or_template_failure_is_not_empty_repo_fallback(self):
        import json
        for response in [SimpleNamespace(returncode=0, stdout=json.dumps({'full_name': 'WebbyWasp/sample', 'private': False}), stderr=''),
                         SimpleNamespace(returncode=1, stdout='', stderr='SAMPLE permission failure')]:
            with tempfile.TemporaryDirectory(prefix='backroom-github-refusal-') as directory:
                calls = []
                def runner(args, **kwargs):
                    calls.append(args)
                    return response
                with self.assertRaises(ValueError):
                    module.provision_github({'projectId': 'sample', 'workspace': directory}, [], lambda _: None, runner=runner)
                self.assertFalse(any('--private' in a for a in calls))

    def test_order_permissions_and_rerun(self):
        with tempfile.TemporaryDirectory(prefix='backroom-provision-') as directory:
            root = Path(directory)
            lesson = root / 'studio-kit/memory/architecture/server-owned-prices.md'
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
        self.assertEqual(result['studioKeysThread'], shared['keysThread'])
        self.assertEqual(result['studioKeysMessage'], shared['keysMessage'])
        self.assertTrue(any(method == 'PUT' and '/pins/' in path for method, path, _ in calls))
        self.assertTrue(any(method == 'PUT' and '/permissions/bot' in path and int(body['allow']) & module.MANAGE_MESSAGES for method, path, body in calls))
        forum = next(body for method, path, body in calls if method == 'POST' and path.endswith('/channels'))
        self.assertEqual({o['id'] for o in forum['permission_overwrites']}, {'guild', 'bot', 'lead', 'team'})

    def test_names(self):
        for bad in ['', '   ', '@everyone']:
            with self.assertRaises(ValueError):
                module.project_slug(bad)
        self.assertEqual(module.unique_slug('Sample Bakery', {'sample-bakery'}), 'sample-bakery-2')


if __name__ == '__main__':
    unittest.main()
