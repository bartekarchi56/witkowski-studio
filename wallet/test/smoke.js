// Smoke test with throwaway certificates and keys (made with openssl).
// Checks that a .pkpass bundle and a Google save link are built correctly.
// Real Wallet apps will only accept passes signed with your real certificates.
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'timbro-wallet-'));
const run = cmd => execSync(cmd, { cwd: dir, stdio: 'pipe' });
run('openssl req -x509 -newkey rsa:2048 -nodes -keyout wwdr.key -out wwdr.pem -days 2 -subj "/CN=Test WWDR"');
run('openssl req -newkey rsa:2048 -nodes -keyout signer.key -out signer.csr -subj "/CN=Pass Type ID: pass.test.timbro"');
run('openssl x509 -req -in signer.csr -CA wwdr.pem -CAkey wwdr.key -CAcreateserial -out signer.pem -days 2');
const googleKey = fs.readFileSync(path.join(dir, 'wwdr.key'), 'utf8');
fs.writeFileSync(path.join(dir, 'sa.json'), JSON.stringify({ client_email: 'wallet@test.iam.gserviceaccount.com', private_key: googleKey }));

Object.assign(process.env, {
  APPLE_PASS_TYPE_ID: 'pass.test.timbro', APPLE_TEAM_ID: 'TEAM123456',
  APPLE_SIGNER_CERT: path.join(dir, 'signer.pem'), APPLE_SIGNER_KEY: path.join(dir, 'signer.key'), APPLE_WWDR_CERT: path.join(dir, 'wwdr.pem'),
  GOOGLE_ISSUER_ID: '3388000000000000000', GOOGLE_SERVICE_ACCOUNT: path.join(dir, 'sa.json'), PUBLIC_URL: 'https://wallet.example'
});
const { readPassRequest } = await import('../input.js');
const { buildApplePass } = await import('../apple.js');
const { buildGoogleSaveUrl } = await import('../google.js');
const { default: jwt } = await import('jsonwebtoken');

const req = readPassRequest({
  lang: 'it',
  card: { id: 'the-coffee', business: 'The Coffee', title: 'Carta caffè', reward: 'un caffè gratis', stampsNeeded: 10, color: '#FFFFFF', ink: '#2B32FF', icon: 'cup' },
  customer: { id: 'k7m2qx', name: 'Giulia', stamps: 3 }
});
assert.equal(req.customer.id, 'K7M2QX');
assert.throws(() => readPassRequest({ card: { id: 'x' }, customer: { id: 'bad' } }));

// Apple
const pkpass = await buildApplePass(req);
const out = path.join(dir, 'test.pkpass');
fs.writeFileSync(out, pkpass);
const list = execSync(`unzip -Z1 ${out}`).toString().trim().split('\n').sort();
for (const f of ['pass.json', 'manifest.json', 'signature', 'icon.png', 'icon@2x.png', 'strip.png', 'strip@2x.png', 'strip@3x.png'])
  assert.ok(list.includes(f), `missing ${f}`);
const pass = JSON.parse(execSync(`unzip -p ${out} pass.json`).toString());
assert.equal(pass.storeCard.headerFields[0].value, '3/10');
assert.equal(pass.barcodes[0].message, 'K7M2QX');
assert.equal(pass.logoText, 'The Coffee');
console.log('apple ok:', list.join(', '));

// Google
const url = buildGoogleSaveUrl(req, 'https://timbro.example');
assert.ok(url.startsWith('https://pay.google.com/gp/v/save/'));
const claims = jwt.decode(url.split('/').pop());
assert.equal(claims.typ, 'savetowallet');
assert.equal(claims.payload.loyaltyObjects[0].barcode.value, 'K7M2QX');
assert.equal(claims.payload.loyaltyObjects[0].loyaltyPoints.balance.string, '3/10');
console.log('google ok:', claims.payload.loyaltyObjects[0].id);
