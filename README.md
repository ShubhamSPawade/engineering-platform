# Engineering Automation Platform

Reusable GitHub automation for PR checks, advisory AI review, Superthread traceability, coordinated releases, and controlled deployments.

## Current status

Shared Node.js CI and security checks are adopted through merged demo PRs #1 and #2. Superthread PR linking and merged-status display are confirmed, and live API verification confirmed card ST-1754 in Engineering Demo within test-demo. PR #4 installed trusted ticket validation; the existing ruleset now requires both demo-verify and superthread-ticket on dev, staging and main. Live missing-ticket and wrong-workspace tests on PR #5 failed and blocked merging. PRs #6 and #7 installed advisory PR-Agent review with Gemini. After Gemini 3.8 Flash timed out, PR #10 selected Gemini 3.1 Flash-Lite; PR #11 demonstrated successful inference and a posted advisory comment with all required checks passing. Finding quality evaluation remains pending. Card completion automation, hosted deployments, release automation, and durable synchronization remain to be implemented.

The initial pilot targets the public repository `ShubhamSPawade/engineering-platform` on GitHub Free. The account owner reports that the repository has been created and the initial planning documents uploaded. The platform will support separate installations under other GitHub accounts and organizations through configurable repository ownership, integration settings, and deployment adapters.

## Implementation plan

Read [the implementation plan](Implementation%20Plan%20-%20Engineering%20Automation%20Platform.md) for architecture, work packages, dependencies, release policies, recovery requirements, and acceptance criteria.

The initial tools are GitHub Actions, Superthread, PR-Agent with Gemini, Semgrep, Gitleaks, OSV-Scanner, Release Please, and applicable language/container checks. Java is outside the current scope. Artifact storage and deployment hosting remain to be confirmed.

## First milestone

Inventory pilot repositories, validate GitHub capabilities, confirm Superthread configuration, and demonstrate the frozen candidate/version/tag lifecycle before implementing production release automation.

## Pilot application

The local `demo-api/` folder contains the Node.js pilot application, tests, packaging scripts, Dockerfile, and callers for the shared CI/security workflows. It is ignored by this platform repository and published separately as `engineering-demo-api`.

## Shared CI

See [shared Node CI adoption](docs/shared-node-ci.md) for the configurable workflow, the stable required-check gate, and the single publishing command. The publisher pins the demo caller to the actual platform commit and opens a PR into dev without changing protected branches directly.

## Shared security

See [Superthread pilot setup](docs/superthread-pilot.md) for the confirmed native PR link and the manual, read-only API scope verifier.

The [shared security baseline](docs/shared-security.md) adds Gitleaks, npm dependency validation/OSV, and focused Semgrep rules. The demo has adopted it through PR #2, and all security jobs and the required demo-verify gate passed on GitHub. With no third-party npm dependencies, OSV validates the empty inventory and skips vulnerability scanning.

## Advisory review

See [PR-Agent and Gemini setup](docs/advisory-ai-review.md) for the pinned open-source reviewer, separated job credentials, input limits, safe diagnostics, and unavailable-provider recovery. AI findings are advisory and do not change the required merge gates.

Reviewdog source-line annotations are adopted through demo PR #12. A temporary eval fixture produced an annotation and blocked merging; it was removed before clean CI passed and the PR merged. See [shared security evidence](docs/shared-security.md).

The approved [card-content policy](docs/superthread-content-policy.md) is adopted through demo PR #13 after the user saved non-empty Acceptance criteria and Test plan sections on ST-1754. A read-only audit confirmed readiness; the subsequent live PR #14 passed the required scope-and-content ticket check. This verifies structural readiness at check time, not acceptance-criteria fulfillment. The [lifecycle policy](docs/superthread-lifecycle-policy.md) additionally rejects cancelled cards and unresolved native blockers; card-change reconciliation remains pending.

The [shared work templates](docs/work-templates.md) define PR verification/release/recovery details, bug and feature intake forms, and a reusable Superthread card description. Demo PR #15 adopted them after all checks passed; their presence on the default branch was verified. Native Superthread template installation remains unverified; the description is ready to copy within the approved demo board.

Demo PR #16 expands intake to seven issue forms and review to a 21-item PR checklist. Matching category/triage labels and maintainer-assigned priority/breaking-change labels are configured and verified in both repositories. The versioned label configuration and synchronization script support later repository or organization adoption.
