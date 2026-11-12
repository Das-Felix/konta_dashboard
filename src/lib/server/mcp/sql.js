/**
 * Prüfung und Aufbereitung für freie SQL-Abfragen über MCP.
 *
 * Die eigentliche Sicherheit kommt aus der Verbindung (`db.js`): read-only
 * und mit `statement_timeout`. Hier kommt dazu: nur SELECT/WITH, ein festes
 * Zeilenlimit, keine Tabellen mit Geheimnissen und keine Hash- oder
 * Secret-Spalten im Ergebnis. Das ist eine Schutzschicht gegen Versehen,
 * keine Grenze gegen Angriffe; die bietet nur eine Rolle mit Spaltenrechten
 * (siehe README).
 */

/** Tabellen, die nur Hashes und Secrets enthalten. */
export const BLOCKED_TABLES = ['user_tokens', 'two_factor_backup_codes'];

/** Spalten, die nie ausgegeben werden. */
export const SECRET_COLUMNS = ['passwordHash', 'twoFactorSecret', 'tokenHash', 'codeHash'];

export const DEFAULT_ROW_LIMIT = 200;
export const MAX_ROW_LIMIT = 1000;
const MAX_VALUE_LENGTH = 2000;

const SECRET_COLUMN_SET = new Set(SECRET_COLUMNS.map((name) => name.toLowerCase()));

/**
 * Entfernt führende Kommentare, damit der erste echte Befehl geprüft wird.
 *
 * @param {string} sql
 * @returns {string}
 */
function stripLeadingComments(sql) {
	let rest = sql.trimStart();
	for (;;) {
		if (rest.startsWith('--')) {
			const end = rest.indexOf('\n');
			rest = end === -1 ? '' : rest.slice(end + 1).trimStart();
		} else if (rest.startsWith('/*')) {
			const end = rest.indexOf('*/');
			rest = end === -1 ? '' : rest.slice(end + 2).trimStart();
		} else {
			return rest;
		}
	}
}

/**
 * @param {string} sql
 * @param {number} limit
 * @returns {{ ok: true, text: string, params: [number], limit: number } | { ok: false, error: string }}
 */
export function prepareSql(sql, limit = DEFAULT_ROW_LIMIT) {
	const body = sql.trim().replace(/;+\s*$/, '');
	const head = stripLeadingComments(body).replace(/^\(+\s*/, '');
	if (!/^(select|with)\b/i.test(head)) {
		return { ok: false, error: 'Erlaubt sind nur Abfragen mit SELECT oder WITH.' };
	}
	const lower = body.toLowerCase();
	for (const table of BLOCKED_TABLES) {
		if (new RegExp(`\\b${table}\\b`).test(lower)) {
			return { ok: false, error: `Die Tabelle ${table} enthält nur Geheimnisse und ist gesperrt.` };
		}
	}
	for (const column of SECRET_COLUMNS) {
		if (lower.includes(column.toLowerCase())) {
			return { ok: false, error: `Die Spalte "${column}" ist gesperrt.` };
		}
	}
	const safeLimit = Math.min(MAX_ROW_LIMIT, Math.max(1, Math.trunc(limit) || DEFAULT_ROW_LIMIT));
	// Zeilenumbrüche, damit ein `--`-Kommentar am Ende nicht das Limit schluckt.
	// Das Limit als Parameter erzwingt das Extended Protocol (eine Anweisung).
	// Eine Zeile mehr holen, um abgeschnittene Ergebnisse zu erkennen.
	return {
		ok: true,
		text: `SELECT * FROM (\n${body}\n) AS q LIMIT $1::int`,
		params: [safeLimit + 1],
		limit: safeLimit
	};
}

/**
 * @param {string} name
 * @returns {boolean}
 */
export function isSecretColumn(name) {
	return SECRET_COLUMN_SET.has(name.toLowerCase());
}

/**
 * Kürzt lange Werte (z. B. JSON im Änderungsprotokoll), damit Antworten
 * klein bleiben. Datumswerte bleiben erhalten und werden beim Serialisieren
 * zu ISO-Strings.
 *
 * @param {unknown} value
 * @returns {unknown}
 */
export function compactValue(value) {
	if (typeof value === 'string') {
		return value.length > MAX_VALUE_LENGTH
			? `${value.slice(0, MAX_VALUE_LENGTH)}… (${value.length} Zeichen, gekürzt)`
			: value;
	}
	if (value && typeof value === 'object' && !(value instanceof Date)) {
		const json = JSON.stringify(value);
		if (json && json.length > MAX_VALUE_LENGTH) {
			return `${json.slice(0, MAX_VALUE_LENGTH)}… (${json.length} Zeichen, gekürzt)`;
		}
	}
	return value;
}

/**
 * Entfernt Secret-Spalten und kürzt lange Werte.
 *
 * @param {Record<string, unknown>[]} rows
 * @returns {Record<string, unknown>[]}
 */
export function sanitizeRows(rows) {
	return rows.map((row) => {
		/** @type {Record<string, unknown>} */
		const clean = {};
		for (const [key, value] of Object.entries(row)) {
			if (isSecretColumn(key)) continue;
			clean[key] = compactValue(value);
		}
		return clean;
	});
}
