"""Compare selected known credential fields without outputting their values."""
from pathlib import Path
import re
from block1_setup import ROOT,PRIVATE,private_field,env_field

fields={
    'DISCORD_BOT_TOKEN':env_field(ROOT/'.secrets/discord.env','DISCORD_BOT_TOKEN'),
    'GATEWAY_ADMIN_PASSWORD':env_field(ROOT/'.secrets/switch.env','GATEWAY_ADMIN_PASSWORD'),
    'AGENT_REGISTRATION_TOKEN':env_field(ROOT/'.secrets/switch.env','AGENT_REGISTRATION_TOKEN'),
    'SECRET_KEYS':env_field(ROOT/'.secrets/switch.env','SECRET_KEYS'),
    'desk.api_key':private_field(PRIVATE,'desk','api_key'),
    'probe.api_key':private_field(PRIVATE,'probe','api_key'),
    'controller_enrollment_code':private_field(PRIVATE,'controller_enrollment_code'),
    'lead_owner.password':private_field(ROOT/'.secrets/spike-state.json','isolated_owner','password')}
files=list((ROOT/'scripts').glob('*.py'))+list((ROOT/'scripts').glob('*.sh'))
files += [ROOT/'desk/src'/name for name in ('switch-transport.ts','switch-identities.ts','visible-loop.ts','main.ts')]
files += [ROOT/'desk/tests/switch.test.ts',ROOT/'desk/README.md',ROOT/'.switch-runtime/try-it.pending.md',ROOT/'.switch-runtime/block-1.pending.md']
hits=[]
for file in files:
    text=file.read_text()
    for name,value in fields.items():
        if value and value in text:hits.append((file.name,name))
    if re.search(r'\beyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}',text):hits.append((file.name,'JWT-shaped string'))
print('Selected credential fields checked:',len(fields))
print('Source/pending-report files checked:',len(files))
print('Credential matches:',len(hits))
for file,name in hits:print('Match requires removal; file='+file+'; field='+name)
print('Credential values printed: 0')
raise SystemExit(1 if hits else 0)
