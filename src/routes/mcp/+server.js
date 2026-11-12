/**
 * MCP-Endpunkt (Streamable HTTP, zustandslos) für Claude.
 *
 * Anmeldung per `MCP_API_KEY`: als `Authorization: Bearer …` (Claude Code)
 * oder `?key=…` (Custom Connector in Claude Desktop und claude.ai). Ohne
 * gesetzten Key gibt es den Endpunkt nicht.
 */

import { MCP_API_KEY } from '$app/env/private';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { extractMcpKey, isBlocked, keysMatch, registerFailure } from '#lib/server/mcp/auth.js';
import { createMcpServer } from '#lib/server/mcp/server.js';

/**
 * @param {number} status
 * @param {string} message
 * @param {Record<string, string>} [headers]
 */
function jsonError(status, message, headers = {}) {
	return new Response(
		JSON.stringify({ jsonrpc: '2.0', error: { code: -32001, message }, id: null }),
		{ status, headers: { 'content-type': 'application/json', ...headers } }
	);
}

/** @type {import('./$types').RequestHandler} */
export async function POST({ request, url, getClientAddress }) {
	if (!MCP_API_KEY) return new Response('Not found', { status: 404 });

	const ip = getClientAddress();
	if (isBlocked(ip)) return jsonError(429, 'Zu viele falsche Keys. Bitte später erneut versuchen.');
	if (!keysMatch(extractMcpKey(request, url), MCP_API_KEY)) {
		registerFailure(ip);
		return jsonError(401, 'API-Key fehlt oder ist falsch.', {
			'www-authenticate': 'Bearer realm="konta-admin"'
		});
	}

	const server = createMcpServer();
	const transport = new WebStandardStreamableHTTPServerTransport({
		sessionIdGenerator: undefined,
		enableJsonResponse: true
	});
	try {
		await server.connect(transport);
		return await transport.handleRequest(request);
	} finally {
		// JSON-Modus: die Antwort ist fertig, Server und Transport werden nicht mehr gebraucht.
		await server.close().catch(() => {});
	}
}

/** Kein SSE-Strom und keine Sessions im zustandslosen Modus. */
function methodNotAllowed() {
	if (!MCP_API_KEY) return new Response('Not found', { status: 404 });
	return new Response('Method not allowed', { status: 405, headers: { allow: 'POST' } });
}

export const GET = methodNotAllowed;
export const DELETE = methodNotAllowed;
