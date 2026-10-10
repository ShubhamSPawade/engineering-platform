# Superthread pilot

The only registered scope is `cardtree` / `test-demo` (space 9) / Engineering Demo (board 17) / pilot card ST-1754. The user confirmed that PR #3 appeared on the card and later showed merged. On 2026-10-10, the [live read-only verification run](https://github.com/ShubhamSPawade/engineering-platform/actions/runs/38061705298) also verified workspace `tg14m1lv`, the active space and board identities, and the card's membership. The verified registration is saved in `configs/superthread-scope.json`.

## Credentials

In Superthread, open **Settings > Account > API access**, create a personal access token, and copy the workspace's API Team ID. The URL slug `cardtree` is not assumed to be the API Team ID. [Official authentication documentation](https://superthread.com/docs/api-docs/auth)

In the **engineering-platform** GitHub repository's **Settings > Secrets and variables > Actions**, add:

- Repository secret `SUPERTHREAD_API_TOKEN`: the personal access token.
- Repository variable `SUPERTHREAD_TEAM_ID`: the API Team ID for this workspace.

Enter the token directly in GitHub; do not put it in chat, source files, or command arguments. The verification workflow runs manually from the trusted platform branch, never from application PR code.

The application repository also needs its own `SUPERTHREAD_API_TOKEN` repository secret for PR checks. The gate reads the verified API Team ID from the pinned platform registration. Repository secrets are not automatically shared across personal-account repositories.

## Verification

Run `Verify Superthread Pilot Scope` from main. It sends only GET requests for the registered space, board, and card, in that order. It verifies workspace identity, names, active resources, and board/card membership. It refuses redirects, stops on mismatches or API failures, and prints only verified IDs. It does not update configuration or mutate Superthread. Verification is evidence at the time of the run; future ticket checks must recheck current membership.

The API calls use [Get a space](https://superthread.com/docs/api-docs/spaces/get-a-space), [Get a board](https://superthread.com/docs/api-docs/boards/get-a-board), and [Get a card](https://superthread.com/docs/api-docs/cards/get-a-card). Superthread's legacy API name `project` refers to a space.

## Required PR ticket check

Demo PR #4 installed the commit-pinned reusable ticket workflow. It runs on `pull_request_target`, checks out only the approved platform revision, and treats PR metadata as data. It never checks out or executes application code and does not inherit unrelated secrets. It uses the GitHub token only to read current PR metadata and publish the `superthread-ticket` commit status; Superthread access remains GET-only.

Every PR into dev, staging or main needs exactly one `ST-<ID>` reference in its title and exactly one matching full card URL in its description. A branch reference, if present, must agree. The card must be active and belong to the registered board and space. Missing or conflicting references, an unregistered workspace/repository, incorrect membership, archived resources, and API failures fail closed. The gate rechecks metadata before publishing success; edits and new commits trigger a fresh result.

`superthread-ticket` is required alongside `demo-verify` in the existing ruleset, with GitHub Actions as the expected publisher. `scripts/require-superthread-ticket.ps1 -VerifiedHead <successful PR head SHA>` adds the gate only after a successful live status exists and preserves all existing rules. The foundation configuration script also preserves additional required checks on subsequent runs.

This pilot validates ticket identity and current membership. Mandatory card content, dependency/cancellation policies, multi-card release tracking, durable event delivery, reconciliation, merge queues, and approved exceptions remain future work. Native merged status is separate from card completion: completion requires successful production deployment. Repository administrators can edit trusted workflow policy; independent policy-change review remains pending in the solo pilot.

Implementation follows GitHub's [trusted PR workflow guidance](https://docs.github.com/en/actions/reference/security/securely-using-pull_request_target). A distinct commit status is published on the PR head so the base workflow run is not confused with application CI.

## Pilot evidence

- Valid ST-1754 metadata and live membership: [successful ticket run](https://github.com/ShubhamSPawade/engineering-demo-api/actions/runs/38062327189).
- Missing title reference with enforcement active: [failed run](https://github.com/ShubhamSPawade/engineering-demo-api/actions/runs/38062508746); PR #5 merge state was BLOCKED.
- Wrong-workspace URL with enforcement active: [failed run](https://github.com/ShubhamSPawade/engineering-demo-api/actions/runs/38062579885); PR #5 merge state was BLOCKED. The failure occurred before any Superthread request.
- Wrong-board, archived resource and API-error cases: local test fixtures; no other Superthread space or board was modified to perform these checks.
