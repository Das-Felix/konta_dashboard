/**
 * Abos und Umsatz.
 */

import { query, queryOne, viennaDayStart } from '#lib/server/db.js';
import { monthlyRevenue } from '#lib/plans.js';

/**
 * Status, Tarife und MRR.
 */
export async function getBillingSummary() {
	const [byStatus, paying, conversion] = await Promise.all([
		query(`SELECT status, count(*) AS value FROM company_subscriptions GROUP BY 1`),
		query(
			`SELECT plan, "billingInterval" AS interval, count(*) AS value,
				count(*) FILTER (WHERE "cancelAtPeriodEnd") AS canceling
			FROM company_subscriptions WHERE status IN ('ACTIVE', 'PAST_DUE')
			GROUP BY 1, 2`
		),
		// Konvertierung: alle Tests, die schon geendet haben.
		queryOne(
			`SELECT count(*) AS ended,
				count(*) FILTER (WHERE status IN ('ACTIVE', 'PAST_DUE', 'CANCELED')) AS converted
			FROM company_subscriptions
			WHERE "trialEndsAt" < now() AT TIME ZONE 'UTC'`
		)
	]);

	/** @type {Record<string, number>} */
	const statusCounts = {};
	for (const row of byStatus) statusCounts[row.status] = Number(row.value);

	const plans = paying.map((row) => ({
		plan: row.plan,
		interval: row.interval ?? 'MONTHLY',
		count: Number(row.value),
		canceling: Number(row.canceling),
		mrr: monthlyRevenue(row.plan, row.interval) * Number(row.value)
	}));

	return {
		statusCounts,
		plans,
		mrr: plans.reduce((sum, row) => sum + row.mrr, 0),
		canceling: plans.reduce((sum, row) => sum + row.canceling, 0),
		trialsEnded: conversion?.ended ?? 0,
		trialsConverted: conversion?.converted ?? 0
	};
}

/**
 * Tests, die in den nächsten `days` Tagen enden, mit Aktivitätssignalen:
 * wer viel nutzt, ist ein Kandidat für eine Erinnerung, wer nichts tut, für
 * ein Gespräch.
 *
 * @param {number} days
 */
export function getTrialsEndingSoon(days = 7) {
	return query(
		`SELECT u.id, u."firstName", u."lastName", u.email, c."companyName", s."trialEndsAt", s.plan,
			(SELECT count(*) FROM invoices i WHERE i."companyId" = c.id) AS documents,
			(SELECT max("createdAt") FROM company_audit_logs l WHERE l."companyId" = c.id) AS last_change
		FROM company_subscriptions s
		JOIN companies c ON c.id = s."companyId"
		JOIN LATERAL (
			SELECT * FROM users WHERE "companyId" = c.id ORDER BY "createdAt" LIMIT 1
		) u ON TRUE
		WHERE s.status = 'TRIALING'
			AND s."trialEndsAt" >= now() AT TIME ZONE 'UTC'
			AND s."trialEndsAt" < now() AT TIME ZONE 'UTC' + $1::int * interval '1 day'
		ORDER BY s."trialEndsAt"`,
		[days]
	);
}

/**
 * Abos mit Handlungsbedarf: Zahlung offen oder zum Periodenende gekündigt.
 */
export function getAtRiskSubscriptions() {
	return query(
		`SELECT u.id, u."firstName", u."lastName", u.email, c."companyName", s.status, s.plan,
			s."billingInterval", s."currentPeriodEnd", s."cancelAtPeriodEnd", s."stripeCustomerId"
		FROM company_subscriptions s
		JOIN companies c ON c.id = s."companyId"
		JOIN LATERAL (
			SELECT * FROM users WHERE "companyId" = c.id ORDER BY "createdAt" LIMIT 1
		) u ON TRUE
		WHERE s.status = 'PAST_DUE' OR (s.status = 'ACTIVE' AND s."cancelAtPeriodEnd")
		ORDER BY s.status DESC, s."currentPeriodEnd"`
	);
}

/**
 * Neue zahlende Abos pro Woche. Ohne Abo-Historie in der Datenbank ist der
 * letzte Stripe-Sync die beste Näherung für den Konvertierungszeitpunkt.
 *
 * @param {number} days
 */
export async function getRecentConversions(days = 30) {
	return query(
		`SELECT u.id, u."firstName", u."lastName", c."companyName", s.plan, s."billingInterval",
			coalesce(s."stripeSyncedAt", s."updatedAt") AS converted_at
		FROM company_subscriptions s
		JOIN companies c ON c.id = s."companyId"
		JOIN LATERAL (
			SELECT * FROM users WHERE "companyId" = c.id ORDER BY "createdAt" LIMIT 1
		) u ON TRUE
		WHERE s.status = 'ACTIVE'
			AND coalesce(s."stripeSyncedAt", s."updatedAt") >= ${viennaDayStart(0)} - ($1::int - 1) * interval '1 day'
		ORDER BY converted_at DESC
		LIMIT 20`,
		[days]
	);
}
