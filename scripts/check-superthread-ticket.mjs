import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { verifyScope } from './verify-superthread-scope.mjs';
import { enforceCardContent } from './superthread-card-content.mjs';

export function ticketFromPr(pr, scope) {
  if (pr.base?.repo?.full_name !== scope.github_repository) throw new Error('PR repository is not registered.');
  if (!['dev', 'staging', 'main'].includes(pr.base.ref)) throw new Error('PR target branch is not registered.');
  const references = [...(pr.title ?? '').matchAll(/\bST-([1-9][0-9]*)\b/g)].map(match => match[1]);
  if (references.length !== 1) throw new Error('PR title must contain exactly one ST-<card ID> reference.');
  const urls = [...(pr.body ?? '').matchAll(/https:\/\/app\.superthread\.com\/([^\s/]+)\/card-([1-9][0-9]*)(?=[-\s)#?]|$)/g)];
  if (urls.length !== 1 || urls[0][1] !== scope.workspace_route || urls[0][2] !== references[0]) {
    throw new Error('PR body must contain one matching card URL in the registered workspace.');
  }
  const branchReferences = [...(pr.head?.ref ?? '').matchAll(/\bST-([1-9][0-9]*)\b/g)].map(match => match[1]);
  if (branchReferences.some(id => id !== references[0])) throw new Error('Branch card reference conflicts with the PR ticket.');
  return references[0];
}

export async function checkTicket({ pr, scope, token, fetchImpl, contentPolicy }) {
  if (!scope.scope_verified_via_api || !scope.team_id || !scope.api_space_id || !scope.board_id) {
    throw new Error('Superthread scope has not been verified.');
  }
  const cardId = ticketFromPr(pr, scope);
  return verifyScope({ scope, teamId: scope.team_id, token, cardId, fetchImpl,
    ...(contentPolicy ? { validateCard: card => enforceCardContent(card.content, contentPolicy) } : {}) });
}

async function run() {
  const scope = JSON.parse(await readFile(new URL('../configs/superthread-scope.json', import.meta.url), 'utf8'));
  const contentPolicy = JSON.parse(await readFile(new URL('../configs/superthread-content-policy.json', import.meta.url), 'utf8'));
  const event = JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH, 'utf8'));
  const repository = process.env.GITHUB_REPOSITORY;
  if (repository !== scope.github_repository || process.env.GITHUB_EVENT_NAME !== 'pull_request_target') {
    throw new Error('Ticket checks require a registered repository and trusted pull_request_target event.');
  }
  const number = event.pull_request?.number;
  const sha = event.pull_request?.head?.sha;
  if (!Number.isSafeInteger(number) || !/^[0-9a-f]{40}$/.test(sha ?? '')) throw new Error('Invalid PR event identity.');
  const githubToken = process.env.GITHUB_TOKEN;
  if (!githubToken) throw new Error('GitHub authentication is missing.');
  async function github(path, method = 'GET', body) {
    let response;
    try {
      response = await fetch(`https://api.github.com/repos/${repository}/${path}`, {
        method, redirect: 'error', signal: AbortSignal.timeout(30_000),
        headers: { Authorization: `Bearer ${githubToken}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    } catch { throw new Error('GitHub request failed.'); }
    if (!response.ok) throw new Error(`GitHub request failed (HTTP ${response.status}).`);
    return response.json();
  }
  const targetUrl = `https://github.com/${repository}/actions/runs/${process.env.GITHUB_RUN_ID}`;
  const status = (state, description) => github(`statuses/${sha}`, 'POST', { state, context: 'superthread-ticket', description, target_url: targetUrl });
  // A new event invalidates the previous result before any validation.
  await status('pending', 'Checking registered Superthread ticket');
  try {
    const pr = await github(`pulls/${number}`);
    if (pr.state !== 'open' || pr.head.sha !== sha) throw new Error('PR event is stale; a newer event must validate the current head.');
    const receipt = await checkTicket({ pr, scope, token: process.env.SUPERTHREAD_API_TOKEN, contentPolicy });
    const current = await github(`pulls/${number}`);
    if (current.state !== 'open' || current.head.sha !== sha || current.title !== pr.title || current.body !== pr.body || current.base.ref !== pr.base.ref) {
      throw new Error('PR changed during validation; retry the latest event.');
    }
    await status('success', `ST-${receipt.pilot_card_id} belongs to the registered board and space`);
    console.log(`Verified ST-${receipt.pilot_card_id} in the registered Superthread scope.`);
  } catch (error) {
    // Controlled messages only: never print PR content, card content or API bodies.
    await status('failure', error.message.slice(0, 140));
    throw error;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run().catch(error => { console.error(error.message); process.exitCode = 1; });
}
