# Advisory PR-Agent review

Use the existing open-source [PR-Agent](https://github.com/The-PR-Agent/pr-agent), pinned to v0.47.0 commit `8e5a9295973b24af4b70cafd0b660a230811ef9e`, with its upstream frozen dependency lock. The user selected Gemini on 2026-10-10 after disclosure that free-tier public PR data may be used to improve Google's products.

The configured model is `gemini/gemini-3.1-flash-lite`, listed on [Google's pricing page](https://ai.google.dev/gemini-api/docs/pricing) with free-tier input and output. The user requested an alternate model after `gemini/gemini-3.8-flash` timed out. Access and free quota must be proven with the installation's key; a published model listing is not proof of access. PR-Agent's [Gemini configuration guide](https://docs.pr-agent.ai/usage-guide/changing_a_model/#google-ai-studio) describes provider configuration. GitHub Models is unavailable following its [July 2026 retirement](https://github.blog/changelog/2026-07-01-github-models-is-being-fully-retired-on-july-30-2026/).

## Setup

Create a key in [Google AI Studio](https://aistudio.google.com/api-keys) using a project with billing disabled. Store it directly as repository Actions secret `PR_AGENT_GEMINI_KEY` in engineering-demo-api. No provider key belongs in source, chat or command arguments. The workflow cannot inspect Google billing settings, so a free-tier project is an installation prerequisite; quotas can make reviews unavailable.

The demo caller is rendered from `templates/demo-advisory-ai-review.yml` using a full platform commit. Install it through a PR into dev. Like ticket validation, this trusted target workflow needs bootstrap adoption before it automatically reviews subsequent PRs.

## Trust and permissions

Three jobs separate PR reading, model inference and comment publishing:

1. Prepare reads current metadata and at most 40 changed files through the GitHub API. It checks the registered repository and ticket reference, constructs a unified diff from text patches, and rejects unsupported paths, incomplete inventories or more than 50,000 diff bytes. No application checkout, builds or dependency installation occur.
2. Model runs approved PR-Agent code against that diff in a directory outside every checked-out repository, which disables working-tree enrichment. It receives only the Gemini key in a filtered subprocess environment, without GitHub/Superthread credentials or runner command-file paths. Repository/global configuration and extra source context are disabled. It writes files and has no PR-write permission.
3. Publish has PR-comment permission and no Gemini key. It verifies that the PR remains open with the same head and base commits, then updates one bot-owned advisory comment. Model output is treated as text, limited to 40,000 characters, and mentions are suppressed. It never approves, changes source, merges or deploys.

No comment-command triggers are installed. Fork PR data follows the same API-only path, with no fork execution. No Superthread content is fetched for this initial AI integration; acceptance-criteria context enrichment remains pending.

## Limits and degraded operation

PR-Agent is configured for a 12,000-token context ceiling, 2,500 output tokens, low reasoning effort, no fallback model, no client retries and no ask-and-reflect pass. The inference timeout is 180 seconds. Upstream handler retries remain bounded; a timeout is not replayed on the same model. The complete model subprocess is limited to 240 seconds; the job is limited to 12 minutes including dependency installation. These are resource bounds, not a billing-account spending limit. A metadata-only Google API request checks model access before inference. Failure logs contain fixed diagnostic categories and HTTP status codes, without provider response bodies or credentials.

Binary files and files lacking text patches are disclosed as omitted. Oversized/unsupported input, missing credentials, quota errors, installation failures and inference failures produce a visible unavailable comment when the publisher has the prepared request. Earlier infrastructure failures remain visible in the Actions run. A stale or closed PR is never given a newly generated review.

AI is absent from all required merge gates. Required demo-verify and superthread-ticket remain unchanged. Passing CI does not validate AI advice, and no findings are automatically applied.

## Acceptance and evaluation

Live evidence on 2026-10-10: demo PRs [#6](https://github.com/ShubhamSPawade/engineering-demo-api/pull/6), [#7](https://github.com/ShubhamSPawade/engineering-demo-api/pull/7), and [#8](https://github.com/ShubhamSPawade/engineering-demo-api/pull/8) adopted the workflows and diagnostic fixes. PR [#9](https://github.com/ShubhamSPawade/engineering-demo-api/pull/9) passed required CI/security and ticket validation. Its [advisory run](https://github.com/ShubhamSPawade/engineering-demo-api/actions/runs/38067687249) verified Google model metadata access, but PR-Agent inference timed out after 180 seconds. The opt-in direct `Reply OK` request also failed to complete within 30 seconds. The publisher successfully posted an [unavailable comment](https://github.com/ShubhamSPawade/engineering-demo-api/pull/9#issuecomment-6099715454). The diagnostic variable was restored to false.

Integration and degraded feedback are demonstrated; successful inference and finding quality are **not yet demonstrated**. These observations do not establish whether the cause is project access, provider capacity, or connectivity from the runner. Test the same project/model in AI Studio before retrying the workflow. No billing was enabled by this automation.

Before claiming live readiness, demonstrate a completed model call, a posted advisory comment, unavailable-provider behavior and successful CI/ticket checks. Record known-defect detection and false positives over representative PRs before considering enforcement; the plan's suggested sample is at least 20 PRs. The initial pilot is an integration demonstration, not an evaluated quality guarantee.

For a controlled unavailable-path test, set the demo repository Actions variable `PR_AGENT_SIMULATE_UNAVAILABLE=true` and rerun its advisory workflow. This stops before inference and posts unavailable feedback without changing secrets. Restore the variable to false and rerun to recover. This tests degraded workflow behavior, not a real provider outage.

For a transport diagnostic, an operator can temporarily set `PR_AGENT_DIAGNOSE_PROVIDER=true`. After a failed PR-Agent call, this makes one direct Gemini request asking for `OK`, with at most 256 output tokens and a 30-second timeout. It sends no PR data and logs only a fixed result or HTTP/symbolic error status. Disable the variable after diagnosis; normal reviews do not perform this additional inference.
