import {
	getActiveUserSeries,
	getFunnel,
	getOverviewKpis,
	getRecentSignups,
	getSignupSeries
} from '#lib/server/queries/overview.js';
import { getAuditFeed } from '#lib/server/queries/activity.js';
import { parseRange } from '#lib/server/queries/shared.js';
import { getChart, isOpenPanelConfigured } from '#lib/server/openpanel.js';

/** @type {import('./$types').PageServerLoad} */
export async function load({ url }) {
	const range = parseRange(url, 30);

	const [kpis, signups, active, recentSignups, funnel, feed, signups14] = await Promise.all([
		getOverviewKpis(),
		getSignupSeries(range),
		getActiveUserSeries(range),
		getRecentSignups(8),
		getFunnel(range),
		getAuditFeed({ limit: 10 }),
		getSignupSeries(14)
	]);

	return {
		range,
		kpis,
		signups,
		active,
		signups14,
		recentSignups,
		funnel,
		feed: feed.rows,
		openPanelConfigured: isOpenPanelConfigured(),
		// Nicht abwarten: kommt als Stream nach, damit eine langsame API die
		// Übersicht nicht blockiert.
		visitors: isOpenPanelConfigured()
			? getChart({
					days: range,
					events: [
						{ name: 'screen_view', segment: 'user', label: 'Besucher' },
						{ name: 'screen_view', segment: 'event', label: 'Seitenaufrufe' },
						{ name: 'screen_view', segment: 'session', label: 'Sessions' }
					]
				})
			: null
	};
}
