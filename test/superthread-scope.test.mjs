import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { verifyScope } from '../scripts/verify-superthread-scope.mjs';

const scope = JSON.parse(await readFile(new URL('../configs/superthread-scope.json', import.meta.url), 'utf8'));
function harness(change = () => {}) {
  const bodies = [
    { project: { id: '9', team_id: 'pilot-team', title: 'test-demo' } },
    { board: { id: '17', team_id: 'pilot-team', project_id: '9', title: 'Engineering Demo' } },
    { card: { id: '1754', team_id: 'pilot-team', project_id: '9', board_id: '17' } },
  ];
  change(bodies);
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    return { ok: true, json: async () => bodies[calls.length - 1] };
  };
  return { calls, fetchImpl };
}
const input = { scope, teamId: 'pilot-team', token: 'test-credential' };

test('verifies exact resources using GET only and refuses redirects', async () => {
  const { calls, fetchImpl } = harness();
  assert.deepEqual(await verifyScope({ ...input, fetchImpl }), {
    team_id: 'pilot-team', api_space_id: '9', board_id: '17', pilot_card_id: '1754', scope_verified_via_api: true,
  });
  assert.deepEqual(calls.map(c => c.url), ['projects/9', 'boards/17', 'cards/1754'].map(path => `https://api.superthread.com/v1/pilot-team/${path}`));
  assert.ok(calls.every(c => c.options.method === 'GET' && c.options.redirect === 'error'));
});
test('stops before reading a card if its board belongs to another space', async () => {
  const { calls, fetchImpl } = harness(b => { b[1].board.project_id = '10'; });
  await assert.rejects(verifyScope({ ...input, fetchImpl }), /outside the permitted space/);
  assert.equal(calls.length, 2);
});
test('rejects a card moved to a different board', async () => {
  const { fetchImpl } = harness(b => { b[2].card.board_id = '18'; });
  await assert.rejects(verifyScope({ ...input, fetchImpl }), /outside the permitted board/);
});

test('checks scope before invoking a card-content validator', async () => {
  const { fetchImpl } = harness(b => { b[2].card.board_id = '18'; });
  await assert.rejects(verifyScope({ ...input, fetchImpl, validateCard: () => assert.fail('Out-of-scope card content must not be inspected') }), /outside the permitted board/);
});
test('rejects a different workspace and archived resources', async () => {
  for (const change of [b => { b[0].project.team_id = 'other'; }, b => { b[2].card.archived = { time_archived: 1 }; }]) {
    const { fetchImpl } = harness(change);
    await assert.rejects(verifyScope({ ...input, fetchImpl }));
  }
});
test('fails on authentication errors without logging response bodies', async () => {
  await assert.rejects(verifyScope({ ...input, fetchImpl: async () => ({ ok: false, status: 401 }) }), /HTTP 401/);
});
test('requires credentials and valid path identifiers before any network request', async () => {
  const fetchImpl = async () => assert.fail('Unexpected request');
  for (const overrides of [{ token: '' }, { teamId: '../other' }, { scope: { ...scope, board_route_id: '../18' } }]) {
    await assert.rejects(verifyScope({ ...input, ...overrides, fetchImpl }));
  }
});
