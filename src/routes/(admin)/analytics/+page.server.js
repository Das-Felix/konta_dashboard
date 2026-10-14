import {
	getChart,
	getOverview,
	getRecentEvents,
	getTopPages,
	isOpenPanelConfigured
} from '#lib/server/openpanel.js';
import { getUserNames } from '#lib/server/queries/users.js';
import { parseRange } from '#lib/server/queries/shared.js';
import { KEY_EVENTS } from '#lib/labels.js';

/** @type {import('./$types').PageServerLoad} */
export async function load({ url }) {
	const range = parseRange(url, 30);
	if (!isOpenPanelConfigured()) {
		return {
			range,
			configured: false,
			error: null,
			overview: null,
			keyEvents: [],
			pages: [],
			recent: []
		};
	}

	// Besucher, Sessions und Seiten über die Insights-API, damit die Zahlen
	// genau der OpenPanel-Übersicht entsprechen.
	const [overview, keyEvents, pages, recent] = await Promise.all([
		getOverview(range),
		getChart({ days: range, events: KEY_EVENTS.map((name) => ({ name })) }),
		getTopPages(range),
		getRecentEvents({ limit: 60 })
	]);

	const firstError = [overview, keyEvents, pages, recent].find((result) => !result.ok);

	// OpenPanel kennt nur die profileId (= Konta-User-ID); Namen kommen aus der DB.
	const events = recent.ok ? recent.data : [];
	const names = await getUserNames(events.map((event) => event.profileId ?? ''));

	return {
		range,
		configured: true,
		error: firstError && !firstError.ok ? firstError.error : null,
		overview: overview.ok ? overview.data : null,
		keyEvents: keyEvents.ok
			? keyEvents.data.map((series, index) => ({
					...series,
					name: KEY_EVENTS[index] ?? series.name
				}))
			: [],
		pages: pages.ok ? pages.data : [],
		recent: events.map((event) => ({
			...event,
			user: event.profileId ? (names.get(event.profileId) ?? null) : null
		}))
	};
}
