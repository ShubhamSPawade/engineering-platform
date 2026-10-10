import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { ticketFromPr, checkTicket } from '../scripts/check-superthread-ticket.mjs';

const scope = JSON.parse(await readFile(new URL('../configs/superthread-scope.json', import.meta.url), 'utf8'));
const pr = {
  title: 'docs: ticket policy ST-1754',
  body: scope.pilot_card_url,
  base: { ref: 'dev', repo: { full_name: scope.github_repository } },
  head: { ref: 'chore/ST-1754-ticket-policy' },
};
test('accepts one consistent registered ticket reference', () => assert.equal(ticketFromPr(pr, scope), '1754'));
test('rejects missing, conflicting, ambiguous and wrong-workspace references', () => {
  for (const overrides of [
    { title: 'no ticket' }, { title: 'ST-1754 ST-1755' }, { body: '' },
    { body: 'https://app.superthread.com/other/card-1754-test' },
    { body: 'https://app.superthread.com/cardtree/card-1755-test' },
    { body: `${pr.body}\n${pr.body}` }, { head: { ref: 'fix/ST-1755-conflict' } },
    { base: { ref: 'dev', repo: { full_name: 'another/repository' } } },
  ]) assert.throws(() => ticketFromPr({ ...pr, ...overrides }, scope));
});
test('shell-like PR text is treated only as data', () => {
  assert.equal(ticketFromPr({ ...pr, title: 'ST-1754 $(echo unsafe) `unsafe`' }, scope), '1754');
});
test('missing ticket fails before contacting Superthread', async () => {
  await assert.rejects(checkTicket({ pr: { ...pr, title: 'no ticket' }, scope, token: 'fixture', fetchImpl: async () => assert.fail('Network must not run') }), /title must contain/);
});
test('registered scope rejects a card from another board and authentication failure', async () => {
  for (const mode of ['wrong-board', 'authentication']) {
    let calls = 0;
    const fetchImpl = async () => {
      calls++;
      if (mode === 'authentication') return { ok: false, status: 401 };
      const bodies = [
        { project: { id: '9', team_id: scope.team_id, title: 'test-demo' } },
        { board: { id: '17', team_id: scope.team_id, project_id: '9', title: 'Engineering Demo' } },
        { card: { id: '1754', team_id: scope.team_id, project_id: '9', board_id: '18' } },
      ];
      return { ok: true, json: async () => bodies[calls - 1] };
    };
    await assert.rejects(checkTicket({ pr, scope, token: 'fixture', fetchImpl }), mode === 'wrong-board' ? /outside the permitted board/ : /HTTP 401/);
  }
});
test('unverified scope cannot be used for a merge gate', async () => {
  await assert.rejects(checkTicket({ pr, scope: { ...scope, scope_verified_via_api: false }, token: 'fixture' }), /not been verified/);
});

test('live card content is validated after membership and rejects missing sections', async () => {
  const contentPolicy = { mode: 'enforce', required_sections: ['Acceptance criteria', 'Test plan'], max_content_bytes: 65536 };
  for (const content of ['', 'Acceptance criteria\nChecks pass\nTest plan\nRun tests']) {
    const bodies = [
      { project: { id: '9', team_id: scope.team_id, title: scope.space_name } },
      { board: { id: '17', team_id: scope.team_id, project_id: '9', title: scope.board_name } },
      { card: { id: '1754', team_id: scope.team_id, project_id: '9', board_id: '17', content } },
    ];
    let index = 0;
    const input = { pr, scope, token: 'fixture', contentPolicy, fetchImpl: async () => ({ ok: true, json: async () => bodies[index++] }) };
    if (!content) await assert.rejects(checkTicket(input), /non-empty, unique/);
    else assert.equal((await checkTicket(input)).card_content.ready, true);
    assert.equal(index, 3);
  }
});
