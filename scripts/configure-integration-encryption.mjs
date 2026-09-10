// Provision once; never rotate this key without migrating encrypted credentials.
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
const listing = spawnSync('vercel',['env','ls','production'],{encoding:'utf8'});
if(listing.status !== 0) throw new Error('Could not inspect Vercel environment.');
if((listing.stdout+listing.stderr).includes('INTEGRATION_ENCRYPTION_KEY')) {
  console.log('Production encryption key already exists; left unchanged.');
} else {
  const result = spawnSync('vercel',['env','add','INTEGRATION_ENCRYPTION_KEY','production','--sensitive'],{input:randomBytes(32).toString('hex')+'\n',encoding:'utf8'});
  if(result.status !== 0) throw new Error('Could not provision production encryption key.');
  console.log('Production encryption key securely provisioned. Value was not logged.');
}
