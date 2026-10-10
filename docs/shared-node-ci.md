# Shared Node CI adoption

The platform supplies `.github/workflows/reusable-node-ci.yml`; each application supplies commands and receives its own source checkout. The caller does not check out the platform repository as the application. All third-party actions use immutable commit SHAs, token access is read-only, credentials are not persisted, and no secrets are passed or inherited.

## Publish the first workflow and create the demo PR

From a terminal with working GitHub authentication:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "D:\All\Projects\CodePipeline\scripts\publish-shared-node-ci.ps1"
```

The script checks both remotes and working trees, commits only the selected platform files, pushes platform main, reads its full commit SHA, and verifies the remote workflow exists at that revision. It then creates/switches the demo adoption branch, renders the caller, commits/pushes it, and opens a PR into dev. It preserves other staged work by stopping before changes and never force-pushes or bypasses rules. A rejected push or failed API call stops later steps; already successful earlier steps remain in place. Rerunning uses the existing branch/open PR.

The platform main branch is currently the publishing branch. If protections are added there later, publish the platform workflow through its own PR before rendering application callers; this initial script intentionally does not bypass protection.

The local demo keeps its working standalone CI until publication supplies a real platform SHA. The template under `templates/` is not an executable GitHub workflow and must not be installed without rendering.

## Required status check compatibility

Reusable jobs can change displayed check names. The demo caller therefore keeps a separate job named `demo-verify`, depending on the shared workflow. It always runs and passes only when the shared workflow result is success. Failure, cancellation, or skipping cannot be treated as success. Existing branch rules continue to require `demo-verify`; do not remove that gate during migration.

## Inputs

| Input | Default | Demo |
| --- | --- | --- |
| `node-version` | `24` | Version file takes precedence |
| `node-version-file` | Empty | `.nvmrc` |
| `working-directory` | `.` | `.` |
| `install-command` | `npm ci` | Empty; no dependencies |
| `check-command` | `npm run check` | Same |
| `test-command` | `npm test` | Same |
| `build-command` | `npm run build` | Same |
| `smoke-command` | Empty | `node scripts/smoke.mjs dist/src/server.mjs` |
| `container-build` | `false` | `true` |

Required check/test/build commands cannot be blank. Repository commands are intentionally executable and must remain under review like workflow files. The workflow runs PR code without privileged deployment credentials. Docker builds validate packaging but do not publish an image or deploy it. Optional skipped installation/smoke/container steps are explicit per-repository choices, not substitutes for failed required checks.

## Verify and merge

```powershell
gh pr checks chore/adopt-shared-node-ci --repo ShubhamSPawade/engineering-demo-api --watch
```

After the run, confirm both shared `node-ci` and the existing `demo-verify` gate succeeded. Confirm the caller references a full 40-character SHA, and the required check remains enforced by the active ruleset. Merge through the PR only after successful verification. This automation does not auto-merge.

To recover from a broken platform upgrade, open a reviewed PR pointing the application caller to the last known-good platform SHA. Do not alter the required gate or force-push a protected branch.

For another account/organization, publish the reusable workflow in an accessible repository and render the caller with that owner/repository and its reviewed SHA. Private workflow-sharing permissions must be configured for that installation.

Reference: [GitHub reusable workflow documentation](https://docs.github.com/en/actions/how-tos/reuse-automations/reuse-workflows).
