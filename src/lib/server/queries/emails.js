/**
 * Plattform-Mails aus `email_logs`: was die App automatisch verschickt hat
 * (Testzeitraum, Onboarding, Sicherheit, Bestätigungscodes, Support,
 * Benachrichtigungen) und was dabei schiefging.
 *
 * Eine Zeile entsteht beim Versuch (`createdAt`), `sentAt` erst bei Erfolg.
 * Zeiträume zählen deshalb nach `createdAt`. `FAILED` wird von der App bis zu
 * `MAX_ATTEMPTS`-mal wiederholt, `PENDING` älter als 15 Minuten ist liegen
 * geblieben (Prozess während des Versands gestorben).
 */

import { query, queryOne, viennaDayStart } from '#lib/server/db.js';
import { dailySeries } from './shared.js';

/** Wie `MAX_ATTEMPTS` in `konta_app/src/lib/server/email/send-once.js`. */
export const MAX_ATTEMPTS = 3;

export const EMAIL_PAGE_SIZE = 30;

/** Status-Filter der Protokoll-Liste. */
export const EMAIL_STATUS_FILTERS = {
	alle: { label: 'Alle', where: 'TRUE' },
	versendet: { label: 'Versendet', where: `l.status = 'SENT'` },
	fehlgeschlagen: { label: 'Fehlgeschlagen', where: `l.status = 'FAILED'` },
	uebersprungen: { label: 'Übersprungen', where: `l.status = 'SKIPPED'` },
	laeuft: { label: 'Läuft', where: `l.status = 'PENDING'` }
};

const STALE_PENDING = `l.status = 'PENDING' AND l."updatedAt" < now() AT TIME ZONE 'UTC' - interval '15 minutes'`;

/** @param {number} days */
const since = (days) => `l."createdAt" >= ${viennaDayStart(days - 1)}`;

/**
 * Kennzahlen im Zeitraum.
 *
 * @param {number} days
 */
export async function getEmailSummary(days) {
	const row = await queryOne(
		`SELECT count(*) AS total,
			count(*) FILTER (WHERE l.status = 'SENT') AS sent,
			count(*) FILTER (WHERE l.status = 'FAILED') AS failed,
			count(*) FILTER (WHERE l.status = 'SKIPPED') AS skipped,
			count(*) FILTER (WHERE l.status = 'PENDING') AS pending,
			count(DISTINCT l."userId") FILTER (WHERE l.status = 'SENT') AS recipients,
			(SELECT count(*) FROM email_logs l WHERE ${STALE_PENDING}) AS stale
		FROM email_logs l
		WHERE ${since(days)}`
	);
	return {
		total: row?.total ?? 0,
		sent: row?.sent ?? 0,
		failed: row?.failed ?? 0,
		skipped: row?.skipped ?? 0,
		pending: row?.pending ?? 0,
		recipients: row?.recipients ?? 0,
		// Unabhängig vom Zeitraum: hängt jetzt gerade.
		stale: row?.stale ?? 0
	};
}

/**
 * Versendete und fehlgeschlagene Mails pro Tag.
 *
 * @param {number} days
 */
export async function getEmailSeries(days) {
	const [sent, failed] = await Promise.all([
		dailySeries({
			days,
			source: 'email_logs t',
			column: 't."createdAt"',
			where: `t.status = 'SENT'`
		}),
		dailySeries({
			days,
			source: 'email_logs t',
			column: 't."createdAt"',
			where: `t.status = 'FAILED'`
		})
	]);
	return { sent, failed };
}

/**
 * Aufschlüsselung nach Mail-Typ im Zeitraum.
 *
 * @param {number} days
 */
export async function getEmailTypes(days) {
	const rows = await query(
		`SELECT l.type,
			count(*) AS total,
			count(*) FILTER (WHERE l.status = 'SENT') AS sent,
			count(*) FILTER (WHERE l.status = 'FAILED') AS failed,
			count(*) FILTER (WHERE l.status = 'SKIPPED') AS skipped,
			max(l."sentAt") AS "lastSentAt"
		FROM email_logs l
		WHERE ${since(days)}
		GROUP BY l.type
		ORDER BY total DESC`
	);
	return rows.map((row) => ({
		type: /** @type {string} */ (row.type),
		total: Number(row.total),
		sent: Number(row.sent),
		failed: Number(row.failed),
		skipped: Number(row.skipped),
		lastSentAt: /** @type {Date | null} */ (row.lastSentAt)
	}));
}

/** Alle Typen, die im Protokoll vorkommen (für den Filter). */
export async function getEmailTypeOptions() {
	const rows = await query(`SELECT DISTINCT type FROM email_logs ORDER BY type`);
	return rows.map((row) => /** @type {string} */ (row.type));
}

/**
 * @typedef {Object} EmailLogRow
 * @property {string} id
 * @property {string} type
 * @property {'PENDING' | 'SENT' | 'FAILED' | 'SKIPPED'} status
 * @property {number} attempts
 * @property {string | null} toEmail
 * @property {string | null} error
 * @property {string | null} messageId
 * @property {Date | null} sentAt
 * @property {Date} createdAt
 * @property {Date} updatedAt
 * @property {string | null} userId
 * @property {string | null} firstName
 * @property {string | null} lastName
 * @property {string | null} companyName
 * @property {boolean} stale
 */

/**
 * Protokoll, neueste zuerst. Unabhängig vom Zeitraum, damit sich auch ältere
 * Mails finden lassen.
 *
 * @param {{ search: string, status: keyof typeof EMAIL_STATUS_FILTERS, type: string | null, page: number }} options
 */
export async function listEmailLogs({ search, status, type, page }) {
	/** @type {unknown[]} */
	const params = [];
	const where = [EMAIL_STATUS_FILTERS[status].where];
	if (type) {
		params.push(type);
		where.push(`l.type = $${params.length}`);
	}
	if (search) {
		params.push(`%${search.replace(/[\\%_]/g, (char) => `\\${char}`)}%`);
		const p = `$${params.length}`;
		where.push(`(l."toEmail" ILIKE ${p} OR u.email ILIKE ${p}
			OR (u."firstName" || ' ' || u."lastName") ILIKE ${p} OR c."companyName" ILIKE ${p}
			OR l."messageId" ILIKE ${p} OR l."userId" = $${params.length + 1})`);
		params.push(search);
	}
	const from = `FROM email_logs l
		LEFT JOIN users u ON u.id = l."userId"
		LEFT JOIN companies c ON c.id = u."companyId"
		WHERE ${where.join(' AND ')}`;

	const [rows, count] = await Promise.all([
		query(
			`SELECT l.id, l.type, l.status, l.attempts, l."toEmail", l.error, l."messageId",
				l."sentAt", l."createdAt", l."updatedAt", l."userId",
				u."firstName", u."lastName", c."companyName",
				(${STALE_PENDING}) AS stale
			${from}
			ORDER BY l."createdAt" DESC
			LIMIT ${EMAIL_PAGE_SIZE} OFFSET $${params.length + 1}`,
			[...params, (page - 1) * EMAIL_PAGE_SIZE]
		),
		queryOne(`SELECT count(*) AS total ${from}`, params)
	]);
	return { rows: /** @type {EmailLogRow[]} */ (rows), total: count?.total ?? 0 };
}

/**
 * Mails eines Nutzers für die Detailseite.
 *
 * @param {string} userId
 */
export function getUserEmails(userId) {
	return query(
		`SELECT l.id, l.type, l.status, l.attempts, l."toEmail", l.error, l."sentAt",
			l."createdAt", l."updatedAt", (${STALE_PENDING}) AS stale
		FROM email_logs l
		WHERE l."userId" = $1
		ORDER BY l."createdAt" DESC
		LIMIT 100`,
		[userId]
	);
}
