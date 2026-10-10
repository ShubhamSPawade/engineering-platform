import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { verifyScope } from './verify-superthread-scope.mjs';
import { enforceCardContent } from './superthread-card-content.mjs';
import { enforceCardLifecycle } from './superthread-card-lifecycle.mjs';
import { createGithubClient, validatePrStatus, reconcilePrStatuses, requireReconciliationSource } from './superthread-ticket-runtime.mjs';

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

export async function checkTicket({ pr, scope, token, fetchImpl, contentPolicy, lifecyclePolicy }) {
  if (!scope.scope_verified_via_api || !scope.team_id || !scope.api_space_id || !scope.board_id) {
    throw new Error('Superthread scope has not been verified.');
  }
  const cardId = ticketFromPr(pr, scope);
  return verifyScope({ scope, teamId: scope.team_id, token, cardId, fetchImpl,
    ...(contentPolicy || lifecyclePolicy ? { validateCard: async (card, { readCard }) => ({
      ...(contentPolicy ? enforceCardContent(card.content, contentPolicy) : {}),
      ...(lifecyclePolicy ? { lifecycle: await enforceCardLifecycle({ card, scope, readCard, policy: lifecyclePolicy }) } : {}),
    }) } : {}) });
}

async function run() {
  const scope = JSON.parse(await readFile(new URL('../configs/superthread-scope.json', import.meta.url), 'utf8'));
  const contentPolicy = JSON.parse(await readFile(new URL('../configs/superthread-content-policy.json', import.meta.url), 'utf8'));
  const lifecyclePolicy = JSON.parse(await readFile(new URL('../configs/superthread-lifecycle-policy.json', import.meta.url), 'utf8'));
  const eventName = process.env.GITHUB_EVENT_NAME;
  const repository = process.env.GITHUB_REPOSITORY;
  if (repository !== scope.github_repository || !['pull_request_target', 'schedule', 'workflow_dispatch'].includes(eventName)) {
    throw new Error('Ticket checks require a registered repository and trusted event.');
  }
  const github = createGithubClient({ repository, token: process.env.GITHUB_TOKEN });
  const targetUrl = `https://github.com/${repository}/actions/runs/${process.env.GITHUB_RUN_ID}`;
  const validate = pr => checkTicket({ pr, scope, token: process.env.SUPERTHREAD_API_TOKEN, contentPolicy, lifecyclePolicy });
  let results;
  if (eventName === 'pull_request_target') {
    const event = JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH, 'utf8'));
    results = [await validatePrStatus({ initialPr: event.pull_request, repository, github, targetUrl, validate })];
  } else {
    const registration = await github('');
    requireReconciliationSource({ registration, repository, ref: process.env.GITHUB_REF });
    results = await reconcilePrStatuses({ repository, github, targetUrl, validate });
  }
  const failed = results.filter(result => result.state !== 'success').length;
  console.log(JSON.stringify({ checked: results.length, succeeded: results.length - failed, failed }));
  if (failed) throw new Error('One or more Superthread ticket checks failed; inspect the required status.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run().catch(error => { console.error(error.message); process.exitCode = 1; });
}
