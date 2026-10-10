# Shared security baseline

The reusable workflow runs three scanner jobs concurrently with one another and with application CI. Its security-policy job succeeds only if every scanner job succeeds. The application caller also makes its existing required demo-verify check depend on both shared CI and security, so no ruleset change is needed to enforce this baseline after the PR merges.

## Publish and validate

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "D:\All\Projects\CodePipeline\scripts\publish-shared-security.ps1"
gh pr checks chore/adopt-shared-security --repo ShubhamSPawade/engineering-demo-api --watch
```

The publisher fetches current dev before creating the security branch, publishes platform changes, pins workflows and Semgrep policy to the full platform commit SHA, includes the prepared lockfile, and opens a PR. It never pushes directly to protected demo branches or merges the PR. Preserve the existing demo-verify check and verify it fails whenever a scanner fails.

## Policy

- Gitleaks 8.30.1 scans fetched Git history with built-in rules, full redaction, an explicitly supplied configuration, empty ignore file, and disabled inline allow annotations. Findings and installation/scan failures block the gate. Exposed credentials need removal and rotation; rewriting history alone is not remediation.
- OSV-Scanner 2.6.0 scans the root npm lockfile using an explicit empty exemption configuration. For the dependency-free demo, matching package/lockfile inventories with no external packages are recorded as not applicable to vulnerability lookup. Invalid/missing lockfiles fail. Once dependencies are present, OSV findings or errors block. This first baseline is single-package npm only; workspace/other ecosystem coverage requires a dedicated adapter.
- Semgrep CE 1.180.0 uses four reviewed, versioned JS/TS rules: eval, dynamic Function construction, shell exec, and shell-enabled spawn. Rule fixtures include safe and unsafe cases and run in CI before the application scan. These are initial focused rules, not comprehensive authorization, data-flow, or security coverage. Add relevant vetted rules incrementally. Findings and strict scan/configuration errors block.

Scanners receive read-only tokens and no integration/deployment secrets. Gitleaks and OSV release downloads are verified against fixed SHA-256 digests from their official release assets. Semgrep is installed into an isolated virtual environment at a fixed version; its transitive Python dependencies are resolved by pip and are not fully locked yet. Semgrep metrics are disabled and local rule configuration is used, without an AppSec account/token.

Reports remain in runner-local files/logs for the initial pilot; no dashboard or SARIF upload is configured. Gitleaks output is redacted. GitGuardian continues independently. No automatic vulnerability exceptions or severity downgrades are introduced: this baseline blocks all findings until reviewed policy is established. Protect caller/policy/ignore-file changes during review so a PR cannot casually weaken coverage.

Actual scanners are not installed locally and downloads are blocked in this session. Local validation checks YAML, input contracts, pins, fixture structure, and package/lockfile consistency. The first GitHub PR is required evidence of scanner installation, rule execution, and dependency-free behavior.

After clean execution, validate blocking behavior in a sandbox PR with a benign eval fixture in application source. It should fail Semgrep, security-policy, and demo-verify. Remove the fixture before merging. Do not introduce a real secret for testing.

References: [Gitleaks release assets](https://github.com/gitleaks/gitleaks/releases/expanded_assets/v8.30.1), [OSV release assets](https://github.com/google/osv-scanner/releases/expanded_assets/v2.6.0), [OSV usage](https://google.github.io/osv-scanner/usage/), [Semgrep CLI](https://docs.semgrep.dev/cli-reference).
