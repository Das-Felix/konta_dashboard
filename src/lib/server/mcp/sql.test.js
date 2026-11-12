import { describe, expect, it } from 'vitest';
import { MAX_ROW_LIMIT, compactValue, prepareSql, sanitizeRows } from './sql.js';

describe('prepareSql', () => {
	it('lässt SELECT und WITH zu und hängt ein Limit als Parameter an', () => {
		const select = prepareSql('SELECT count(*) FROM users;', 50);
		expect(select).toEqual({
			ok: true,
			text: 'SELECT * FROM (\nSELECT count(*) FROM users\n) AS q LIMIT $1::int',
			params: [51],
			limit: 50
		});
		expect(prepareSql('with t as (select 1) select * from t').ok).toBe(true);
		expect(prepareSql('-- Kommentar\n/* noch einer */ (SELECT 1)').ok).toBe(true);
	});

	it('begrenzt das Zeilenlimit', () => {
		const result = prepareSql('SELECT 1', 50_000);
		expect(result.ok && result.limit).toBe(MAX_ROW_LIMIT);
	});

	it('lehnt schreibende und andere Befehle ab', () => {
		for (const sql of [
			'DELETE FROM users',
			'update users set email = null',
			'INSERT INTO users DEFAULT VALUES',
			'SET default_transaction_read_only = off',
			'-- SELECT\nDROP TABLE users',
			'COPY users TO STDOUT'
		]) {
			expect(prepareSql(sql).ok, sql).toBe(false);
		}
	});

	it('sperrt Tabellen und Spalten mit Geheimnissen', () => {
		expect(prepareSql('SELECT * FROM user_tokens').ok).toBe(false);
		expect(prepareSql('SELECT * FROM "two_factor_backup_codes"').ok).toBe(false);
		expect(prepareSql('SELECT "passwordHash" FROM users').ok).toBe(false);
		expect(prepareSql('SELECT md5("twoFactorSecret") AS x FROM users').ok).toBe(false);
		expect(prepareSql('SELECT "tokenHash" FROM sessions').ok).toBe(false);
		expect(prepareSql('SELECT "lastActiveAt" FROM sessions').ok).toBe(true);
	});
});

describe('sanitizeRows', () => {
	it('entfernt Secret-Spalten und kürzt lange Werte', () => {
		const date = new Date('2026-11-12T10:00:00Z');
		const [row] = sanitizeRows([
			{ id: 'u1', passwordHash: 'x', TokenHash: 'y', createdAt: date, note: 'a'.repeat(3000) }
		]);
		expect(Object.keys(row)).toEqual(['id', 'createdAt', 'note']);
		expect(row.createdAt).toBe(date);
		expect(String(row.note)).toMatch(/gekürzt\)$/);
	});

	it('kürzt große JSON-Werte, lässt kleine stehen', () => {
		expect(compactValue({ a: 1 })).toEqual({ a: 1 });
		expect(compactValue({ a: 'b'.repeat(3000) })).toMatch(/^\{"a":"b+… \(\d+ Zeichen, gekürzt\)$/);
	});
});
