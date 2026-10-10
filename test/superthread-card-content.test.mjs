import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectCardContent, enforceCardContent } from '../scripts/superthread-card-content.mjs';
const policy = { mode: 'enforce', required_sections: ['Acceptance criteria', 'Test plan'], max_content_bytes: 65536 };
test('accepts Markdown and rich-text HTML section content without returning text', () => {
  for (const content of ['## Acceptance criteria\n- PR checks pass.\n## Test plan\nRun npm test.', '<h2>Acceptance criteria</h2><p>PR checks pass.</p><h2>Test plan</h2><p>Run npm test.</p>', '<p><strong>Acceptance criteria</strong></p><p>PR checks pass.</p><p><strong>Test plan</strong></p><p>Run npm test.</p>']) {
    assert.deepEqual(enforceCardContent(content, policy), { acceptance_criteria: true, test_plan: true, ready: true });
  }
});
test('rejects missing, empty, placeholder and duplicate required sections', () => {
  for (const content of ['', 'Acceptance criteria\nTest plan', 'Acceptance criteria\nTODO\nTest plan\nTBD', 'Acceptance criteria\n## Notes\nUnrelated notes\nTest plan\nRun tests', 'Acceptance criteria\nWorks\nAcceptance criteria\nDuplicate\nTest plan\nRun tests']) assert.throws(() => enforceCardContent(content, policy), /requires non-empty, unique/);
});
test('does not accept headings inside comments, scripts or fenced code as sections', () => {
  for (const content of ['<!-- Acceptance criteria\nWorks\nTest plan\nRun tests -->', '<script>Acceptance criteria\nWorks\nTest plan\nRun tests</script>', '```\nAcceptance criteria\nWorks\nTest plan\nRun tests\n```']) assert.equal(inspectCardContent(content, policy).ready, false);
});
test('rejects unsupported and oversized content without leaking content', () => {
  for (const content of [{ type: 'doc' }, 'private'.repeat(20000)]) assert.deepEqual(inspectCardContent(content, policy), { acceptance_criteria: false, test_plan: false, ready: false });
});
