/**
 * Lesezugriff auf die Konta-Datenbank.
 *
 * Das Dashboard schreibt nie. Jede Verbindung startet deshalb mit
 * `default_transaction_read_only = on`; ein versehentliches UPDATE scheitert
 * damit in Postgres selbst, auch wenn die Rolle Schreibrechte hätte.
 *
 * Prisma legt `DateTime` als `timestamp(3)` ohne Zeitzone an und speichert
 * UTC. `pg` würde solche Werte als lokale Zeit lesen, daher der eigene Parser.
 */

import pg from 'pg';
import { DATABASE_URL } from '$app/env/private';

const TIMESTAMP_OID = 1114;
const INT8_OID = 20;
const NUMERIC_OID = 1700;

pg.types.setTypeParser(TIMESTAMP_OID, (value) => new Date(`${value.replace(' ', 'T')}Z`));
// count(*) liefert bigint. Unsere Zähler bleiben weit unter 2^53.
pg.types.setTypeParser(INT8_OID, (value) => Number(value));
pg.types.setTypeParser(NUMERIC_OID, (value) => Number(value));

/** @type {pg.Pool | undefined} */
let pool;

/**
 * @returns {pg.Pool}
 */
function getPool() {
	if (!pool) {
		pool = new pg.Pool({
			connectionString: DATABASE_URL,
			max: 5,
			idleTimeoutMillis: 30_000,
			options: '-c default_transaction_read_only=on -c statement_timeout=15000'
		});
		pool.on('error', (error) => console.error('[db] idle client error', error));
	}
	return pool;
}

/**
 * Führt eine parametrisierte Abfrage aus und liefert die Zeilen.
 *
 * @template {Record<string, any>} [T=Record<string, any>]
 * @param {string} text
 * @param {unknown[]} [params]
 * @returns {Promise<T[]>}
 */
export async function query(text, params = []) {
	const result = await getPool().query(text, params);
	return /** @type {T[]} */ (result.rows);
}

/**
 * Wie `query`, aber genau eine Zeile (oder `null`).
 *
 * @template {Record<string, any>} [T=Record<string, any>]
 * @param {string} text
 * @param {unknown[]} [params]
 * @returns {Promise<T | null>}
 */
export async function queryOne(text, params = []) {
	const rows = await query(text, params);
	return /** @type {T | null} */ (rows[0] ?? null);
}

/**
 * Wandelt eine UTC-Spalte in das Wiener Kalenderdatum um. Alle Tages-
 * auswertungen ("heute", Tagesreihen) zählen nach österreichischer Zeit.
 *
 * @param {string} column bereits gequotete Spalte, z. B. `u."createdAt"`
 * @returns {string}
 */
export function viennaDate(column) {
	return `((${column}) AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Vienna')::date`;
}

/** Heutiges Datum in Wien. */
export const VIENNA_TODAY = `(now() AT TIME ZONE 'Europe/Vienna')::date`;

/**
 * UTC-Zeitstempel (ohne Zone, wie Prisma speichert) für Mitternacht in Wien,
 * `offsetDays` Tage vor heute. Für indexfreundliche `>=`-Vergleiche.
 *
 * @param {number} [offsetDays]
 * @returns {string}
 */
export function viennaDayStart(offsetDays = 0) {
	const day = `(date_trunc('day', now() AT TIME ZONE 'Europe/Vienna') - interval '${Math.trunc(offsetDays)} days')`;
	return `((${day}) AT TIME ZONE 'Europe/Vienna' AT TIME ZONE 'UTC')`;
}
