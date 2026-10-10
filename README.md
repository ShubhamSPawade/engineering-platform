# Engineering Automation Platform

Reusable GitHub automation for PR checks, advisory AI review, Superthread traceability, coordinated releases, and controlled deployments.

## Current status

Planning stage. GitHub workflows, integrations, deployments, and release automation have not been implemented.

The initial pilot targets the public repository `ShubhamSPawade/engineering-platform` on GitHub Free. The account owner reports that the repository has been created; the initial files are pending upload. The platform will support separate installations under other GitHub accounts and organizations through configurable repository ownership, integration settings, and deployment adapters.

## Implementation plan

Read [the implementation plan](Implementation%20Plan%20-%20Engineering%20Automation%20Platform.md) for architecture, work packages, dependencies, release policies, recovery requirements, and acceptance criteria.

The initial tools are GitHub Actions, Superthread, PR-Agent, Semgrep, Gitleaks, OSV-Scanner, Release Please, and applicable language/container checks. Java is outside the current scope. Artifact storage, deployment hosting, and the AI provider remain to be confirmed.

## First milestone

Inventory pilot repositories, validate GitHub capabilities, confirm Superthread configuration, and demonstrate the frozen candidate/version/tag lifecycle before implementing production release automation.
