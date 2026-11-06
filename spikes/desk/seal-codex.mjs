import {homedir} from 'node:os';
import {join} from 'node:path';
// Give the controller the existing ChatGPT plan login using Switch's released
// sealing protocol. Tokens stay in memory; only ciphertext is written.
import {readFileSync, writeFileSync, chmodSync} from 'node:fs';
import {generateKeyPairSync, createPublicKey, diffieHellman, hkdfSync, randomBytes, createCipheriv} from 'node:crypto';

const machine = JSON.parse(readFileSync('.switch-runtime/controller-public.json', 'utf8'));
const credential = readFileSync(join(homedir(), '.codex/auth.json'), 'utf8');
const auth = JSON.parse(credential);
if (auth.OPENAI_API_KEY || auth.auth_mode !== 'chatgpt') throw new Error('Requires an existing ChatGPT login with no API key');
const controllerPublic = Buffer.from(machine.public_key.key, 'base64');
const {publicKey, privateKey} = generateKeyPairSync('x25519');
const ephemeralPublic = Buffer.from(publicKey.export({format:'jwk'}).x, 'base64url');
const imported = createPublicKey({format:'jwk', key:{kty:'OKP', crv:'X25519', x:controllerPublic.toString('base64url')}});
const key = Buffer.from(hkdfSync('sha256', diffieHellman({privateKey, publicKey:imported}), Buffer.concat([ephemeralPublic,controllerPublic]), Buffer.from('switch provider login v1'), 32));
const nonce = randomBytes(12);
const cipher = createCipheriv('aes-256-gcm', key, nonce);
cipher.setAAD(Buffer.from(`switch-provider-login-v1\n${machine.id}\ncodex`));
const ciphertext = Buffer.concat([cipher.update(JSON.stringify({kind:'auth-json', credential})),cipher.final(),cipher.getAuthTag()]);
const sealed = {alg:'X25519-HKDF-SHA256-A256GCM', key_id:machine.public_key.key_id, ephemeral_key:ephemeralPublic.toString('base64'), nonce:nonce.toString('base64'), ciphertext:ciphertext.toString('base64')};
writeFileSync('.secrets/sealed-codex.json', JSON.stringify({sealed}), {mode:0o600});
chmodSync('.secrets/sealed-codex.json',0o600);
console.log('Existing ChatGPT OAuth login sealed for Block 0 controller; no API key; ciphertext saved under .secrets; no values printed.');
