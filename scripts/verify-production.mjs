import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createClient } from '@libsql/client';

const site = 'https://book-kepping-app.vercel.app';
const email = `verification-${randomUUID()}@example.test`;
const url = execFileSync('turso', ['db', 'show', 'pocketbook-prod', '--url'], { encoding: 'utf8' }).trim();
const authToken = execFileSync('turso', ['db', 'tokens', 'create', 'pocketbook-prod', '--expiration', '1d'], { encoding: 'utf8' }).trim();
const database = createClient({ url, authToken });
let cookie = '';
async function request(path, options = {}) {
  return fetch(site + path, { ...options, headers: { ...options.headers, ...(cookie ? { cookie } : {}) }, signal: AbortSignal.timeout(30000) });
}
try {
  const password = randomUUID() + '!';
  const signup = await request('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json', origin: site }, body: JSON.stringify({ mode: 'signup', name: 'Temporary verification', email, password }) });
  assert.equal(signup.status, 200, 'Production signup failed: ' + await signup.clone().text());
  cookie = signup.headers.getSetCookie().map(c => c.split(';')[0]).join('; ');
  assert.ok(cookie.includes('session='));
  const profile = await (await request('/api/auth')).json();
  assert.equal(profile.user.email, email);
  const budgetSpaces = await request('/api/budget-spaces');
  assert.equal(budgetSpaces.status,200);
  const personalSpace = (await budgetSpaces.json()).spaces[0];
  assert.equal(personalSpace.name,'Personal');
  assert.equal(personalSpace.active,1);
  const integrations = await request('/api/integrations');
  assert.equal(integrations.status,200);
  const integrationSettings = await integrations.json();
  assert.equal(integrationSettings.ready,true);
  assert.equal(integrationSettings.groqConfigured,false);
  assert.equal(integrationSettings.telegramConfigured,false);
  const typeResponse = await request('/api/transaction-types', {method:'POST',headers:{'Content-Type':'application/json',origin:site},body:JSON.stringify({name:'Verification category'})});
  assert.equal(typeResponse.status,200);
  assert.deepEqual((await (await request('/api/transaction-types')).json()).types,['Verification category']);
  const profileResponse = await request('/api/profile', {method:'PATCH',headers:{'Content-Type':'application/json',origin:site},body:JSON.stringify({name:'Updated verification'})});
  assert.equal(profileResponse.status,200);
  assert.equal((await profileResponse.json()).user.name,'Updated verification');
  const form = new FormData();
  for (const [k,v] of Object.entries({date:'2026-09-10',particular:'Temporary verification entry',type:'credit',amount:'123.45',subscription:''})) form.set(k,v);
  form.set('receipt',new Blob(['%PDF-1.4\nTemporary verification'],{type:'application/pdf'}),'verification.pdf');
  const saved = await request('/api/entries', { method:'POST', body:form, headers:{origin:site} });
  assert.equal(saved.status,200,'Production save failed: '+await saved.clone().text());
  const rows = (await (await request('/api/entries')).json()).entries;
  assert.equal(rows.length,1);assert.equal(rows[0].amount,12345);
  assert.equal(rows[0].space_id,personalSpace.id);
  const receipt = await request('/api/receipts/'+rows[0].id);
  assert.equal(receipt.status,200);assert.match(receipt.headers.get('content-disposition'),/^inline;/);
  const removed = await request('/api/entries?id='+rows[0].id,{method:'DELETE',headers:{origin:site}});
  assert.equal(removed.status,200);
  assert.equal((await (await request('/api/entries')).json()).entries.length,0);
  assert.equal((await request('/api/auth',{method:'DELETE',headers:{origin:site}})).status,200);
  assert.equal((await request('/api/entries')).status,401);
  console.log('PASS: live signup, session, transaction persistence, inline receipt viewing, deletion, and logout.');
} finally {
  await database.batch([
    {sql:'DELETE FROM entry_spaces WHERE entry_id IN (SELECT id FROM entries WHERE user_id IN (SELECT id FROM users WHERE email=?))',args:[email]},
    {sql:'DELETE FROM budget_spaces WHERE user_id IN (SELECT id FROM users WHERE email=?)',args:[email]},
    {sql:'DELETE FROM transaction_type_icons WHERE user_id IN (SELECT id FROM users WHERE email=?)',args:[email]},
    {sql:'DELETE FROM transaction_types WHERE user_id IN (SELECT id FROM users WHERE email=?)',args:[email]},
    {sql:'DELETE FROM entries WHERE user_id IN (SELECT id FROM users WHERE email=?)',args:[email]},
    {sql:'DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE email=?)',args:[email]},
    {sql:'DELETE FROM users WHERE email=?',args:[email]},
    {sql:'DELETE FROM login_attempts WHERE email=?',args:[email]}
  ],'write');
  database.close();
  console.log('Temporary verification account and records removed.');
}
