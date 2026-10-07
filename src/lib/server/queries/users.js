/**
 * Nutzerliste und Nutzerdetail.
 */

import { query, queryOne } from '#lib/server/db.js';

export const PAGE_SIZE = 25;

/**
 * Filter der Nutzerliste. Schlüssel = URL-Wert.
 *
 * @type {Record<string, { label: string, where: string }>}
 */
export const USER_FILTERS = {
	alle: { label: 'Alle', where: 'TRUE' },
	test: { label: 'Im Test', where: `s.status = 'TRIALING'` },
	zahlend: { label: 'Zahlend', where: `s.status = 'ACTIVE'` },
	zahlung_offen: { label: 'Zahlung offen', where: `s.status = 'PAST_DUE'` },
	abgelaufen: { label: 'Test abgelaufen', where: `s.status = 'TRIAL_EXPIRED'` },
	gekuendigt: { label: 'Gekündigt', where: `s.status = 'CANCELED'` },
	onboarding: { label: 'Onboarding offen', where: `u."onboardingCompletedAt" IS NULL` },
	unbestaetigt: { label: 'E-Mail offen', where: `u."emailVerifiedAt" IS NULL` }
};

/** @type {Record<string, { label: string, orderBy: string }>} */
export const USER_SORTS = {
	neu: { label: 'Neueste zuerst', orderBy: 'u."createdAt" DESC' },
	aktiv: { label: 'Zuletzt aktiv', orderBy: 'last_active DESC NULLS LAST' },
	belege: { label: 'Meiste Belege', orderBy: 'receipts DESC, u."createdAt" DESC' },
	name: { label: 'Name', orderBy: 'u."lastName" ASC, u."firstName" ASC' }
};

/**
 * @typedef {Object} UserListRow
 * @property {string} id
 * @property {string} firstName
 * @property {string} lastName
 * @property {string} email
 * @property {Date} createdAt
 * @property {Date | null} emailVerifiedAt
 * @property {Date | null} onboardingCompletedAt
 * @property {string | null} onboardingStep
 * @property {boolean} twoFactorEnabled
 * @property {string | null} companyName
 * @property {string} vatMode
 * @property {string | null} plan
 * @property {string | null} status
 * @property {Date | null} trialEndsAt
 * @property {Date | null} last_active
 * @property {number} receipts
 * @property {number} invoices
 */

/**
 * @param {{ search: string, filter: string, sort: string, page: number }} params
 * @returns {Promise<{ rows: UserListRow[], total: number, counts: Record<string, number> }>}
 */
export async function listUsers({ search, filter, sort, page }) {
	const filterWhere = (USER_FILTERS[filter] ?? USER_FILTERS.alle).where;
	const orderBy = (USER_SORTS[sort] ?? USER_SORTS.neu).orderBy;
	const term = search.trim();
	const searchWhere = term
		? `(u.email ILIKE $1 OR u."firstName" || ' ' || u."lastName" ILIKE $1 OR c."companyName" ILIKE $1 OR u.id = $2 OR c.id = $2 OR u.phone ILIKE $1)`
		: `($1::text IS NULL AND $2::text IS NULL)`;
	const like = term ? `%${term.replace(/[%_\\]/g, (char) => `\\${char}`)}%` : null;
	const exact = term || null;

	const base = `FROM users u
		JOIN companies c ON c.id = u."companyId"
		LEFT JOIN company_subscriptions s ON s."companyId" = c.id`;

	const [rows, countRow] = await Promise.all([
		query(
			`SELECT u.id, u."firstName", u."lastName", u.email, u."createdAt", u."emailVerifiedAt",
				u."onboardingCompletedAt", u."onboardingStep", u."twoFactorEnabled",
				c."companyName", c."vatMode", s.plan, s.status, s."trialEndsAt",
				activity.last_active,
				(SELECT count(*) FROM invoices i WHERE i."companyId" = c.id AND i.source IN ('UPLOADED', 'MANUAL')) AS receipts,
				(SELECT count(*) FROM issued_invoices ii WHERE ii."companyId" = c.id AND ii.status = 'ISSUED') AS invoices
			${base}
			LEFT JOIN LATERAL (
				SELECT greatest(
					(SELECT max("lastActiveAt") FROM sessions WHERE "userId" = u.id),
					(SELECT max("createdAt") FROM company_audit_logs WHERE "userId" = u.id),
					(SELECT max("createdAt") FROM login_attempts WHERE "userId" = u.id AND success)
				) AS last_active
			) activity ON TRUE
			WHERE ${searchWhere} AND ${filterWhere}
			ORDER BY ${orderBy}
			LIMIT ${PAGE_SIZE} OFFSET $3`,
			[like, exact, Math.max(0, page - 1) * PAGE_SIZE]
		),
		queryOne(
			`SELECT count(*) AS total,
				${Object.entries(USER_FILTERS)
					.map(([key, { where }]) => `count(*) FILTER (WHERE ${where}) AS "${key}"`)
					.join(',\n')}
			${base}
			WHERE ${searchWhere}`,
			[like, exact]
		)
	]);

	/** @type {Record<string, number>} */
	const counts = {};
	for (const key of Object.keys(USER_FILTERS)) counts[key] = countRow?.[key] ?? 0;

	return {
		rows: /** @type {UserListRow[]} */ (rows),
		total: counts[filter] ?? countRow?.total ?? 0,
		counts
	};
}

/**
 * Alles, was die Datenbank über einen Nutzer weiß.
 *
 * @param {string} userId
 */
export async function getUserDetail(userId) {
	const user = await queryOne(
		`SELECT u.id, u.email, u."firstName", u."lastName", u.phone, u."createdAt", u."updatedAt",
			u."emailVerifiedAt", u."companyId", u."companyRole", u."onboardingStep",
			u."onboardingCompletedAt", u."termsAcceptedAt", u."marketingConsentAt",
			u."guideDismissedAt", u."guideCompletedAt", u."twoFactorEnabled", u."twoFactorEnabledAt",
			c."companyName", c."companyType", c.street, c."postalCode", c.city, c.country,
			c."taxNumber", c."vatId", c.email AS "companyEmail", c."vatMode", c."uvaPeriod",
			c."uvaTaxPointMethod", c.iban, c.experimental, c."extractionModel",
			c."createdAt" AS "companyCreatedAt",
			s.plan, s.status, s."trialEndsAt", s."stripeCustomerId", s."stripeSubscriptionId",
			s."billingInterval", s."currentPeriodEnd", s."cancelAtPeriodEnd", s."stripeSyncedAt",
			s."lastSyncSource",
			sv."leadSource", sv."leadSourceOther", sv."hasTaxAdvisor", sv."currentTool",
			sv."currentToolOther",
			ns."emailEnabled" AS "notificationEmailEnabled"
		FROM users u
		JOIN companies c ON c.id = u."companyId"
		LEFT JOIN company_subscriptions s ON s."companyId" = c.id
		LEFT JOIN onboarding_surveys sv ON sv."userId" = u.id
		LEFT JOIN user_notification_settings ns ON ns."userId" = u.id
		WHERE u.id = $1`,
		[userId]
	);
	if (!user) return null;

	const companyId = user.companyId;

	const [
		counts,
		teammates,
		guide,
		sessions,
		logins,
		audit,
		notifications,
		failedExtractions,
		failedRuns,
		dailyActivity
	] = await Promise.all([
		queryOne(
			`SELECT
				(SELECT count(*) FROM invoices WHERE "companyId" = $1 AND source = 'UPLOADED') AS receipts_uploaded,
				(SELECT count(*) FROM invoices WHERE "companyId" = $1 AND source = 'MANUAL') AS receipts_manual,
				(SELECT count(*) FROM invoices WHERE "companyId" = $1 AND source = 'UPLOADED' AND "reviewStatus" = 'PENDING') AS receipts_pending,
				(SELECT count(*) FROM issued_invoices WHERE "companyId" = $1 AND status = 'ISSUED') AS invoices_issued,
				(SELECT count(*) FROM issued_invoices WHERE "companyId" = $1 AND status = 'DRAFT') AS invoices_draft,
				(SELECT count(*) FROM issued_invoices WHERE "companyId" = $1 AND "eInvoiceEnabled") AS einvoices,
				(SELECT count(*) FROM offers WHERE "companyId" = $1) AS offers,
				(SELECT count(*) FROM dunnings WHERE "companyId" = $1) AS dunnings,
				(SELECT count(*) FROM contacts WHERE "companyId" = $1) AS contacts,
				(SELECT count(*) FROM products WHERE "companyId" = $1) AS products,
				(SELECT count(*) FROM recurring_invoices WHERE "companyId" = $1 AND status = 'ACTIVE') AS recurring_active,
				(SELECT count(*) FROM assets WHERE "companyId" = $1) AS assets,
				(SELECT count(*) FROM vehicles WHERE "companyId" = $1) AS vehicles,
				(SELECT count(*) FROM mileage_trips WHERE "companyId" = $1) AS trips,
				(SELECT count(*) FROM company_smtp_settings WHERE "companyId" = $1) AS smtp_configured,
				(SELECT count(*) FROM document_templates WHERE "companyId" = $1) AS templates`,
			[companyId]
		),
		query(
			`SELECT id, "firstName", "lastName", email, "companyRole", "createdAt"
			FROM users WHERE "companyId" = $1 AND id <> $2 ORDER BY "createdAt"`,
			[companyId, userId]
		),
		query(`SELECT step, state, "updatedAt" FROM user_guide_progress WHERE "userId" = $1`, [userId]),
		query(
			`SELECT id, "ipAddress", "userAgent", "lastActiveAt", "createdAt", "expiresAt"
			FROM sessions WHERE "userId" = $1 ORDER BY "lastActiveAt" DESC LIMIT 20`,
			[userId]
		),
		query(
			`SELECT id, stage, result, success, "ipAddress", "userAgent", "createdAt"
			FROM login_attempts WHERE "userId" = $1 OR lower(email) = lower($2)
			ORDER BY "createdAt" DESC LIMIT 100`,
			[userId, user.email]
		),
		query(
			`SELECT l.id, l."entityType", l."entityId", l.action, l.summary, l.changes, l.metadata,
				l."actorType", l."createdAt", l."userId",
				au."firstName" AS "actorFirstName", au."lastName" AS "actorLastName"
			FROM company_audit_logs l
			LEFT JOIN users au ON au.id = l."userId"
			WHERE l."companyId" = $1
			ORDER BY l."createdAt" DESC
			LIMIT 300`,
			[companyId]
		),
		query(
			`SELECT id, category, type, title, body, href, "readAt", "emailSentAt", "emailError", "createdAt"
			FROM notifications WHERE "userId" = $1 ORDER BY "createdAt" DESC LIMIT 50`,
			[userId]
		),
		query(
			`SELECT id, "originalFilename", "extractionError", "createdAt"
			FROM invoices WHERE "companyId" = $1 AND "extractionState" = 'FAILED'
			ORDER BY "createdAt" DESC LIMIT 10`,
			[companyId]
		),
		query(
			`SELECT r.id, r.error, r."scheduledFor", ri.name
			FROM recurring_invoice_runs r JOIN recurring_invoices ri ON ri.id = r."recurringInvoiceId"
			WHERE ri."companyId" = $1 AND r.status = 'FAILED'
			ORDER BY r."scheduledFor" DESC LIMIT 10`,
			[companyId]
		),
		query(
			`SELECT to_char((at AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Vienna')::date, 'YYYY-MM-DD') AS day, count(*) AS value
			FROM (
				SELECT "createdAt" AS at FROM company_audit_logs WHERE "userId" = $1
				UNION ALL SELECT "createdAt" FROM login_attempts WHERE "userId" = $1 AND success
			) t
			WHERE at >= now() AT TIME ZONE 'UTC' - interval '90 days'
			GROUP BY 1 ORDER BY 1`,
			[userId]
		)
	]);

	return {
		user,
		counts: counts ?? {},
		teammates,
		guide,
		sessions,
		logins,
		audit,
		notifications,
		failedExtractions,
		failedRuns,
		dailyActivity: dailyActivity.map((row) => ({ day: row.day, value: Number(row.value) }))
	};
}

/**
 * Namen zu einer Liste von Nutzer-IDs (für OpenPanel-Ereignisse, die nur die
 * profileId tragen).
 *
 * @param {string[]} ids
 * @returns {Promise<Map<string, { id: string, firstName: string, lastName: string, email: string, companyName: string | null }>>}
 */
export async function getUserNames(ids) {
	const unique = [...new Set(ids.filter(Boolean))];
	if (unique.length === 0) return new Map();
	const rows = await query(
		`SELECT u.id, u."firstName", u."lastName", u.email, c."companyName"
		FROM users u JOIN companies c ON c.id = u."companyId"
		WHERE u.id = ANY($1::text[])`,
		[unique]
	);
	return new Map(rows.map((row) => [row.id, /** @type {any} */ (row)]));
}
