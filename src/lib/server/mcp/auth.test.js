import { describe, expect, it } from 'vitest';
import { extractMcpKey, isBlocked, keysMatch, registerFailure } from './auth.js';

const KEY = 'k'.repeat(40);

/**
 * @param {string} path
 * @param {Record<string, string>} [headers]
 */
function call(path, headers = {}) {
	const url = new URL(path, 'https://admin.konta.at');
	return extractMcpKey(new Request(url, { method: 'POST', headers }), url);
}

describe('MCP-Anmeldung', () => {
	it('liest den Key aus dem Bearer-Header', () => {
		expect(call('/mcp', { authorization: `Bearer ${KEY}` })).toBe(KEY);
		expect(call('/mcp', { authorization: `bearer ${KEY}` })).toBe(KEY);
	});

	it('liest den Key aus der URL, der Header hat Vorrang', () => {
		expect(call(`/mcp?key=${KEY}`)).toBe(KEY);
		expect(call('/mcp?key=aus-url', { authorization: `Bearer ${KEY}` })).toBe(KEY);
	});

	it('liefert null ohne Key', () => {
		expect(call('/mcp')).toBeNull();
		expect(call('/mcp?key=', { authorization: 'Basic abc' })).toBeNull();
	});

	it('vergleicht Keys', () => {
		expect(keysMatch(KEY, KEY)).toBe(true);
		expect(keysMatch('falsch', KEY)).toBe(false);
		expect(keysMatch(null, KEY)).toBe(false);
		expect(keysMatch(KEY, undefined)).toBe(false);
	});

	it('sperrt eine Adresse nach zu vielen Fehlversuchen', () => {
		const now = 1_000_000;
		for (let i = 0; i < 19; i += 1) registerFailure('10.0.0.1', now);
		expect(isBlocked('10.0.0.1', now)).toBe(false);
		registerFailure('10.0.0.1', now);
		expect(isBlocked('10.0.0.1', now)).toBe(true);
		expect(isBlocked('10.0.0.2', now)).toBe(false);
		expect(isBlocked('10.0.0.1', now + 16 * 60 * 1000)).toBe(false);
	});
});
