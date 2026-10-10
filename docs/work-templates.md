# Shared work templates

Canonical templates live in `templates/github/` and `templates/superthread/`. They contain no account, organization, workspace or card defaults. Adopt a reviewed platform commit and copy the GitHub files to the application's `.github/` directory through a PR; review future template changes the same way.

Pilot adoption: [demo PR #15](https://github.com/ShubhamSPawade/engineering-demo-api/pull/15) merged platform templates from `c19838e68321fb6a1a109326cb7d7955fe3ab6eb` into `dev` at `66437142293e313bde99b1bfdbf15bcb5d82d309`. All CI, security, ticket and advisory-review jobs passed. GitHub API reads confirmed both issue forms, chooser configuration, PR template and card-description copy on `dev`. Open the [issue chooser](https://github.com/ShubhamSPawade/engineering-demo-api/issues/new/choose) to use the forms.

Expanded adoption: [demo PR #16](https://github.com/ShubhamSPawade/engineering-demo-api/pull/16) merged the seven-form set and 21-item PR checklist at `31d92d563fa39f69ec4c9cab8c4be407deaf4d1c`. All required CI/security/ticket checks and advisory-review jobs passed. API reads verified the eight chooser/form files on `dev`. All 13 shared labels were synchronized and verified in both platform and demo repositories before merging. The adoption PR itself carried `documentation` and `ci-cd` labels.

The PR template asks for one card URL, behavior and acceptance coverage, compatibility/release impact, verification evidence, migration/deployment order and recovery. Use a conventional PR title containing the real `ST-<ID>`. The required ticket check verifies the card identifier, registered scope and non-empty Acceptance criteria/Test plan sections. Other template declarations remain author/reviewer responsibilities; version calculation and release enforcement are separate pending work.

Bug and feature issue forms collect reproducible behavior or measurable outcomes. A Superthread link is optional at intake so outside reporters can submit issues. During triage, create or link a card in the registered scope before implementation. GitHub issues collect requests; Superthread tracks delivery. Disabling blank issues guides the chooser but does not make form fields a server-side policy for every API request or later edit.

The expanded set adds documentation, maintenance/technical debt, performance investigation, CI/automation and release/deployment planning forms. Required fields ask for the evidence appropriate to each kind of work, including measurements for performance and recovery for releases. No public security-vulnerability form is provided: report suspected vulnerabilities through a private channel agreed with the maintainer, not through public intake.

## Labels and PR checklist

The canonical label names, colors and descriptions are in `configs/github-labels.json`. Run `powershell.exe -NoProfile -File scripts/sync-github-labels.ps1 -Repository OWNER/REPO` before adopting the forms. This explicitly selected repository is the only mutation target. The script creates or updates the 13 named labels, verifies the resulting settings and preserves unrelated labels. Repeating the command is safe; it does not remove labels.

| Issue form | Automatic category label |
| --- | --- |
| Bug report | `bug` |
| Feature request | `enhancement` |
| Documentation improvement | `documentation` |
| Maintenance and technical debt | `maintenance` |
| Performance investigation | `performance` |
| CI and automation problem | `ci-cd` |
| Release and deployment planning | `release` |

All forms also apply `status: needs-triage`. A maintainer removes that label after classification and linking approved delivery work, or after closing an unaccepted request. Choose at most one of `priority: critical`, `priority: high`, `priority: medium`, `priority: low`; use `breaking-change` only for incompatible behavior requiring migration/release planning. Priority is a triage decision, not automatically inferred from the reporter's impact selection. PR category, priority and breaking-change labels are applied by authors or maintainers; there is no automatic PR labeler in this change. Labels do not calculate versions or bypass checks.

The PR checklist now covers focused scope, regression/failure tests, contract compatibility, documentation, credentials/data, authorization/input validation, dependency/license findings, workflow permissions/pins, integration retry/idempotency, performance/observability, configuration, migration, deployment order, recovery and review resolution. Check only work actually verified. Explain inapplicable items in the provided field rather than marking them completed. These checklist entries guide review; they are not new automated merge gates.

GitHub loads issue forms from `.github/ISSUE_TEMPLATE/` on the default branch, which is `dev` in the pilot. See [GitHub's issue form specification](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/syntax-for-issue-forms). The PR template is copied to `.github/pull_request_template.md`.

## Superthread card description

Copy [the engineering card description](../templates/superthread/engineering-card.md) into new engineering cards in **test-demo / Engineering Demo only**. Replace the instruction comments with actual content. Acceptance criteria and Test plan intentionally start empty: the required readiness check must reject an untouched template. The template does not overwrite ST-1754 or its existing evidence.

This repository provides a reusable description, not an installed native Superthread template. The documented API index exposes card creation and duplication but does not list a native card-template endpoint; native installation has not been verified. Copying the description is available immediately. Any native template saved through the UI must be restricted to the approved board; do not change other spaces or workspace defaults. See [Superthread's API index](https://superthread.com/docs/llms.txt).

Dependencies should use native blocked-by links as well as explanation. Dependency/cancellation validation is the next policy step and is not enforced by this template. Completion conditions must distinguish merge evidence from successful deployment for work that needs deployment.
