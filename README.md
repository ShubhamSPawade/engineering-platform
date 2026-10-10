# Engineering Automation Platform

Reusable GitHub automation for PR checks, advisory AI review, Superthread traceability, coordinated releases, and controlled deployments.

## Current status

Shared Node.js CI and security checks are published and adopted through merged demo PRs #1 and #2, with successful GitHub runs. The user confirmed that pilot PR #3 appeared on Superthread card ST-1754 in Engineering Demo, within test-demo; PR #3 has merged into dev. Authenticated ticket validation, status automation, AI review, hosted deployments, and release automation remain to be implemented.

The initial pilot targets the public repository `ShubhamSPawade/engineering-platform` on GitHub Free. The account owner reports that the repository has been created and the initial planning documents uploaded. The platform will support separate installations under other GitHub accounts and organizations through configurable repository ownership, integration settings, and deployment adapters.

## Implementation plan

Read [the implementation plan](Implementation%20Plan%20-%20Engineering%20Automation%20Platform.md) for architecture, work packages, dependencies, release policies, recovery requirements, and acceptance criteria.

The initial tools are GitHub Actions, Superthread, PR-Agent, Semgrep, Gitleaks, OSV-Scanner, Release Please, and applicable language/container checks. Java is outside the current scope. Artifact storage, deployment hosting, and the AI provider remain to be confirmed.

## First milestone

Inventory pilot repositories, validate GitHub capabilities, confirm Superthread configuration, and demonstrate the frozen candidate/version/tag lifecycle before implementing production release automation.

## Pilot application

The local `demo-api/` folder contains the Node.js pilot application, tests, packaging scripts, Dockerfile, and callers for the shared CI/security workflows. It is ignored by this platform repository and published separately as `engineering-demo-api`.

## Shared CI

See [shared Node CI adoption](docs/shared-node-ci.md) for the configurable workflow, the stable required-check gate, and the single publishing command. The publisher pins the demo caller to the actual platform commit and opens a PR into dev without changing protected branches directly.

## Shared security

See [Superthread pilot setup](docs/superthread-pilot.md) for the confirmed native PR link and the manual, read-only API scope verifier.

The [shared security baseline](docs/shared-security.md) adds Gitleaks, npm dependency validation/OSV, and focused Semgrep rules. The demo has adopted it through PR #2, and all security jobs and the required demo-verify gate passed on GitHub. With no third-party npm dependencies, OSV validates the empty inventory and skips vulnerability scanning.
