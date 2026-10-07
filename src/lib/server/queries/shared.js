/**
 * Bausteine, die mehrere Auswertungen teilen.
 */

import { VIENNA_TODAY, query, viennaDate } from '#lib/server/db.js';

/**
 * "Aktiv" heißt: der Nutzer hat im Zeitraum etwas getan, das die Datenbank
 * sieht. Sessions allein reichen nicht (abgelaufene werden gelöscht, und
 * `lastActiveAt` hält nur den letzten Zeitpunkt), daher zusätzlich
 * Änderungsprotokoll und erfolgreiche Logins.
 *
 * Liefert eine Unterabfrage mit den Spalten `"userId"` und `at`.
 */
export const ACTIVITY_SOURCE = `(
	SELECT "userId", "lastActiveAt" AS at FROM sessions
	UNION ALL
	SELECT "userId", "createdAt" AS at FROM sessions
	UNION ALL
	SELECT "userId", "createdAt" AS at FROM company_audit_logs WHERE "userId" IS NOT NULL
	UNION ALL
	SELECT "userId", "createdAt" AS at FROM login_attempts WHERE success AND "userId" IS NOT NULL
)`;

/**
 * @typedef {Object} DayPoint
 * @property {string} day `YYYY-MM-DD` (Wiener Kalendertag)
 * @property {number} value
 */

/**
 * Tagesreihe der letzten `days` Tage (inklusive heute), lückenlos mit 0
 * aufgefüllt.
 *
 * @param {{ days: number, source: string, column: string, valueExpression?: string, where?: string, params?: unknown[] }} options
 *   `source` ist eine Tabelle oder Unterabfrage mit Alias `t`, `column` die
 *   UTC-Zeitspalte (z. B. `t."createdAt"`). Standardwert ist `count(*)`.
 * @returns {Promise<DayPoint[]>}
 */
export async function dailySeries({
	days,
	source,
	column,
	valueExpression = 'count(*)',
	where = 'TRUE',
	params = []
}) {
	const rows = await query(
		`WITH series AS (
			SELECT generate_series(${VIENNA_TODAY} - ($${params.length + 1}::int - 1), ${VIENNA_TODAY}, interval '1 day')::date AS day
		),
		counts AS (
			SELECT ${viennaDate(column)} AS day, ${valueExpression} AS value
			FROM ${source}
			WHERE ${where} AND ${viennaDate(column)} > ${VIENNA_TODAY} - $${params.length + 1}::int
			GROUP BY 1
		)
		SELECT to_char(series.day, 'YYYY-MM-DD') AS day, coalesce(counts.value, 0) AS value
		FROM series LEFT JOIN counts USING (day)
		ORDER BY series.day`,
		[...params, days]
	);
	return rows.map((row) => ({ day: row.day, value: Number(row.value) }));
}

/**
 * Erlaubte Zeiträume für Auswertungen in Tagen.
 */
export const RANGE_OPTIONS = [7, 30, 90];

/**
 * @param {URL} url
 * @param {number} [fallback]
 * @returns {number}
 */
export function parseRange(url, fallback = 30) {
	const value = Number(url.searchParams.get('range'));
	return RANGE_OPTIONS.includes(value) ? value : fallback;
}
