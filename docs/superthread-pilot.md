# Superthread pilot

The only registered scope is `cardtree` / `test-demo` (space route 9) / Engineering Demo (board route 17) / pilot card ST-1754. The user confirmed that PR #3 appeared on the card and later showed merged. These observations prove native linking and PR status display; API membership verification is still pending.

## Credentials

In Superthread, open **Settings > Account > API access**, create a personal access token, and copy the workspace's API Team ID. The URL slug `cardtree` is not assumed to be the API Team ID. [Official authentication documentation](https://superthread.com/docs/api-docs/auth)

In the **engineering-platform** GitHub repository's **Settings > Secrets and variables > Actions**, add:

- Repository secret `SUPERTHREAD_API_TOKEN`: the personal access token.
- Repository variable `SUPERTHREAD_TEAM_ID`: the API Team ID for this workspace.

Enter the token directly in GitHub; do not put it in chat, source files, or command arguments. The verification workflow runs manually from the trusted platform branch, never from application PR code.

## Verification

Run `Verify Superthread Pilot Scope` from main. It sends only GET requests for the registered space, board, and card, in that order. It verifies workspace identity, names, active resources, and board/card membership. It refuses redirects, stops on mismatches or API failures, and prints only verified IDs. It does not update configuration or mutate Superthread. Route-derived IDs remain separate from API-verified registration until a live run succeeds.

The API calls use [Get a space](https://superthread.com/docs/api-docs/spaces/get-a-space), [Get a board](https://superthread.com/docs/api-docs/boards/get-a-board), and [Get a card](https://superthread.com/docs/api-docs/cards/get-a-card). Superthread's legacy API name `project` refers to a space.

Ticket enforcement remains pending. Before making it required, implement trusted PR metadata validation and demonstrate missing-ticket, wrong-board, and API failure cases without exposing the token to PR-controlled code. Native merged status is separate from card completion: completion requires successful production deployment.
