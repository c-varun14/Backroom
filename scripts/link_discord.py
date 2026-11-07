"""Human-selected Switch identity claim. Never operates a Discord user account."""
import json
import re
import requests
from block1_setup import ROOT,PUBLIC,owner_session,call,env_field,SetupError

try:
    user_id=input('Paste YOUR Discord User ID (not the client account ID): ').strip()
    if not re.fullmatch(r'[0-9]{17,22}',user_id):raise SetupError('Expected a Discord User ID')
    token=env_field(ROOT/'.secrets/discord.env','DISCORD_BOT_TOKEN')
    guild=env_field(ROOT/'.secrets/discord.env','DISCORD_GUILD_ID')
    r=requests.get(f'https://discord.com/api/v10/guilds/{guild}/members/{user_id}',headers={'Authorization':'Bot '+token},timeout=20)
    if not r.ok:raise SetupError('That member could not be checked in this server; response withheld')
    member=r.json()['user']
    if member.get('bot'):raise SetupError('A bot cannot be linked as Varun')
    print('Discord account found: '+member['username'])
    if input('Confirm this is YOUR own account, not the client. Type LINK: ').strip()!='LINK':
        print('No identity was linked.');raise SystemExit(0)
    config=json.loads(PUBLIC.read_text());admin,_=owner_session()
    call(admin,'POST',f'/gateway/collaborations/{config["bridgeId"]}/identities',{'external_user_id':user_id,'username':member['username']})
    config['discordOwnerId'] = user_id
    PUBLIC.write_text(json.dumps(config, indent=2) + '\n')
    print('Your selected account is linked to the desk owner. No Discord user message or approval was sent.')
except SetupError as error:
    print(str(error));raise SystemExit(1)
except Exception:
    print('Linking did not complete; raw response/exception withheld.');raise SystemExit(1)
