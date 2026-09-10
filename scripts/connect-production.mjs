import { execFileSync, spawnSync } from 'node:child_process';

// Keep credentials in memory and redact them from any CLI output.
const database = 'pocketbook-prod';
const url = execFileSync('turso', ['db', 'show', database, '--url'], { encoding: 'utf8' }).trim();
const token = execFileSync('turso', ['db', 'tokens', 'create', database], { encoding: 'utf8' }).trim();
if (!url.startsWith('libsql://') || !token || token.includes('\n')) throw new Error('Turso did not return valid credentials.');
for (const [name, value] of [['TURSO_DATABASE_URL', url], ['TURSO_AUTH_TOKEN', token]]) {
  const args = ['env', 'add', name, 'production', '--value', value, '--yes'];
  if (name.endsWith('TOKEN')) args.push('--sensitive');
  const result = spawnSync('vercel', args, { encoding: 'utf8' });
  const output = ((result.stdout || '') + (result.stderr || '')).replaceAll(token, '[REDACTED]').replaceAll(url, '[DATABASE_URL]');
  console.log(output);
  if (result.status !== 0) process.exit(result.status || 1);
}
console.log('Production credentials configured.');
