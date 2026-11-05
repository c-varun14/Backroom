"""Create only two bounded throwaway provider agents; no product code."""
from common import ROOT, load, save, owner_api, show

state = load()
api, _ = owner_api()
instructions = '''This is a tiny Block 0 integration test, not product work. Never read or write files, invoke shell, browse, access other projects, credentials, or containers, or create agents. Use only Switch room messaging tools. No implementation. Stay concise. Do not respond to unaddressed conversation. Never use another model or delegate to subagents. Once you send your required message, stop; no follow-up or acknowledgement loop.'''
definitions = {
    'switch-claude': {'provider': 'claude', 'model': 'sonnet', 'advanced_config': {'maxTurns': 6, 'effort': 'low', 'disallowedTools': ['Bash', 'Read', 'Write', 'Edit', 'Glob', 'Grep', 'Agent', 'WebSearch', 'WebFetch']}, 'instructions': instructions + ' When asked to perform the handoff, use send_targeted_message targeting switch-codex with the exact text: SAMPLE handoff: compute 2+2 and post exactly SAMPLE FOUR. Do this once, then stop. Do not acknowledge any response.'},
    'switch-codex': {'provider': 'codex', 'model': 'gpt-6.1-sol', 'advanced_config': {'effort': 'low', 'verbosity': 'low', 'webSearch': 'false'}, 'instructions': instructions + ' When switch-claude asks you to compute 2+2, call post_message with exactly SAMPLE FOUR, no mentions, then stop. Use only gpt-6.1-sol.'}
}
for name, definition in definitions.items():
    directory = ROOT / 'spikes/providers' / name
    directory.mkdir(parents=True, exist_ok=True)
    definition.update(auto_mode=False, auto_approve=False, directory=str(directory), isolation='shared')
    if name not in state:
        r, agent = api.request('POST', '/gateway/management/agents', {'name': name, 'description': 'SAMPLE tiny Block 0 provider test', 'controller_id': state['controller_id'], 'desired_state': 'running', 'definition': definition})
        r.raise_for_status()
        state[name] = agent
        save(state)
    else:
        r, agent = api.request('PATCH', '/gateway/management/agents/' + state[name]['agent_id'], {'controller_id': state['controller_id'], 'desired_state': 'running'})
        r.raise_for_status()
        state[name] = agent
        save(state)
    room = state['studio-test']['id']
    r, _ = api.request('POST', f'/gateway/rooms/{room}/agents', {'agent_ids': [state[name]['agent_id']]})
    r.raise_for_status()
print('Only studio-test contains provider agents. Codex model pinned to gpt-6.1-sol; both bypass and auto mode are off. No inference requested yet.')
