import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ticketFromPr } from './check-superthread-ticket.mjs';

export const marker = '<!-- engineering-platform:advisory-ai-review -->';
export function buildDiff(files, config) {
  if (!Array.isArray(files) || files.length > config.max_files) throw new Error('PR exceeds the advisory file limit.');
  const omitted = [];
  const patches = [];
  for (const file of files) {
    // Reject control characters and path traversal before constructing diff headers.
    if (typeof file.filename !== 'string' || !/^[A-Za-z0-9_.\/-]+$/.test(file.filename) || file.filename.startsWith('/') || file.filename.split('/').includes('..')) {
      throw new Error('PR contains a filename unsupported by the bounded reviewer.');
    }
    if (typeof file.patch !== 'string' || !file.patch.trim()) { omitted.push(file.filename); continue; }
    const oldPath = file.status === 'added' ? '/dev/null' : `a/${file.filename}`;
    const newPath = file.status === 'removed' ? '/dev/null' : `b/${file.filename}`;
    patches.push(`diff --git a/${file.filename} b/${file.filename}\n--- ${oldPath}\n+++ ${newPath}\n${file.patch}\n`);
  }
  const diff = patches.join('\n');
  if (!diff.trim()) throw new Error('No reviewable text patches were returned.');
  if (Buffer.byteLength(diff, 'utf8') > config.max_diff_bytes) throw new Error('PR exceeds the advisory diff size limit.');
  return { diff, omitted };
}

export function renderComment({ request, review, modelResult, config, runUrl }) {
  const heading = `${marker}\n### Advisory AI review\n\nCommit: \`${request.head_sha}\` · Model: \`${config.model}\` · [Workflow run](${runUrl})\n\n`;
  if (modelResult !== 'success' || typeof review !== 'string' || !review.trim()) {
    return `${heading}**Unavailable:** model inference or review preparation did not complete. Check the workflow run for details. This advisory result does not block merging; required CI, security, and ticket checks still apply.`;
  }
  const truncated = review.length > config.max_output_chars;
  // Suppress accidental mention notifications. Model output is never executed.
  const body = review.slice(0, config.max_output_chars).replace(/@/g, '@\u200b');
  const omissions = request.omitted?.length ? `\n\nExcluded ${request.omitted.length} file(s) without text patches.` : '';
  return `${heading}AI findings need human verification. This is a review of the supplied patches, with no application execution.\n\n${body}${truncated ? '\n\nReview output was truncated to the configured limit.' : ''}${omissions}\n\nRequired merge checks remain authoritative. The AI does not approve, merge, deploy, or complete Superthread cards.`;
}

async function run(mode) {
  const config = JSON.parse(await readFile(new URL('../configs/ai-review.json', import.meta.url), 'utf8'));
  const scope = JSON.parse(await readFile(new URL('../configs/superthread-scope.json', import.meta.url), 'utf8'));
  const event = JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH, 'utf8'));
  const repository = process.env.GITHUB_REPOSITORY;
  if (repository !== config.repository || repository !== scope.github_repository || process.env.GITHUB_EVENT_NAME !== 'pull_request_target') throw new Error('Unregistered repository or untrusted review event.');
  const number = event.pull_request?.number;
  const sha = event.pull_request?.head?.sha;
  if (!Number.isSafeInteger(number) || !/^[a-f0-9]{40}$/.test(sha ?? '')) throw new Error('Invalid review event identity.');
  if (!process.env.GITHUB_TOKEN) throw new Error('GitHub authentication is missing.');
  async function github(path, method = 'GET', body) {
    let response;
    try {
      response = await fetch(`https://api.github.com/repos/${repository}/${path}`, {
        method, redirect: 'error', signal: AbortSignal.timeout(30_000),
        headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    } catch { throw new Error('GitHub review request failed.'); }
    if (!response.ok) throw new Error(`GitHub review request failed (HTTP ${response.status}).`);
    return response.json();
  }
  const root = process.env.AI_REVIEW_DIR;
  if (!root) throw new Error('Review work directory is missing.');
  await mkdir(root, { recursive: true });
  if (mode === 'prepare') {
    // Save a minimal fallback so publish can report a preparation outage.
    const request = { number, head_sha: sha, base_sha: event.pull_request.base.sha, omitted: [] };
    await writeFile(join(root, 'request.json'), JSON.stringify(request));
    const pr = await github(`pulls/${number}`);
    if (pr.state !== 'open' || pr.head.sha !== sha) throw new Error('Review event is stale.');
    ticketFromPr(pr, scope);
    if (pr.draft) throw new Error('Draft PR review is deferred until ready for review.');
    const files = await github(`pulls/${number}/files?per_page=100`);
    if (files.length !== pr.changed_files) throw new Error('PR file inventory is incomplete.');
    const prepared = buildDiff(files, config);
    const current = await github(`pulls/${number}`);
    if (current.head.sha !== sha || current.base.sha !== pr.base.sha) throw new Error('PR changed while fetching patches.');
    await writeFile(join(root, 'change.diff'), prepared.diff);
    await writeFile(join(root, 'request.json'), JSON.stringify({ ...request, base_sha: pr.base.sha, omitted: prepared.omitted }));
    console.log(`Prepared ${files.length - prepared.omitted.length} text patches for advisory review.`);
  } else if (mode === 'publish') {
    const request = JSON.parse(await readFile(join(root, 'request.json'), 'utf8'));
    if (request.number !== number || request.head_sha !== sha) throw new Error('Review artifact does not match the event.');
    const current = await github(`pulls/${number}`);
    if (current.state !== 'open' || current.head.sha !== sha || current.base.sha !== request.base_sha) {
      console.log('Skipped stale or closed PR review; no comment was posted.');
      return;
    }
    let review = '';
    try { review = await readFile(join(root, 'review.md'), 'utf8'); } catch { /* Visible unavailable result below. */ }
    const runUrl = `https://github.com/${repository}/actions/runs/${process.env.GITHUB_RUN_ID}`;
    const body = renderComment({ request, review, modelResult: process.env.AI_MODEL_RESULT, config, runUrl });
    const comments = [];
    for (let page = 1; page <= 10; page++) {
      const batch = await github(`issues/${number}/comments?per_page=100&page=${page}`);
      comments.push(...batch);
      if (batch.length < 100) break;
      if (page === 10) throw new Error('PR comment inventory exceeds the supported limit.');
    }
    const previous = comments.find(c => c.user?.login === 'github-actions[bot]' && c.body?.startsWith(marker));
    await github(previous ? `issues/comments/${previous.id}` : `issues/${number}/comments`, previous ? 'PATCH' : 'POST', { body });
    console.log('Published advisory review comment.');
  } else throw new Error('Unsupported review operation.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run(process.argv[2]).catch(error => { console.error(error.message); process.exitCode = 1; });
}
