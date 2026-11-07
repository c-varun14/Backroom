import {mkdirSync,writeFileSync,readdirSync,rmSync,chownSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
process.umask(0o077);
for(const name of readdirSync('/state'))rmSync('/state/'+name,{recursive:true,force:true});
mkdirSync('/state/home',{recursive:true});
const random=()=>randomBytes(32).toString('hex');
const env={DB_HOST:'postgres',DB_PORT:'5432',DB_OWNER_USER:'judge_owner',DB_OWNER_PASSWORD:random(),DB_USER:'judge_app',DB_PASSWORD:random(),DB_NAME:'judge_switch',
 ID_SERVER_NAME:'localhost',MATRIX_SERVER_NAME:'localhost',AGENT_REGISTRATION_TOKEN:random(),SECRET_KEYS:'judge:'+random(),JWT_SECRET_KEY:random(),
 GATEWAY_ADMIN_EMAIL:'admin@judge.example.test',GATEWAY_ADMIN_PASSWORD:random(),GATEWAY_COOKIE_SECURE:'false',AGENT_MANAGEMENT_ENABLED:'false',
 FRONTEND_BASE_URL:'http://127.0.0.1:49162',GATEWAY_PUBLIC_URL:'http://127.0.0.1:49161',TELEMETRY_ENABLED:'false'};
writeFileSync('/state/stack.env',Object.entries(env).map(([k,v])=>`${k}=${v}`).join('\n')+'\n',{mode:0o600});
for(const name of readdirSync('/state'))chownSync('/state/'+name,Number(process.env.DEMO_UID),Number(process.env.DEMO_GID));
console.log('Generated disposable credentials (values withheld).');
