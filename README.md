# Engineering Automation Platform

Reusable GitHub automation for PR checks, advisory AI review, Superthread traceability, coordinated releases, and controlled deployments.

## Current status

The first reusable Node.js CI workflow and its demo adoption automation are prepared locally. GitHub publication and PR execution are the next validation steps. Security scans, Superthread/AI integrations, deployments, and release automation have not yet been implemented.

The initial pilot targets the public repository `ShubhamSPawade/engineering-platform` on GitHub Free. The account owner reports that the repository has been created and the initial planning documents uploaded. The platform will support separate installations under other GitHub accounts and organizations through configurable repository ownership, integration settings, and deployment adapters.

## Implementation plan

Read [the implementation plan](Implementation%20Plan%20-%20Engineering%20Automation%20Platform.md) for architecture, work packages, dependencies, release policies, recovery requirements, and acceptance criteria.

The initial tools are GitHub Actions, Superthread, PR-Agent, Semgrep, Gitleaks, OSV-Scanner, Release Please, and applicable language/container checks. Java is outside the current scope. Artifact storage, deployment hosting, and the AI provider remain to be confirmed.

## First milestone

Inventory pilot repositories, validate GitHub capabilities, confirm Superthread configuration, and demonstrate the frozen candidate/version/tag lifecycle before implementing production release automation.

## Pilot application

The local `demo-api/` folder contains the Node.js pilot application, tests, packaging scripts, Dockerfile, and standalone CI. It is ignored by this platform repository so it can be published as its own `engineering-demo-api` repository. Its README documents local verification and publication commands.

## Shared CI

See [shared Node CI adoption](docs/shared-node-ci.md) for the configurable workflow, the stable required-check gate, and the single publishing command. The publisher pins the demo caller to the actual platform commit and opens a PR into dev without changing protected branches directly.
