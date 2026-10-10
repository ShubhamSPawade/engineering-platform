const branches = new Set(['dev', 'staging', 'main']);

export function requireReconciliationSource({ registration, repository, ref }) {
  if (registration?.full_name !== repository || typeof registration.default_branch !== 'string' || ref !== `refs/heads/${registration.default_branch}`) {
    throw new Error('Reconciliation must run from the registered repository default branch.');
  }
}

export function createGithubClient({ repository, token, fetchImpl = fetch, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)) }) {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository ?? '') || !token || /[\r\n]/.test(token)) {
    throw new Error('GitHub repository or authentication is invalid.');
  }
  return async function github(path, method = 'GET', body) {
    for (let attempt = 0; attempt < 3; attempt++) {
      let response;
      try {
        response = await fetchImpl(`https://api.github.com/repos/${repository}${path ? '/' + path : ''}`, {
          method, redirect: 'error', signal: AbortSignal.timeout(30_000),
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
          ...(body ? { body: JSON.stringify(body) } : {}),
        });
      } catch {
        if (attempt === 2) throw new Error('GitHub request failed.');
        await sleep(250 * 2 ** attempt);
        continue;
      }
      if (!response.ok) {
        if ((response.status === 429 || response.status >= 500) && attempt < 2) {
          await sleep(250 * 2 ** attempt);
          continue;
        }
        throw new Error(`GitHub request failed (HTTP ${response.status}).`);
      }
      try { return await response.json(); } catch { throw new Error('GitHub response is not valid JSON.'); }
    }
  };
}

function identity(pr, repository) {
  if (!Number.isSafeInteger(pr?.number) || pr.number < 1 || !/^[0-9a-f]{40}$/.test(pr?.head?.sha ?? '') || pr.base?.repo?.full_name !== repository) {
    throw new Error('Invalid PR identity.');
  }
}

export async function validatePrStatus({ initialPr, repository, github, targetUrl, validate, pendingAlready = false }) {
  identity(initialPr, repository);
  const { number } = initialPr;
  const sha = initialPr.head.sha;
  const publish = (state, description) => github(`statuses/${sha}`, 'POST', {
    state, context: 'superthread-ticket', description, target_url: targetUrl,
  });
  if (!pendingAlready) await publish('pending', 'Checking registered Superthread ticket');
  try {
    const pr = await github(`pulls/${number}`);
    identity(pr, repository);
    if (pr.state !== 'open' || pr.head.sha !== sha) throw new Error('PR event is stale; validate the current head.');
    const associated = await github(`commits/${sha}/pulls?per_page=100`);
    if (!Array.isArray(associated) || associated.length >= 100) throw new Error('Commit PR associations are unavailable or exceed the supported limit.');
    for (const sibling of associated) {
      identity(sibling, repository);
      if (sibling.state === 'open' && sibling.head.sha === sha && sibling.number !== number && branches.has(sibling.base.ref)) {
        throw new Error('Multiple open PRs share this head; use a distinct commit for each PR.');
      }
    }
    const receipt = await validate(pr);
    const current = await github(`pulls/${number}`);
    identity(current, repository);
    if (current.state !== 'open' || current.head.sha !== sha || current.title !== pr.title || current.body !== pr.body || current.base.ref !== pr.base.ref) {
      throw new Error('PR changed during validation; retry the latest event.');
    }
    await publish('success', `ST-${receipt.pilot_card_id} scope, content, cancellation and dependencies verified`);
    return { number, state: 'success' };
  } catch (error) {
    await publish('failure', error.message.slice(0, 140));
    return { number, state: 'failure' };
  }
}

export async function reconcilePrStatuses({ repository, github, targetUrl, validate }) {
  const prs = [];
  // The pilot supports up to 20 targeted PRs. Paginate the repository intake
  // without following arbitrary API URLs or inspecting any PR checkout.
  for (let page = 1; page <= 10; page++) {
    const items = await github(`pulls?state=open&sort=created&direction=asc&per_page=100&page=${page}`);
    if (!Array.isArray(items)) throw new Error('GitHub PR list is invalid.');
    for (const pr of items) {
      identity(pr, repository);
      if (branches.has(pr.base.ref)) prs.push(pr);
    }
    if (items.length < 100) break;
    if (page === 10) throw new Error('PR inventory exceeds the supported pagination limit.');
  }
  // Invalidate all discovered heads before any Superthread read, including
  // an oversized batch. A failed batch must not leave its previous greens.
  let invalidationFailed = false;
  for (const pr of prs) {
    try {
      await github(`statuses/${pr.head.sha}`, 'POST', {
        state: 'pending', context: 'superthread-ticket', description: 'Rechecking live Superthread ticket state', target_url: targetUrl,
      });
    } catch { invalidationFailed = true; }
  }
  if (invalidationFailed) throw new Error('Cannot invalidate every discovered ticket status; restore GitHub API access and retry.');
  if (prs.length > 20) {
    for (const pr of prs) await github(`statuses/${pr.head.sha}`, 'POST', {
      state: 'failure', context: 'superthread-ticket', description: 'Reconciliation exceeds 20 PRs; reduce the batch or extend policy capacity', target_url: targetUrl,
    });
    throw new Error('Ticket reconciliation exceeds the supported PR limit.');
  }
  const results = new Array(prs.length);
  let cursor = 0;
  async function worker() {
    while (cursor < prs.length) {
      const index = cursor++;
      try {
        results[index] = await validatePrStatus({ initialPr: prs[index], repository, github, targetUrl, validate, pendingAlready: true });
      } catch {
        // An unavailable status publisher leaves pending and cannot retain a
        // stale success. Continue the rest of the discovered batch.
        results[index] = { number: prs[index].number, state: 'failure' };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(4, prs.length) }, worker));
  return results;
}
