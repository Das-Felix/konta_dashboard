import {
	getChart,
	getRecentEvents,
	isOpenPanelConfigured,
	toPathname
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
			traffic: [],
			keyEvents: [],
			pages: [],
			recent: []
		};
	}

	const [traffic, keyEvents, pages, recent] = await Promise.all([
		getChart({
			days: range,
			events: [
				{ name: 'screen_view', segment: 'user' },
				{ name: 'screen_view', segment: 'session' },
				{ name: 'screen_view', segment: 'event' }
			]
		}),
		getChart({ days: range, events: KEY_EVENTS.map((name) => ({ name })) }),
		getChart({ days: range, events: [{ name: 'screen_view' }], breakdown: 'path' }),
		getRecentEvents({ limit: 60 })
	]);

	const firstError = [traffic, keyEvents, pages, recent].find((result) => !result.ok);

	// OpenPanel kennt nur die profileId (= Konta-User-ID); Namen kommen aus der DB.
	const events = recent.ok ? recent.data : [];
	const names = await getUserNames(events.map((event) => event.profileId ?? ''));

	/** @type {Map<string, number>} */
	const pageTotals = new Map();
	for (const series of pages.ok ? pages.data : []) {
		const path = toPathname(series.name);
		pageTotals.set(path, (pageTotals.get(path) ?? 0) + series.total);
	}

	return {
		range,
		configured: true,
		error: firstError && !firstError.ok ? firstError.error : null,
		traffic: traffic.ok ? traffic.data : [],
		keyEvents: keyEvents.ok
			? keyEvents.data.map((series, index) => ({
					...series,
					name: KEY_EVENTS[index] ?? series.name
				}))
			: [],
		pages: [...pageTotals.entries()]
			.map(([path, total]) => ({ path, total }))
			.sort((a, b) => b.total - a.total)
			.slice(0, 12),
		recent: events.map((event) => ({
			...event,
			user: event.profileId ? (names.get(event.profileId) ?? null) : null
		}))
	};
}
