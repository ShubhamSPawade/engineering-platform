import test from 'node:test';
import assert from 'node:assert/strict';
import { createGithubClient, reconcilePrStatuses, validatePrStatus, requireReconciliationSource } from '../scripts/superthread-ticket-runtime.mjs';

const repository = 'ShubhamSPawade/engineering-demo-api';
const targetUrl = 'https://github.com/example/run';
test('manual reconciliation accepts only the actual registered default branch', () => {
  const input = { registration: { full_name: repository, default_branch: 'dev' }, repository, ref: 'refs/heads/dev' };
  assert.doesNotThrow(() => requireReconciliationSource(input));
  for (const overrides of [{ ref: 'refs/heads/feature' }, { ref: 'refs/heads/main' }, { repository: 'another/repo' }, { registration: {} }]) {
    assert.throws(() => requireReconciliationSource({ ...input, ...overrides }), /default branch/);
  }
});
function pr(number, overrides = {}) {
  return { number, state: 'open', title: `chore: ST-${1753 + number} policy`, body: 'ticket',
    head: { sha: number.toString(16).padStart(40, '0') }, base: { ref: 'dev', repo: { full_name: repository } }, ...overrides };
}
function harness(items, validate = async () => ({ pilot_card_id: '1754' })) {
  const writes = [];
  const calls = [];
  const github = async (path, method, body) => {
    calls.push(path);
    if (method === 'POST') { writes.push({ path, ...body }); return {}; }
    if (path.startsWith('pulls?')) return items;
    if (path.startsWith('commits/')) return items;
    const number = Number(path.split('/')[1]);
    return structuredClone(items.find(item => item.number === number));
  };
  return { writes, calls, input: { repository, github, targetUrl, validate } };
}

test('rechecks unchanged PR heads and transitions success to failure and recovery', async () => {
  let cancelled = false;
  const h = harness([pr(1)], async () => {
    if (cancelled) throw new Error('Ticket is cancelled.');
    return { pilot_card_id: '1754' };
  });
  assert.equal((await reconcilePrStatuses(h.input))[0].state, 'success');
  cancelled = true;
  assert.equal((await reconcilePrStatuses(h.input))[0].state, 'failure');
  cancelled = false;
  assert.equal((await reconcilePrStatuses(h.input))[0].state, 'success');
  assert.deepEqual(h.writes.map(write => write.state), ['pending', 'success', 'pending', 'failure', 'pending', 'success']);
  assert.ok(h.writes.every(write => write.path === `statuses/${pr(1).head.sha}` && write.context === 'superthread-ticket'));
});
test('invalidates the entire batch before validation and continues after policy failure', async () => {
  let h;
  h = harness([pr(1), pr(2)], async p => {
    assert.deepEqual(h.writes.slice(0, 2).map(w => w.state), ['pending', 'pending']);
    if (p.number === 1) throw new Error('Blocking dependency is unresolved.');
    return { pilot_card_id: '1755' };
  });
  assert.deepEqual(await reconcilePrStatuses(h.input), [{ number: 1, state: 'failure' }, { number: 2, state: 'success' }]);
});
test('empty intake performs no validation or status writes and ignores other target branches', async () => {
  for (const items of [[], [pr(1, { base: { ref: 'experiment', repo: { full_name: repository } } })]]) {
    const h = harness(items, async () => assert.fail('Unexpected validation'));
    assert.deepEqual(await reconcilePrStatuses(h.input), []);
    assert.equal(h.writes.length, 0);
  }
});
test('cannot publish success after a head or PR metadata changes during validation', async () => {
  for (const change of [p => { p.head.sha = 'f'.repeat(40); }, p => { p.body = 'edited'; }, p => { p.state = 'closed'; }]) {
    const items = [pr(1)];
    const h = harness(items, async () => { change(items[0]); return { pilot_card_id: '1754' }; });
    const result = await validatePrStatus({ ...h.input, initialPr: structuredClone(items[0]) });
    assert.equal(result.state, 'failure');
    assert.deepEqual(h.writes.map(w => w.state), ['pending', 'failure']);
  }
});
test('fails shared-head PRs to prevent one PR validation overwriting another', async () => {
  const items = [pr(1), pr(2, { head: pr(1).head })];
  const h = harness(items, async () => assert.fail('Ambiguous head must not validate'));
  assert.ok((await reconcilePrStatuses(h.input)).every(result => result.state === 'failure'));
});
test('bounds intake and marks oversized discovered batches as failure', async () => {
  const h = harness(Array.from({ length: 21 }, (_, i) => pr(i + 1)), async () => assert.fail('Oversized batch must not validate'));
  await assert.rejects(reconcilePrStatuses(h.input), /PR limit/);
  assert.equal(h.writes.filter(w => w.state === 'pending').length, 21);
  assert.equal(h.writes.filter(w => w.state === 'failure').length, 21);
});
test('rejects foreign repository intake before publishing and continues invalidation attempts after API failure', async () => {
  const bad = harness([pr(1, { base: { ref: 'dev', repo: { full_name: 'other/repo' } } })]);
  await assert.rejects(reconcilePrStatuses(bad.input), /identity/);
  assert.equal(bad.writes.length, 0);
  const h = harness([pr(1), pr(2)], async () => assert.fail('Incomplete invalidation must not validate'));
  const github = h.input.github;
  h.input.github = async (...args) => {
    if (args[0] === `statuses/${pr(1).head.sha}`) throw new Error('GitHub unavailable');
    return github(...args);
  };
  await assert.rejects(reconcilePrStatuses(h.input), /invalidate every/);
  assert.equal(h.writes.length, 1);
  assert.equal(h.writes[0].path, `statuses/${pr(2).head.sha}`);
});
test('uses bounded retries for transient GitHub errors, not authentication errors', async () => {
  for (const mode of ['transient', 'authentication', 'network']) {
    let calls = 0;
    const delays = [];
    const github = createGithubClient({ repository, token: 'fixture', sleep: async ms => delays.push(ms),
      fetchImpl: async (url, options) => {
        assert.ok(url.startsWith(`https://api.github.com/repos/${repository}`));
        assert.equal(options.redirect, 'error');
        calls++;
        if (mode === 'network') throw new Error('untrusted transport details');
        if (mode === 'authentication') return { ok: false, status: 401 };
        return calls < 3 ? { ok: false, status: 503 } : { ok: true, json: async () => ({ ok: true }) };
      } });
    if (mode === 'transient') assert.deepEqual(await github(''), { ok: true });
    else await assert.rejects(github(''), mode === 'authentication' ? /HTTP 401/ : /^Error: GitHub request failed\.$/);
    assert.equal(calls, mode === 'authentication' ? 1 : 3);
    assert.deepEqual(delays, mode === 'authentication' ? [] : [250, 500]);
  }
});
