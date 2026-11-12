// Prints only the {Scope, Permission} pairs of the job's own ACTIONS_RUNTIME_TOKEN `ac` claim,
// decoded (bit 1 = read, bit 2 = write), plus the non-secret GITHUB_* context of the run.
// It never prints, logs, writes, uploads or sends the token or any other claim. Only the JWT
// payload is decoded; the signature is not checked (the token is this job's own, read locally).
'use strict';
const { appendFileSync } = require('node:fs');

function fail() {
  // Deliberately generic: no token fragment, no parser message that could echo input.
  console.log('PROBE_ERROR the ac claim of the runtime token could not be read');
  process.exitCode = 1;
}

function scopes() {
  const token = process.env.ACTIONS_RUNTIME_TOKEN;
  if (typeof token !== 'string') throw new Error('no token');
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('not a jwt');
  const claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  const ac = typeof claims.ac === 'string' ? JSON.parse(claims.ac) : claims.ac;
  if (!Array.isArray(ac)) throw new Error('no ac');
  return ac.map((entry) => {
    if (typeof entry.Scope !== 'string' || !Number.isInteger(entry.Permission)) {
      throw new Error('bad entry');
    }
    return {
      Scope: entry.Scope,
      Permission: entry.Permission,
      read: (entry.Permission & 1) === 1,
      write: (entry.Permission & 2) === 2,
    };
  });
}

try {
  const env = process.env;
  const result = {
    label: env.INPUT_LABEL ?? '',
    event: env.GITHUB_EVENT_NAME,
    ref: env.GITHUB_REF,
    refType: env.GITHUB_REF_TYPE,
    baseRef: env.GITHUB_BASE_REF || null,
    headRef: env.GITHUB_HEAD_REF || null,
    sha: env.GITHUB_SHA,
    runId: env.GITHUB_RUN_ID,
    ac: scopes(),
  };
  const line = JSON.stringify(result);
  console.log(`PROBE_RESULT ${line}`);
  if (env.GITHUB_STEP_SUMMARY) appendFileSync(env.GITHUB_STEP_SUMMARY, `\`\`\`json\n${line}\n\`\`\`\n`);
} catch {
  fail();
}
