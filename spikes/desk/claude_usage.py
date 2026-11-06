"""Read only quota and Extra Usage state using the existing Claude plan login."""
import json
import os
from pathlib import Path
import requests

assert not os.environ.get('ANTHROPIC_API_KEY')
assert not os.environ.get('OPENAI_API_KEY')
auth = json.loads(Path.home() / '.claude/.credentials.json'.read_text())['claudeAiOauth']
r = requests.get('https://api.anthropic.com/api/oauth/usage', headers={'Authorization': 'Bearer ' + auth['accessToken'], 'anthropic-beta': 'oauth-2025-04-20'}, timeout=20)
print('GET https://api.anthropic.com/api/oauth/usage HTTP', r.status_code, '(credential header withheld)')
if r.status_code == 200:
    data = r.json()
    allowed = ('five_hour','seven_day','seven_day_sonnet','seven_day_opus','extra_usage')
    selected = {k: {field:v for field,v in value.items() if field in ('utilization','resets_at','is_enabled','monthly_limit','used_credits')} if isinstance(value,dict) else value for k,value in data.items() if k in allowed}
    print(json.dumps(selected,indent=2))
else:
    print('Quota and paid-overage state could not be verified by this read-only endpoint. No raw error body printed.')
