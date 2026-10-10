# Superthread card readiness

The user approved requiring both non-empty **Acceptance criteria** and **Test plan** sections on 2026-10-10. The prepared check reads only a card already verified inside Engineering Demo in test-demo. It does not mutate cards, inspect other spaces or send card content to the AI reviewer. It returns/logs only readiness flags and controlled missing-section messages.

Supported content is a Markdown/plain-text description or HTML headings/paragraphs, including standalone bold labels. Required sections must occur exactly once and contain text beyond blank markup or placeholders such as TODO/TBD. Unsupported rich-text objects and content over 65,536 bytes are rejected. This is a structural completeness check; it cannot prove that requirements are correct or fulfilled. Dependency and cancellation policies remain pending.

The manual **Verify Superthread Pilot Scope** workflow audits readiness without changing the required gate. Before adoption, verify card ST-1754 passes the audit. Then update the demo's pinned ticket workflow through a PR; the adopted trusted workflow will enforce readiness for subsequent PRs. Verify a valid live card passes before merging adoption. Missing-content behavior can be tested with local fixtures without editing unrelated cards or exposing their text.

The policy was adopted into demo dev through [PR #13](https://github.com/ShubhamSPawade/engineering-demo-api/pull/13). After the user saved both sections, [audit 38071157144](https://github.com/ShubhamSPawade/engineering-platform/actions/runs/38071157144) returned all readiness flags true. The subsequent [PR #14 ticket run](https://github.com/ShubhamSPawade/engineering-demo-api/actions/runs/38071277705) passed and published `ST-1754 scope and required card sections verified`. The positive live path and missing/blank/duplicate content fixtures are verified; no unrelated card was modified for negative testing.

Suggested description for [ST-1754](https://app.superthread.com/cardtree/card-1754-test-github-pr-integration), preserving any existing relevant details:

```markdown
## Acceptance criteria
- GitHub PRs link to this card and show their current status.
- Required CI, security and ticket checks pass before merging.
- Security findings appear as source-line annotations in PR checks.
- Merging into dev does not automatically complete deployment-dependent work.

## Test plan
- Open a PR into dev with ST-1754 in its title and this card's full URL in its body.
- Verify the native PR link and status on this card.
- Verify valid CI and ticket checks succeed.
- In a sandbox PR, verify a never-invoked eval fixture produces an annotation and blocks merging; remove it before merge.
```

Configuration: `configs/superthread-content-policy.json`. The scope audit reads it but reports flags only. The adopted ticket driver enforces both sections. Other installations remain on their prior policy until explicitly upgraded. Card edits alone do not emit a GitHub PR event; rerun validation after editing. Scheduled reconciliation, dependency/cancellation rules and deployment-dependent card completion remain pending.

Initial live audit: [run 38070690394](https://github.com/ShubhamSPawade/engineering-platform/actions/runs/38070690394) verified the registered scope and returned `acceptance_criteria=false`, `test_plan=false`, `ready=false`. Card text was not logged. The user was asked to add both sections before enforcement adoption; no card or workspace was modified by the audit.
