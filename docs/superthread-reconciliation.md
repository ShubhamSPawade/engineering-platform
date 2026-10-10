# Superthread ticket reconciliation

The demo ticket caller adds scheduled and manual reconciliation to PR-event checks. The schedule is `7,22,37,52 * * * *` UTC: four planned runs an hour, away from the top of the hour. GitHub runs scheduled workflows from the default branch (`dev` in the pilot). Schedules can be delayed/dropped under load and public-repository schedules can be disabled after 60 days without activity. This is periodic validation, not an instant card webhook or guaranteed freshness deadline. See [GitHub schedule behavior](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule).

Every run lists open PRs into dev, staging and main in the registered repository, then marks their current heads pending before reading Superthread. It validates current PR metadata and live card scope, required content, cancellation and direct blocking dependencies. New success/failure receipts use the existing required `superthread-ticket` status. Card changes therefore do not require a code commit to be detected by the next completed reconciliation. No card content or PR body is logged; output is limited to success/failure counts and controlled status descriptions.

Both PR-event and reconciliation jobs use the same repository-wide concurrency group with cancellation disabled. This serializes status writers. GitHub may replace an older pending job; the next reconciliation recovers by reading current state instead of relying on a lost event. Each result rechecks PR metadata/head before publishing success. Multiple targeted open PRs sharing one head SHA fail closed because commit statuses cannot distinguish their policies; give each PR a distinct commit. No application checkout or execution occurs with integration credentials: only approved platform code from the pinned commit runs.

Run an immediate recheck with:

```powershell
gh workflow run superthread-ticket.yml --repo ShubhamSPawade/engineering-demo-api --ref dev
```

Manual runs on a feature branch are rejected against the repository's current default-branch registration. The pilot supports up to 20 targeted open PRs, repository inventory of at most ten 100-item pages, and fewer than 100 PR associations per commit. An oversized discovered batch is marked failed. Up to four card checks run in parallel; one invalid card does not prevent the others from being checked. GitHub reads and status writes retry transient transport/429/5xx failures at most twice, with bounded backoff; authentication failures are not retried. Superthread calls retain their existing timeouts and fail-closed behavior.

Replay is safe: the same SHA/context receives a fresh outcome; no duplicate cards, comments, deployment actions or tickets are created. Pending/final receipts do add status history. The receipt target URL identifies the verifying run, and its checkout pin identifies the policy version. GitHub holds the current result; this is not a separate durable event database.

If GitHub inventory or status publication is unavailable, the workflow fails and may be unable to invalidate every previous result. Restore API access and dispatch a fresh run. During the polling interval or a delayed/disabled schedule, a prior green can remain visible after a card edit. Confirm a recent successful run before merging sensitive changes. Closing these remaining gaps requires event delivery, a freshness gate and durable state; this milestone does not claim those controls.

Tests cover unchanged-head success/failure/recovery, all-head invalidation before validation, independent outcomes, empty/ignored intake, head/metadata changes, shared heads, batch limits, foreign repositories, partial status-publisher failures, transient retries and trusted default-branch enforcement. Live evidence is recorded after demo adoption and manual revalidation.
