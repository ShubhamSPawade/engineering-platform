const statuses = new Set(['backlog', 'committed', 'started', 'completed', 'cancelled']);
const relations = new Set(['blocks', 'blocked_by', 'related', 'duplicates']);

// Safe metadata only: never return card titles, content or linked-resource IDs.
export function inspectCardLifecycle(card) {
  const links = card.linked_cards;
  return {
    status: statuses.has(card.status) ? card.status : 'unknown',
    linked_cards_present: Object.hasOwn(card, 'linked_cards'),
    links_valid: Array.isArray(links) && links.every(link => link && relations.has(link.linked_card_type)),
    blocking_count: Array.isArray(links) ? links.filter(link => link?.linked_card_type === 'blocked_by').length : null,
  };
}

export async function enforceCardLifecycle({ card, scope, readCard, policy }) {
  if (policy?.mode !== 'enforce' || !Number.isSafeInteger(policy.max_blockers) || policy.max_blockers < 0 || policy.max_blockers > 20) {
    throw new Error('Card lifecycle enforcement policy is invalid.');
  }
  if (!statuses.has(card.status)) throw new Error('Ticket status is missing or unknown.');
  if (card.status === 'cancelled') throw new Error('Ticket is cancelled; restore or replace the linked card.');
  const snapshot = inspectCardLifecycle(card);
  if (!snapshot.links_valid) throw new Error('Ticket dependency metadata is missing or invalid.');
  const blockers = card.linked_cards.filter(link => link.linked_card_type === 'blocked_by');
  if (blockers.length > policy.max_blockers) throw new Error('Ticket exceeds the supported dependency limit.');
  const seen = new Set();
  // Validate every blocker route before reading any additional resource.
  for (const link of blockers) {
    if (typeof link.card_id !== 'string' || !/^[1-9][0-9]*$/.test(link.card_id) || link.card_id === card.id || seen.has(link.card_id)) {
      throw new Error('Ticket has an invalid, duplicate or self dependency.');
    }
    seen.add(link.card_id);
    if (link.project_id !== scope.api_space_id || link.board_id !== scope.board_id) {
      throw new Error('Blocking dependency is outside the registered board or space.');
    }
  }
  for (const link of blockers) {
    const dependency = await readCard(link.card_id);
    if (!statuses.has(dependency.status)) throw new Error('Blocking dependency status is missing or unknown.');
    if (dependency.status !== 'completed') throw new Error('Blocking dependency is unresolved or cancelled.');
  }
  return { not_cancelled: true, blocking_dependencies: blockers.length, dependencies_resolved: true };
}
