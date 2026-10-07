/**
 * Wachstum: Registrierungen, Akquise-Kanäle, Onboarding-Abbrüche.
 */

import { query, viennaDayStart } from '#lib/server/db.js';
import { ONBOARDING_STEPS } from '#lib/labels.js';

/**
 * Registrierungen pro Kalenderwoche (Montag als Wochenbeginn), die letzten
 * `weeks` Wochen.
 *
 * @param {number} weeks
 * @returns {Promise<{ week: string, value: number }[]>}
 */
export async function getWeeklySignups(weeks = 16) {
	const rows = await query(
		`WITH series AS (
			SELECT generate_series(
				date_trunc('week', now() AT TIME ZONE 'Europe/Vienna') - ($1::int - 1) * interval '1 week',
				date_trunc('week', now() AT TIME ZONE 'Europe/Vienna'),
				interval '1 week'
			)::date AS week
		),
		counts AS (
			SELECT date_trunc('week', "createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Vienna')::date AS week, count(*) AS value
			FROM users GROUP BY 1
		)
		SELECT to_char(series.week, 'YYYY-MM-DD') AS week, coalesce(counts.value, 0) AS value
		FROM series LEFT JOIN counts USING (week) ORDER BY series.week`,
		[weeks]
	);
	return rows.map((row) => ({ week: row.week, value: Number(row.value) }));
}

/**
 * Verteilung einer Umfrage-Spalte, optional auf die letzten `days` Tage
 * beschränkt.
 *
 * @param {'leadSource' | 'currentTool'} column
 * @param {number} days
 * @returns {Promise<{ key: string, value: number }[]>}
 */
export async function getSurveyDistribution(column, days) {
	const rows = await query(
		`SELECT coalesce(sv."${column}", 'UNBEKANNT') AS key, count(*) AS value
		FROM users u LEFT JOIN onboarding_surveys sv ON sv."userId" = u.id
		WHERE u."createdAt" >= ${viennaDayStart(0)} - ($1::int - 1) * interval '1 day'
		GROUP BY 1 ORDER BY 2 DESC`,
		[days]
	);
	return rows.map((row) => ({ key: row.key, value: Number(row.value) }));
}

/**
 * @param {number} days
 */
export async function getTaxAdvisorSplit(days) {
	const rows = await query(
		`SELECT sv."hasTaxAdvisor" AS key, count(*) AS value
		FROM users u LEFT JOIN onboarding_surveys sv ON sv."userId" = u.id
		WHERE u."createdAt" >= ${viennaDayStart(0)} - ($1::int - 1) * interval '1 day'
		GROUP BY 1`,
		[days]
	);
	return rows.map((row) => ({
		key: row.key === true ? 'ja' : row.key === false ? 'nein' : 'unbekannt',
		value: Number(row.value)
	}));
}

/**
 * Wo das Onboarding hängen bleibt: offene Konten nach zuletzt erreichtem
 * Schritt.
 *
 * @returns {Promise<{ step: string, value: number, stale: number }[]>}
 */
export async function getOnboardingDropoff() {
	const rows = await query(
		`SELECT coalesce("onboardingStep", 'steuerstatus') AS step, count(*) AS value,
			count(*) FILTER (WHERE "createdAt" < now() AT TIME ZONE 'UTC' - interval '2 days') AS stale
		FROM users WHERE "onboardingCompletedAt" IS NULL
		GROUP BY 1`
	);
	const byStep = new Map(rows.map((row) => [row.step, row]));
	return ONBOARDING_STEPS.map((step) => ({
		step,
		value: Number(byStep.get(step)?.value ?? 0),
		stale: Number(byStep.get(step)?.stale ?? 0)
	}));
}

/**
 * Steuerstatus der Konten im Zeitraum.
 *
 * @param {number} days
 */
export async function getVatModeSplit(days) {
	const rows = await query(
		`SELECT c."vatMode" AS key, count(*) AS value
		FROM users u JOIN companies c ON c.id = u."companyId"
		WHERE u."createdAt" >= ${viennaDayStart(0)} - ($1::int - 1) * interval '1 day'
		GROUP BY 1 ORDER BY 2 DESC`,
		[days]
	);
	return rows.map((row) => ({ key: row.key, value: Number(row.value) }));
}

/**
 * Wöchentliche Kohorten: Anteil der Konten, die in Woche n nach der
 * Registrierung noch aktiv waren (Änderungsprotokoll oder Login).
 *
 * @param {number} weeks
 * @returns {Promise<{ cohort: string, size: number, retention: (number | null)[] }[]>}
 */
export async function getRetentionCohorts(weeks = 8) {
	const rows = await query(
		`WITH cohort AS (
			SELECT id, date_trunc('week', "createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Vienna')::date AS week
			FROM users
			WHERE "createdAt" >= now() AT TIME ZONE 'UTC' - $1::int * interval '1 week' - interval '7 days'
		),
		activity AS (
			SELECT "userId", date_trunc('week', at AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Vienna')::date AS week
			FROM (
				SELECT "userId", "createdAt" AS at FROM company_audit_logs WHERE "userId" IS NOT NULL
				UNION ALL SELECT "userId", "createdAt" FROM login_attempts WHERE success AND "userId" IS NOT NULL
			) t
			GROUP BY 1, 2
		)
		SELECT to_char(c.week, 'YYYY-MM-DD') AS cohort,
			count(DISTINCT c.id) AS size,
			((a.week - c.week) / 7) AS offset,
			count(DISTINCT a."userId") AS active
		FROM cohort c
		LEFT JOIN activity a ON a."userId" = c.id AND a.week >= c.week
		GROUP BY c.week, a.week
		ORDER BY c.week`,
		[weeks]
	);

	/** @type {Map<string, { size: number, active: Map<number, number> }>} */
	const cohorts = new Map();
	for (const row of rows) {
		const entry = cohorts.get(row.cohort) ?? { size: 0, active: new Map() };
		cohorts.set(row.cohort, entry);
		if (row.offset !== null) entry.active.set(Number(row.offset), Number(row.active));
	}
	// Größe getrennt zählen: die Gruppierung nach Aktivitätswoche zerlegt sie.
	const sizes = await query(
		`SELECT to_char(date_trunc('week', "createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Vienna')::date, 'YYYY-MM-DD') AS cohort, count(*) AS size
		FROM users
		WHERE "createdAt" >= now() AT TIME ZONE 'UTC' - $1::int * interval '1 week' - interval '7 days'
		GROUP BY 1`,
		[weeks]
	);
	const sizeMap = new Map(sizes.map((row) => [row.cohort, Number(row.size)]));

	const currentWeek = startOfWeek(new Date());
	return [...cohorts.entries()].slice(-weeks).map(([cohort, entry]) => {
		const size = sizeMap.get(cohort) ?? 0;
		const age = Math.floor(
			(currentWeek.getTime() - new Date(`${cohort}T00:00:00Z`).getTime()) / (7 * 86_400_000)
		);
		const retention = Array.from({ length: weeks }, (_, offset) =>
			offset > age || size === 0 ? null : (entry.active.get(offset) ?? 0) / size
		);
		return { cohort, size, retention };
	});
}

/**
 * @param {Date} date
 * @returns {Date}
 */
function startOfWeek(date) {
	const day = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
	const weekday = (day.getUTCDay() + 6) % 7;
	return new Date(day.getTime() - weekday * 86_400_000);
}
