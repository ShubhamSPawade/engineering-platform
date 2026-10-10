import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDiff, renderComment, marker } from '../scripts/advisory-ai-review.mjs';

const config = { max_files: 2, max_diff_bytes: 500, max_output_chars: 30, model: 'fixture' };
const file = { filename: 'src/app.mjs', status: 'modified', patch: '@@ -1 +1 @@\n-old\n+new' };
test('builds bounded text patches and records omitted binary files', () => {
  const result = buildDiff([file, { filename: 'image.png' }], config);
  assert.match(result.diff, /--- a\/src\/app.mjs/);
  assert.deepEqual(result.omitted, ['image.png']);
});
test('rejects path traversal, malformed names, oversized and empty diffs', () => {
  for (const filename of ['../secret', '/secret', 'bad\nname', 'a/../../secret']) assert.throws(() => buildDiff([{ ...file, filename }], config));
  assert.throws(() => buildDiff([file, file, file], config));
  assert.throws(() => buildDiff([{ ...file, patch: 'x'.repeat(501) }], config));
  assert.throws(() => buildDiff([{ filename: 'image.png' }], config));
});
test('unavailable AI is visible and remains advisory', () => {
  const result = renderComment({ request: { head_sha: 'abc' }, modelResult: 'failure', config, runUrl: 'https://example.com' });
  assert.ok(result.startsWith(marker));
  assert.match(result, /Unavailable/);
  assert.match(result, /does not block merging/);
});
test('output is bounded, mentions suppressed and omissions disclosed', () => {
  const result = renderComment({ request: { head_sha: 'abc', omitted: ['image.png'] }, review: '@someone '.repeat(20), modelResult: 'success', config, runUrl: 'https://example.com' });
  assert.match(result, /truncated/);
  assert.match(result, /Excluded 1/);
  assert.ok(!result.includes('@someone'));
});
