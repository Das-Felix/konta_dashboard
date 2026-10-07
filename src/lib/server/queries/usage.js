/**
 * Produktnutzung: welche Funktionen genutzt werden und wo es hakt.
 */

import { query, queryOne, viennaDayStart } from '#lib/server/db.js';
import { dailySeries } from './shared.js';

/**
 * Funktionen und wie viele Unternehmen sie mindestens einmal genutzt haben.
 * Basis sind Unternehmen mit abgeschlossenem Onboarding.
 */
export async function getFeatureAdoption() {
	const row = await queryOne(
		`WITH base AS (
			SELECT DISTINCT u."companyId" AS id FROM users u WHERE u."onboardingCompletedAt" IS NOT NULL
		)
		SELECT
			count(*) AS companies,
			count(*) FILTER (WHERE EXISTS (SELECT 1 FROM invoices i WHERE i."companyId" = base.id AND i.source = 'UPLOADED')) AS receipts,
			count(*) FILTER (WHERE EXISTS (SELECT 1 FROM issued_invoices i WHERE i."companyId" = base.id AND i.status = 'ISSUED')) AS invoices,
			count(*) FILTER (WHERE EXISTS (SELECT 1 FROM contacts i WHERE i."companyId" = base.id)) AS contacts,
			count(*) FILTER (WHERE EXISTS (SELECT 1 FROM offers i WHERE i."companyId" = base.id)) AS offers,
			count(*) FILTER (WHERE EXISTS (SELECT 1 FROM recurring_invoices i WHERE i."companyId" = base.id)) AS recurring,
			count(*) FILTER (WHERE EXISTS (SELECT 1 FROM dunnings i WHERE i."companyId" = base.id)) AS dunnings,
			count(*) FILTER (WHERE EXISTS (SELECT 1 FROM assets i WHERE i."companyId" = base.id)) AS assets,
			count(*) FILTER (WHERE EXISTS (SELECT 1 FROM vehicles i WHERE i."companyId" = base.id)) AS vehicles,
			count(*) FILTER (WHERE EXISTS (SELECT 1 FROM issued_invoices i WHERE i."companyId" = base.id AND i."eInvoiceEnabled")) AS einvoice,
			count(*) FILTER (WHERE EXISTS (SELECT 1 FROM company_smtp_settings i WHERE i."companyId" = base.id)) AS smtp
		FROM base`
	);
	const companies = row?.companies ?? 0;
	const features = [
		['receipts', 'Belege hochladen'],
		['invoices', 'Rechnungen ausstellen'],
		['contacts', 'Kontakte'],
		['offers', 'Angebote'],
		['recurring', 'Dauerrechnungen'],
		['dunnings', 'Mahnungen'],
		['assets', 'Anlagen'],
		['vehicles', 'Fahrtenbuch'],
		['einvoice', 'E-Rechnung'],
		['smtp', 'Eigener Mailversand']
	];
	return {
		companies,
		features: features.map(([key, label]) => ({ key, label, value: Number(row?.[key] ?? 0) }))
	};
}

/**
 * Volumen der wichtigsten Objekte pro Tag.
 *
 * @param {number} days
 */
export async function getVolumeSeries(days) {
	const [receipts, invoices] = await Promise.all([
		dailySeries({
			days,
			source: 'invoices t',
			column: 't."createdAt"',
			where: `t.source IN ('UPLOADED', 'MANUAL')`
		}),
		dailySeries({
			days,
			source: 'issued_invoices t',
			column: 't."issuedAt"',
			where: `t.status = 'ISSUED' AND t."issuedAt" IS NOT NULL`
		})
	]);
	return { receipts, invoices };
}

/**
 * Häufigste Einträge im Änderungsprotokoll im Zeitraum.
 *
 * @param {number} days
 */
export function getTopAuditActions(days) {
	return query(
		`SELECT "entityType", action, count(*) AS value, count(DISTINCT "companyId") AS companies
		FROM company_audit_logs
		WHERE "createdAt" >= ${viennaDayStart(0)} - ($1::int - 1) * interval '1 day'
		GROUP BY 1, 2 ORDER BY 3 DESC LIMIT 12`,
		[days]
	);
}

/**
 * Belegerkennung: Zustände und Korrekturquote.
 *
 * @param {number} days
 */
export async function getExtractionHealth(days) {
	const [states, corrections, failures] = await Promise.all([
		query(
			`SELECT "extractionState" AS key, count(*) AS value
			FROM invoices
			WHERE source = 'UPLOADED' AND "createdAt" >= ${viennaDayStart(0)} - ($1::int - 1) * interval '1 day'
			GROUP BY 1`,
			[days]
		),
		// Bestätigt mit Änderungen = der Nutzer musste korrigieren.
		queryOne(
			`SELECT count(*) AS confirmed,
				count(*) FILTER (WHERE changes IS NOT NULL AND changes::text NOT IN ('{}', 'null')) AS corrected
			FROM company_audit_logs
			WHERE "entityType" = 'invoice' AND action = 'confirm'
				AND "createdAt" >= ${viennaDayStart(0)} - ($1::int - 1) * interval '1 day'`,
			[days]
		),
		query(
			`SELECT i.id, i."extractionError", i."createdAt", i."originalFilename",
				u.id AS "userId", u."firstName", u."lastName", c."companyName"
			FROM invoices i
			JOIN companies c ON c.id = i."companyId"
			JOIN LATERAL (SELECT * FROM users WHERE "companyId" = c.id ORDER BY "createdAt" LIMIT 1) u ON TRUE
			WHERE i."extractionState" = 'FAILED'
				AND i."createdAt" >= ${viennaDayStart(0)} - ($1::int - 1) * interval '1 day'
			ORDER BY i."createdAt" DESC LIMIT 10`,
			[days]
		)
	]);
	return {
		states: states.map((row) => ({ key: row.key, value: Number(row.value) })),
		confirmed: corrections?.confirmed ?? 0,
		corrected: corrections?.corrected ?? 0,
		failures
	};
}

/**
 * Hintergrundjobs und Zustellung: Dauerrechnungs-Läufe und Benachrichtigungs-Mails.
 *
 * @param {number} days
 */
export async function getBackgroundHealth(days) {
	const [runs, mails, failedRuns] = await Promise.all([
		query(
			`SELECT status AS key, count(*) AS value FROM recurring_invoice_runs
			WHERE "createdAt" >= ${viennaDayStart(0)} - ($1::int - 1) * interval '1 day'
			GROUP BY 1`,
			[days]
		),
		queryOne(
			`SELECT count(*) FILTER (WHERE "emailSentAt" IS NOT NULL) AS sent,
				count(*) FILTER (WHERE "emailError" IS NOT NULL) AS failed
			FROM notifications
			WHERE "createdAt" >= ${viennaDayStart(0)} - ($1::int - 1) * interval '1 day'`,
			[days]
		),
		query(
			`SELECT r.id, r.error, r."scheduledFor", ri.name, u.id AS "userId", u."firstName", u."lastName", c."companyName"
			FROM recurring_invoice_runs r
			JOIN recurring_invoices ri ON ri.id = r."recurringInvoiceId"
			JOIN companies c ON c.id = ri."companyId"
			JOIN LATERAL (SELECT * FROM users WHERE "companyId" = c.id ORDER BY "createdAt" LIMIT 1) u ON TRUE
			WHERE r.status = 'FAILED' AND r."createdAt" >= ${viennaDayStart(0)} - ($1::int - 1) * interval '1 day'
			ORDER BY r."scheduledFor" DESC LIMIT 10`,
			[days]
		)
	]);
	return {
		runs: runs.map((row) => ({ key: row.key, value: Number(row.value) })),
		mailsSent: mails?.sent ?? 0,
		mailsFailed: mails?.failed ?? 0,
		failedRuns
	};
}
