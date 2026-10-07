/**
 * Globaler Strom aus dem Änderungsprotokoll und den Login-Versuchen.
 */

import { query, queryOne } from '#lib/server/db.js';

export const ACTIVITY_PAGE_SIZE = 50;

/**
 * @typedef {Object} AuditFeedRow
 * @property {string} id
 * @property {string} entityType
 * @property {string} entityId
 * @property {string} action
 * @property {string | null} summary
 * @property {any} changes
 * @property {any} metadata
 * @property {string} actorType
 * @property {Date} createdAt
 * @property {string | null} userId
 * @property {string | null} firstName
 * @property {string | null} lastName
 * @property {string} companyId
 * @property {string | null} companyName
 * @property {string | null} ownerId Ältester Nutzer des Unternehmens (für Systemeinträge).
 * @property {string | null} ownerFirstName
 * @property {string | null} ownerLastName
 */

/**
 * @param {{ entityType?: string, actorType?: string, page?: number, limit?: number }} params
 * @returns {Promise<{ rows: AuditFeedRow[], total: number }>}
 */
export async function getAuditFeed({
	entityType = '',
	actorType = '',
	page = 1,
	limit = ACTIVITY_PAGE_SIZE
}) {
	const where = `($1 = '' OR l."entityType" = $1) AND ($2 = '' OR l."actorType"::text = $2)`;
	const [rows, count] = await Promise.all([
		query(
			`SELECT l.id, l."entityType", l."entityId", l.action, l.summary, l.changes, l.metadata,
				l."actorType", l."createdAt", l."userId", l."companyId",
				u."firstName", u."lastName", c."companyName",
				owner.id AS "ownerId", owner."firstName" AS "ownerFirstName", owner."lastName" AS "ownerLastName"
			FROM company_audit_logs l
			LEFT JOIN users u ON u.id = l."userId"
			JOIN companies c ON c.id = l."companyId"
			LEFT JOIN LATERAL (SELECT id, "firstName", "lastName" FROM users WHERE "companyId" = c.id ORDER BY "createdAt" LIMIT 1) owner ON TRUE
			WHERE ${where}
			ORDER BY l."createdAt" DESC
			LIMIT $3 OFFSET $4`,
			[entityType, actorType, limit, Math.max(0, page - 1) * limit]
		),
		queryOne(`SELECT count(*) AS total FROM company_audit_logs l WHERE ${where}`, [
			entityType,
			actorType
		])
	]);
	return { rows: /** @type {AuditFeedRow[]} */ (rows), total: count?.total ?? 0 };
}

/**
 * Vorhandene Entitätstypen für den Filter.
 *
 * @returns {Promise<{ entityType: string, value: number }[]>}
 */
export function getAuditEntityTypes() {
	return query(
		`SELECT "entityType", count(*) AS value FROM company_audit_logs GROUP BY 1 ORDER BY 2 DESC`
	);
}

/**
 * Fehlgeschlagene Logins der letzten 24 Stunden, gruppiert nach E-Mail.
 * Für Support ("ich komme nicht rein") und um Angriffe zu erkennen.
 */
export function getFailedLogins() {
	return query(
		`SELECT lower(l.email) AS email, count(*) AS attempts, max(l."createdAt") AS last_at,
			count(DISTINCT l."ipAddress") AS ips,
			array_agg(DISTINCT l.result::text) AS results,
			max(l."userId") AS "userId"
		FROM login_attempts l
		WHERE NOT l.success AND l."createdAt" >= now() AT TIME ZONE 'UTC' - interval '24 hours'
		GROUP BY lower(l.email)
		ORDER BY attempts DESC, last_at DESC
		LIMIT 20`
	);
}
