<!-- Title: conventional type(scope): ST-<ID> summary. Link exactly one card below. -->
## Linked ticket
<!-- Paste the Superthread card URL. Confirm its Acceptance criteria and Test plan are filled in. -->

## Change
<!-- Explain the problem, resulting behavior, and scope. Map the change to the card's acceptance criteria. -->

## Compatibility and release impact
<!-- Select and explain: patch (compatible fix), minor (compatible feature), major (breaking change), or no application release (documentation/tooling only). Mention affected consumers and components. This declaration does not automatically set a version. -->

## Verification
<!-- List actual commands and results, regression coverage, and any manual checks. Explain checks that were not run. -->
- [ ] The change is focused; unrelated changes and generated output have been reviewed.
- [ ] Relevant tests cover the changed behavior.
- [ ] Regression cases, invalid inputs and failure paths are covered where applicable.
- [ ] Required CI and ticket checks pass for the latest commit.
- [ ] Acceptance criteria have been checked and evidence is recorded.
- [ ] API/contracts and affected consumers have been checked for compatibility.
- [ ] Documentation, examples and configuration references reflect the change.

## Security and reliability
<!-- For each applicable item, verify it before checking. List inapplicable items with a reason below; do not check items for work that was not performed. -->
- [ ] No credentials, tokens, private data or sensitive logs are included.
- [ ] Input validation, authorization and error responses have been reviewed.
- [ ] Dependency/license changes and security findings have been reviewed.
- [ ] Workflow permissions, untrusted PR inputs and action pins have been reviewed for CI changes.
- [ ] Timeouts, retries, idempotency and partial failures have been considered for integrations.
- [ ] Relevant performance, logging and monitoring effects have been checked.

Inapplicable checks and reasons:

## Deployment, migration and recovery
<!-- Describe configuration/secrets, database or API migrations, dependencies and deployment order, plus how to recover. Explicitly state when these do not apply. Never include secret values. -->
- [ ] Required configuration and secret names are documented without values.
- [ ] Migrations and dependency/deployment order are documented and verified where applicable.
- [ ] Deployment verification and rollback/recovery steps are documented.
- [ ] Breaking changes and affected repositories are explicitly identified.

## Review and labels
- [ ] The title uses the agreed conventional type and contains the linked card identifier.
- [ ] The PR has the relevant type label; priority and breaking-change labels are applied when justified.
- [ ] Review findings and discussion threads are resolved or explicitly tracked.
- [ ] Release impact agrees with compatibility notes and the card.

## Follow-up
<!-- Link remaining work or explicitly state none. A merged PR does not prove successful deployment or complete a deployment-dependent card. -->
