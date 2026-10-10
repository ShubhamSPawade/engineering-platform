// Structural readiness only; never log or return card text.
export function inspectCardContent(content, policy) {
  if (typeof content !== 'string' || Buffer.byteLength(content, 'utf8') > policy.max_content_bytes) {
    return { acceptance_criteria: false, test_plan: false, ready: false };
  }
  const text = content
    .replace(/<!--[^]*?-->|<(script|style)\b[^>]*>[^]*?<\/\1\s*>/gi, '')
    .replace(/<\/?pre\b[^>]*>/gi, '\n```\n')
    .replace(/<h([1-6])\b[^>]*>/gi, (_, level) => '\n' + '#'.repeat(Number(level)) + ' ')
    .replace(/<\/?(?:p|div|h[1-6]|li|ul|ol)\b[^>]*>|<br\s*\/?\s*>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&(?:nbsp|#160|#x[aA]0);/g, ' ')
    .replace(/&amp;/g, '&');
  const sections = new Map(policy.required_sections.map(name => [name.toLowerCase(), { count: 0, body: [] }]));
  let current;
  let fenced = false;
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (/^(?:```|~~~)/.test(trimmed)) { fenced = !fenced; continue; }
    const heading = !fenced && trimmed.match(/^(?:#{1,6}\s+)?(?:\*\*|__)?(Acceptance criteria|Test plan)(?:\*\*|__)?\s*:?\s*$/i);
    if (heading) {
      current = sections.get(heading[1].toLowerCase());
      if (current) current.count++;
      continue;
    }
    if (!fenced && /^(?:#{1,6}\s+|\*\*[^]+\*\*\s*:?$|[^:]+:\s*$)/.test(trimmed)) current = undefined;
    if (current) current.body.push(trimmed);
  }
  function present(name) {
    const section = sections.get(name);
    return section?.count === 1 && section.body.some(line => {
      const value = line.replace(/^(?:[-*+]|\d+[.)])\s*(?:\[[ xX]\]\s*)?/, '').trim();
      return /[\p{L}\p{N}]/u.test(value) && !/^(?:tbd|todo|n\/a|none|pending)[.!]?$/i.test(value);
    });
  }
  const acceptance_criteria = present('acceptance criteria');
  const test_plan = present('test plan');
  return { acceptance_criteria, test_plan, ready: acceptance_criteria && test_plan };
}

export function enforceCardContent(content, policy) {
  const readiness = inspectCardContent(content, policy);
  if (policy.mode !== 'enforce') throw new Error('Card content enforcement policy is invalid.');
  if (!readiness.ready) {
    const missing = [!readiness.acceptance_criteria && 'Acceptance criteria', !readiness.test_plan && 'Test plan'].filter(Boolean);
    throw new Error(`Card requires non-empty, unique sections: ${missing.join(', ')}.`);
  }
  return readiness;
}
