/**
 * Anmeldung am MCP-Endpunkt per API-Key (`MCP_API_KEY`).
 *
 * Claude Code schickt den Key als `Authorization: Bearer …`. Custom
 * Connectors in Claude Desktop und claude.ai können keine eigenen Header
 * setzen, dort steht er als `?key=…` in der URL.
 *
 * Bewusst ohne Import aus `$app/env/private`, damit das Modul ohne
 * Umgebung testbar bleibt.
 */

import { createHash, timingSafeEqual } from 'node:crypto';

/**
 * @param {Request} request
 * @param {URL} url
 * @returns {string | null}
 */
export function extractMcpKey(request, url) {
	const header = request.headers.get('authorization')?.trim() ?? '';
	const match = /^Bearer\s+(\S+)$/i.exec(header);
	if (match) return match[1];
	const fromUrl = url.searchParams.get('key')?.trim();
	return fromUrl ? fromUrl : null;
}

/**
 * Vergleicht in konstanter Zeit. Über SHA-256, damit auch unterschiedlich
 * lange Werte nichts über die Länge des Keys verraten.
 *
 * @param {string | null} candidate
 * @param {string | undefined} expected
 * @returns {boolean}
 */
export function keysMatch(candidate, expected) {
	if (!candidate || !expected) return false;
	const left = createHash('sha256').update(candidate).digest();
	const right = createHash('sha256').update(expected).digest();
	return timingSafeEqual(left, right);
}

const FAILURE_LIMIT = 20;
const FAILURE_WINDOW_MS = 15 * 60 * 1000;

/** @type {Map<string, { count: number, resetAt: number }>} */
const failures = new Map();

/**
 * Zu viele falsche Keys von dieser Adresse? Gezählt werden nur Fehlversuche,
 * normale Anfragen von Claude bleiben unbegrenzt.
 *
 * @param {string} ip
 * @param {number} [now]
 * @returns {boolean}
 */
export function isBlocked(ip, now = Date.now()) {
	const entry = failures.get(ip);
	if (!entry) return false;
	if (entry.resetAt < now) {
		failures.delete(ip);
		return false;
	}
	return entry.count >= FAILURE_LIMIT;
}

/**
 * @param {string} ip
 * @param {number} [now]
 */
export function registerFailure(ip, now = Date.now()) {
	const entry = failures.get(ip);
	if (!entry || entry.resetAt < now) {
		failures.set(ip, { count: 1, resetAt: now + FAILURE_WINDOW_MS });
	} else {
		entry.count += 1;
	}
}
