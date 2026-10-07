/**
 * Kennzahlen für die Übersicht.
 */

import { VIENNA_TODAY, query, queryOne, viennaDate, viennaDayStart } from '#lib/server/db.js';
import { monthlyRevenue } from '#lib/plans.js';
import { ACTIVITY_SOURCE, dailySeries } from './shared.js';

/**
 * @typedef {Object} OverviewKpis
 * @property {number} totalUsers
 * @property {number} signupsToday
 * @property {number} signupsYesterday
 * @property {number} signups7d
 * @property {number} signupsPrev7d
 * @property {number} activeToday
 * @property {number} active7d
 * @property {number} active30d
 * @property {number} activePrev7d
 * @property {number} verifiedUsers
 * @property {number} onboardedUsers
 * @property {number} trialing
 * @property {number} trialsEndingSoon
 * @property {number} paying
 * @property {number} pastDue
 * @property {number} mrr Netto in Euro.
 * @property {number} receiptsToday
 * @property {number} invoicesIssuedToday
 * @property {number} auditEventsToday
 * @property {number} extractionFailed7d
 * @property {number} recurringFailed7d
 */

/**
 * @returns {Promise<OverviewKpis>}
 */
export async function getOverviewKpis() {
	const [users, activity, subs, mrrRows, today] = await Promise.all([
		queryOne(
			`SELECT
				count(*) AS total,
				count(*) FILTER (WHERE ${viennaDate('"createdAt"')} = ${VIENNA_TODAY}) AS today,
				count(*) FILTER (WHERE ${viennaDate('"createdAt"')} = ${VIENNA_TODAY} - 1) AS yesterday,
				count(*) FILTER (WHERE "createdAt" >= ${viennaDayStart(6)}) AS last7,
				count(*) FILTER (WHERE "createdAt" >= ${viennaDayStart(13)} AND "createdAt" < ${viennaDayStart(6)}) AS prev7,
				count(*) FILTER (WHERE "emailVerifiedAt" IS NOT NULL) AS verified,
				count(*) FILTER (WHERE "onboardingCompletedAt" IS NOT NULL) AS onboarded
			FROM users`
		),
		queryOne(
			`SELECT
				count(DISTINCT "userId") FILTER (WHERE at >= ${viennaDayStart(0)}) AS today,
				count(DISTINCT "userId") FILTER (WHERE at >= ${viennaDayStart(6)}) AS last7,
				count(DISTINCT "userId") FILTER (WHERE at >= ${viennaDayStart(13)} AND at < ${viennaDayStart(6)}) AS prev7,
				count(DISTINCT "userId") FILTER (WHERE at >= ${viennaDayStart(29)}) AS last30
			FROM ${ACTIVITY_SOURCE} t
			WHERE at >= ${viennaDayStart(29)}`
		),
		queryOne(
			`SELECT
				count(*) FILTER (WHERE status = 'TRIALING') AS trialing,
				count(*) FILTER (WHERE status = 'TRIALING' AND "trialEndsAt" < now() AT TIME ZONE 'UTC' + interval '7 days') AS ending_soon,
				count(*) FILTER (WHERE status IN ('ACTIVE', 'PAST_DUE')) AS paying,
				count(*) FILTER (WHERE status = 'PAST_DUE') AS past_due
			FROM company_subscriptions`
		),
		query(
			`SELECT plan, "billingInterval" AS interval, count(*) AS count
			FROM company_subscriptions
			WHERE status IN ('ACTIVE', 'PAST_DUE')
			GROUP BY plan, "billingInterval"`
		),
		queryOne(
			`SELECT
				(SELECT count(*) FROM invoices WHERE source IN ('UPLOADED', 'MANUAL') AND type <> 'INCOME' AND "createdAt" >= ${viennaDayStart(0)}) AS receipts,
				(SELECT count(*) FROM issued_invoices WHERE status = 'ISSUED' AND "issuedAt" >= ${viennaDayStart(0)}) AS issued,
				(SELECT count(*) FROM company_audit_logs WHERE "createdAt" >= ${viennaDayStart(0)}) AS audit,
				(SELECT count(*) FROM invoices WHERE "extractionState" = 'FAILED' AND "createdAt" >= ${viennaDayStart(6)}) AS extraction_failed,
				(SELECT count(*) FROM recurring_invoice_runs WHERE status = 'FAILED' AND "createdAt" >= ${viennaDayStart(6)}) AS recurring_failed`
		)
	]);

	const mrr = mrrRows.reduce(
		(sum, row) => sum + monthlyRevenue(row.plan, row.interval) * Number(row.count),
		0
	);

	return {
		totalUsers: users?.total ?? 0,
		signupsToday: users?.today ?? 0,
		signupsYesterday: users?.yesterday ?? 0,
		signups7d: users?.last7 ?? 0,
		signupsPrev7d: users?.prev7 ?? 0,
		verifiedUsers: users?.verified ?? 0,
		onboardedUsers: users?.onboarded ?? 0,
		activeToday: activity?.today ?? 0,
		active7d: activity?.last7 ?? 0,
		activePrev7d: activity?.prev7 ?? 0,
		active30d: activity?.last30 ?? 0,
		trialing: subs?.trialing ?? 0,
		trialsEndingSoon: subs?.ending_soon ?? 0,
		paying: subs?.paying ?? 0,
		pastDue: subs?.past_due ?? 0,
		mrr,
		receiptsToday: today?.receipts ?? 0,
		invoicesIssuedToday: today?.issued ?? 0,
		auditEventsToday: today?.audit ?? 0,
		extractionFailed7d: today?.extraction_failed ?? 0,
		recurringFailed7d: today?.recurring_failed ?? 0
	};
}

/**
 * Registrierungen pro Tag.
 *
 * @param {number} days
 */
export function getSignupSeries(days) {
	return dailySeries({ days, source: 'users t', column: 't."createdAt"' });
}

/**
 * Aktive Nutzer pro Tag (siehe `ACTIVITY_SOURCE`).
 *
 * @param {number} days
 */
export function getActiveUserSeries(days) {
	return dailySeries({
		days,
		source: `${ACTIVITY_SOURCE} t`,
		column: 't.at',
		valueExpression: 'count(DISTINCT t."userId")'
	});
}

/**
 * @typedef {Object} RecentSignup
 * @property {string} id
 * @property {string} firstName
 * @property {string} lastName
 * @property {string} email
 * @property {Date} createdAt
 * @property {string | null} companyName
 * @property {string | null} vatMode
 * @property {Date | null} emailVerifiedAt
 * @property {Date | null} onboardingCompletedAt
 * @property {string | null} onboardingStep
 * @property {string | null} status
 * @property {string | null} plan
 * @property {string | null} leadSource
 */

/**
 * @param {number} limit
 * @returns {Promise<RecentSignup[]>}
 */
export function getRecentSignups(limit = 8) {
	return query(
		`SELECT u.id, u."firstName", u."lastName", u.email, u."createdAt", u."emailVerifiedAt",
			u."onboardingCompletedAt", u."onboardingStep",
			c."companyName", c."vatMode", s.status, s.plan, sv."leadSource"
		FROM users u
		JOIN companies c ON c.id = u."companyId"
		LEFT JOIN company_subscriptions s ON s."companyId" = c.id
		LEFT JOIN onboarding_surveys sv ON sv."userId" = u.id
		ORDER BY u."createdAt" DESC
		LIMIT $1`,
		[limit]
	);
}

/**
 * Funnel über alle Konten: registriert → bestätigt → Onboarding → erster
 * Beleg oder erste Rechnung → zahlend.
 *
 * @param {number | null} [days] nur Konten aus den letzten `days` Tagen
 */
export async function getFunnel(days = null) {
	const row = await queryOne(
		`WITH cohort AS (
			SELECT u.id, u."companyId", u."emailVerifiedAt", u."onboardingCompletedAt"
			FROM users u
			WHERE $1::int IS NULL OR u."createdAt" >= ${viennaDayStart(0)} - ($1::int - 1) * interval '1 day'
		)
		SELECT
			count(*) AS registered,
			count(*) FILTER (WHERE "emailVerifiedAt" IS NOT NULL) AS verified,
			count(*) FILTER (WHERE "onboardingCompletedAt" IS NOT NULL) AS onboarded,
			count(*) FILTER (WHERE EXISTS (
				SELECT 1 FROM invoices i WHERE i."companyId" = cohort."companyId"
			)) AS first_document,
			count(*) FILTER (WHERE EXISTS (
				SELECT 1 FROM company_subscriptions s
				WHERE s."companyId" = cohort."companyId" AND s.status IN ('ACTIVE', 'PAST_DUE')
			)) AS paying
		FROM cohort`,
		[days]
	);
	return [
		{ key: 'registered', label: 'Registriert', value: row?.registered ?? 0 },
		{ key: 'verified', label: 'E-Mail bestätigt', value: row?.verified ?? 0 },
		{ key: 'onboarded', label: 'Onboarding abgeschlossen', value: row?.onboarded ?? 0 },
		{ key: 'first_document', label: 'Erster Beleg oder Rechnung', value: row?.first_document ?? 0 },
		{ key: 'paying', label: 'Zahlend', value: row?.paying ?? 0 }
	];
}
