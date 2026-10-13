import {
	getActiveUserSeries,
	getFunnel,
	getOverviewKpis,
	getRecentSignups,
	getSignupSeries
} from '#lib/server/queries/overview.js';
import { getAuditFeed } from '#lib/server/queries/activity.js';
import { parseRange } from '#lib/server/queries/shared.js';
import {
	WEBSITE,
	getBreakdown,
	getOverview,
	isOpenPanelConfigured,
	periodRange,
	shiftDay
} from '#lib/server/openpanel.js';
import { viennaDayKey } from '#lib/format.js';

/**
 * Landingpage-Besucher aus OpenPanel: die letzten 14 Tage für „heute“ und
 * die Sparkline, der gewählte Zeitraum, der Zeitraum davor zum Vergleich
 * und die wichtigsten Quellen.
 *
 * @param {number} range
 */
async function loadWebsite(range) {
	const [last14, current, previous, sources] = await Promise.all([
		getOverview(periodRange(14), WEBSITE),
		getOverview(periodRange(range), WEBSITE),
		getOverview(periodRange(range, 1), WEBSITE),
		getBreakdown('referrer_name', range, { project: WEBSITE, limit: 6 })
	]);
	if (!last14.ok) return { ok: /** @type {const} */ (false), error: last14.error };
	if (!current.ok) return { ok: /** @type {const} */ (false), error: current.error };

	const today = viennaDayKey(new Date());
	/** @type {Map<string, number>} */
	const byDay = new Map(last14.data.points.map((point) => [point.day, point.visitors]));
	const days = Array.from({ length: 14 }, (_, index) => shiftDay(today, 13 - index));

	return {
		ok: /** @type {const} */ (true),
		today: byDay.get(today) ?? 0,
		yesterday: byDay.get(shiftDay(today, 1)) ?? 0,
		last14: days.map((day) => byDay.get(day) ?? 0),
		visitors: current.data.totals.visitors,
		previousVisitors: previous.ok ? previous.data.totals.visitors : null,
		points: current.data.points,
		sources: sources.ok ? sources.data : []
	};
}

/** @type {import('./$types').PageServerLoad} */
export async function load({ url }) {
	const range = parseRange(url, 30);

	const [kpis, signupsDouble, active, signups14, active14, recentSignups, funnel, feed] =
		await Promise.all([
			getOverviewKpis(),
			// Doppelter Zeitraum: die erste Hälfte ist der Vergleichszeitraum.
			getSignupSeries(range * 2),
			getActiveUserSeries(range),
			getSignupSeries(14),
			getActiveUserSeries(14),
			getRecentSignups(8),
			getFunnel(range),
			getAuditFeed({ limit: 8 })
		]);

	const signups = signupsDouble.slice(range);
	const sum = (/** @type {{ value: number }[]} */ points) =>
		points.reduce((total, point) => total + point.value, 0);

	const websiteConfigured = isOpenPanelConfigured(WEBSITE);

	return {
		range,
		kpis,
		signups,
		signupTotal: sum(signups),
		signupPreviousTotal: sum(signupsDouble.slice(0, range)),
		active,
		signups14,
		active14,
		recentSignups,
		funnel,
		feed: feed.rows,
		websiteConfigured,
		// Nicht abwarten: kommt als Stream nach, damit eine langsame API die
		// Übersicht nicht blockiert.
		website: websiteConfigured ? loadWebsite(range) : null
	};
}
