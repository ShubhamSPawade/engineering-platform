import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { checkTicket } from '../scripts/check-superthread-ticket.mjs';
import { enforceCardLifecycle, inspectCardLifecycle } from '../scripts/superthread-card-lifecycle.mjs';

const scope = JSON.parse(await readFile(new URL('../configs/superthread-scope.json', import.meta.url), 'utf8'));
const policy = { mode: 'enforce', max_blockers: 10 };
const card = { id: '1754', status: 'started', linked_cards: [] };
const link = { card_id: '1755', project_id: '9', board_id: '17', status: 'completed', linked_card_type: 'blocked_by' };
const input = { card, scope, policy, readCard: async () => assert.fail('Unexpected dependency read') };

test('accepts known non-cancelled statuses with explicit empty dependencies', async () => {
  for (const status of ['backlog', 'committed', 'started', 'completed']) {
    assert.equal((await enforceCardLifecycle({ ...input, card: { ...card, status } })).dependencies_resolved, true);
  }
});
test('rejects cancelled and unknown ticket states without dependency reads', async () => {
  for (const status of ['cancelled', undefined, 'custom-state']) {
    await assert.rejects(enforceCardLifecycle({ ...input, card: { ...card, status } }));
  }
});
test('requires explicit valid dependency metadata and bounded counts', async () => {
  for (const linked_cards of [undefined, null, {}, [{ linked_card_type: 'unknown' }], Array(11).fill(link)]) {
    await assert.rejects(enforceCardLifecycle({ ...input, card: { ...card, linked_cards } }));
  }
});
test('rejects invalid, self, duplicate and out-of-scope blocker routes before reads', async () => {
  for (const linked_cards of [
    [{ ...link, card_id: '../other' }], [{ ...link, card_id: '1754' }], [link, link],
    [{ ...link, project_id: '10' }], [{ ...link, board_id: '18' }],
    [link, { ...link, card_id: '1756', board_id: '18' }],
  ]) await assert.rejects(enforceCardLifecycle({ ...input, card: { ...card, linked_cards } }));
});
test('ignores non-blocking relationships', async () => {
  const linked_cards = ['blocks', 'related', 'duplicates'].map(linked_card_type => ({ ...link, linked_card_type, project_id: 'outside' }));
  assert.equal((await enforceCardLifecycle({ ...input, card: { ...card, linked_cards } })).blocking_dependencies, 0);
});
test('reads current blocker state instead of trusting embedded completed status', async () => {
  for (const status of ['backlog', 'committed', 'started', 'cancelled', undefined]) {
    await assert.rejects(enforceCardLifecycle({ ...input, card: { ...card, linked_cards: [link] }, readCard: async () => ({ status }) }));
  }
  assert.equal((await enforceCardLifecycle({ ...input, card: { ...card, linked_cards: [link] }, readCard: async () => ({ status: 'completed' }) })).blocking_dependencies, 1);
});
test('dependency outages fail closed and safe audit never returns card content', async () => {
  await assert.rejects(enforceCardLifecycle({ ...input, card: { ...card, linked_cards: [link] }, readCard: async () => { throw new Error('Unavailable'); } }), /Unavailable/);
  assert.deepEqual(inspectCardLifecycle({ ...card, content: 'private text', title: 'private title' }), {
    status: 'started', linked_cards_present: true, links_valid: true, blocking_count: 0,
  });
});
test('ticket integration checks fresh dependency scope, archive, access and completion', async () => {
  for (const mode of ['completed', 'started', 'moved', 'archived', 'inaccessible']) {
    const pr = { title: 'chore: ST-1754 dependency policy', body: scope.pilot_card_url,
      base: { ref: 'dev', repo: { full_name: scope.github_repository } }, head: { ref: 'chore/ST-1754-policy' } };
    const bodies = [
      { project: { id: '9', team_id: scope.team_id, title: scope.space_name } },
      { board: { id: '17', team_id: scope.team_id, project_id: '9', title: scope.board_name } },
      { card: { ...card, team_id: scope.team_id, project_id: '9', board_id: '17', linked_cards: [link] } },
      { card: { id: '1755', team_id: scope.team_id, project_id: '9', board_id: mode === 'moved' ? '18' : '17',
        status: mode === 'started' ? 'started' : 'completed', ...(mode === 'archived' ? { archived: {} } : {}) } },
    ];
    let calls = 0;
    const fetchImpl = async (url, options) => {
      assert.equal(options.method, 'GET');
      assert.equal(options.redirect, 'error');
      if (calls === 3) assert.ok(url.endsWith('/cards/1755'));
      const body = bodies[calls++];
      return mode === 'inaccessible' && calls === 4 ? { ok: false, status: 403 } : { ok: true, json: async () => body };
    };
    const result = checkTicket({ pr, scope, token: 'fixture', fetchImpl, lifecyclePolicy: policy });
    if (mode === 'completed') assert.equal((await result).card_content.lifecycle.dependencies_resolved, true);
    else await assert.rejects(result);
    assert.equal(calls, 4);
  }
});
