import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

function requireValue(condition, message) {
  if (!condition) throw new Error(message);
}

function identifier(value, label) {
  requireValue(typeof value === 'string' && /^[A-Za-z0-9_-]+$/.test(value), `${label} is missing or invalid.`);
  return value;
}

// Only GET requests to three explicitly registered resources are supported.
export async function verifyScope({ scope, teamId, token, cardId = scope.pilot_card_route_id, fetchImpl = fetch, validateCard }) {
  identifier(teamId, 'SUPERTHREAD_TEAM_ID');
  requireValue(typeof token === 'string' && token.trim().length > 0 && !/[\r\n]/.test(token), 'SUPERTHREAD_API_TOKEN is missing or invalid.');
  requireValue(scope.policy?.allow_other_spaces === false && scope.policy?.allow_workspace_configuration_changes === false, 'Scope must forbid other spaces and workspace configuration changes.');
  const spaceId = identifier(scope.space_route?.match(/^space-([A-Za-z0-9_]+)$/)?.[1], 'Registered space ID');
  const boardId = identifier(scope.board_route_id, 'Registered board ID');
  identifier(cardId, 'Ticket card ID');

  async function get(resource, id, key) {
    let response;
    try {
      response = await fetchImpl(`https://api.superthread.com/v1/${teamId}/${resource}/${id}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        redirect: 'error',
        signal: AbortSignal.timeout(30_000),
      });
    } catch {
      throw new Error(`Superthread ${key} request failed; check connectivity. No response details are logged.`);
    }
    requireValue(response.ok, `Superthread ${key} request failed (HTTP ${response.status}).`);
    let body;
    try { body = await response.json(); } catch { throw new Error(`Superthread ${key} response is not valid JSON.`); }
    const entity = body?.[key];
    requireValue(entity && typeof entity === 'object', `Superthread ${key} response is missing its resource.`);
    requireValue(entity.id === id && entity.team_id === teamId, `Superthread ${key} identity does not match registration.`);
    requireValue(!entity.archived && !entity.deleted, `Registered ${key} is archived or deleted.`);
    return entity;
  }

  const space = await get('projects', spaceId, 'project');
  requireValue(space.title === scope.space_name, 'Registered space name does not match.');
  const board = await get('boards', boardId, 'board');
  requireValue(board.project_id === spaceId, 'Registered board is outside the permitted space.');
  requireValue(board.title === scope.board_name, 'Registered board name does not match.');
  const card = await get('cards', cardId, 'card');
  requireValue(card.board_id === boardId && card.project_id === spaceId, 'Pilot card is outside the permitted board or space.');
  requireValue(!card.archived_board && !card.archived_list, 'Pilot card belongs to an archived board or list.');
  // Return only the identifiers needed for registration, never full API responses.
  return { team_id: teamId, api_space_id: spaceId, board_id: boardId, pilot_card_id: cardId, scope_verified_via_api: true,
    ...(validateCard ? { card_content: validateCard(card) } : {}) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const scope = JSON.parse(await readFile(new URL('../configs/superthread-scope.json', import.meta.url), 'utf8'));
    const policy = JSON.parse(await readFile(new URL('../configs/superthread-content-policy.json', import.meta.url), 'utf8'));
    const { inspectCardContent } = await import('./superthread-card-content.mjs');
    const receipt = await verifyScope({ scope, teamId: process.env.SUPERTHREAD_TEAM_ID, token: process.env.SUPERTHREAD_API_TOKEN,
      validateCard: card => inspectCardContent(card.content, policy) });
    console.log(JSON.stringify(receipt, null, 2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
