# Card cancellation and dependency policy

The existing required `superthread-ticket` status now has a prepared lifecycle validator in addition to scope and content validation. Demo adoption follows a read-only audit of the real API shape; evidence is recorded below when completed.

The card must expose a known status and cannot be `cancelled`. Other native statuses (`backlog`, `committed`, `started`, `completed`) are accepted; a completed card may need a follow-up correction, so completion alone is not a rejection. Status names are not inferred from human prose. See [Superthread status types](https://superthread.com/docs/help/statuses) and the [API status behavior enum](https://superthread.com/docs/api-docs/boards/create-a-list).

Native `blocked_by` relationships are prerequisites. Every prerequisite route must identify a distinct card in the registered test-demo / Engineering Demo scope before any extra card request is made. Self-links, duplicates, malformed identifiers, unknown relation types and more than ten blockers fail closed. `blocks`, `related` and `duplicates` do not make this card dependent and do not trigger extra reads. See [native relationship types](https://superthread.com/docs/api-docs/cards/add-related-card).

Each prerequisite is fetched afresh using GET; the linked-card preview is not trusted as completion evidence. The current card must still belong to the registered workspace/space/board, be accessible and unarchived, and expose `completed` status. Unfinished/cancelled prerequisites, scope moves, unknown states, invalid metadata and API failures fail the gate. Errors never contain card text or API response bodies. Empty dependency metadata must be explicit and valid; prose mentioning dependencies does not replace native relationships.

Only direct prerequisites are checked. This does not prove deployment completion or inspect transitive dependency graphs. A prerequisite's Superthread completed state is the current human/integration declaration until deployment receipts and completion policy are implemented. No Superthread cards, statuses, relationships or workspace settings are mutated.

Tests exercise cancellation, known/unknown states, dependency limits, self/duplicate links, out-of-scope routes before reads, current dependency status instead of stale previews, moved/archived/inaccessible dependencies and API errors. A scoped live audit reports only safe status/shape/count metadata and content-readiness booleans. Live destructive negative tests on the user's card are not used.

Card edits do not yet trigger a GitHub check automatically. Until reconciliation is implemented, rerun the ticket workflow or push a new PR commit after card/dependency edits. Results describe state at validation time; they are not a transactional lock on Superthread. Manual exception policy, cross-board dependencies, multiple-card PRs and durable reconciliation remain pending.
