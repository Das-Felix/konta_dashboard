import {
	WEBSITE,
	getBreakdown,
	getOverview,
	getTopPages,
	isOpenPanelConfigured
} from '#lib/server/openpanel.js';
import { parseRange } from '#lib/server/queries/shared.js';

/** @type {import('#lib/server/openpanel.js').BreakdownColumn[]} */
const COLUMNS = [
	'referrer_name',
	'utm_source',
	'utm_campaign',
	'country',
	'device',
	'browser',
	'os'
];

/** @type {import('./$types').PageServerLoad} */
export async function load({ url }) {
	const range = parseRange(url, 30);
	if (!isOpenPanelConfigured(WEBSITE)) {
		return {
			range,
			configured: false,
			dashboardUrl: null,
			error: null,
			overview: null,
			pages: [],
			breakdowns: null
		};
	}

	// Besucher der Landingpage sind anonym, deshalb nur OpenPanel und keine DB.
	const [overview, pages, ...breakdowns] = await Promise.all([
		getOverview(range, WEBSITE),
		getTopPages(range, { project: WEBSITE }),
		...COLUMNS.map((column) => getBreakdown(column, range, { project: WEBSITE }))
	]);

	const firstError = [overview, pages, ...breakdowns].find((result) => !result.ok);

	return {
		range,
		configured: true,
		dashboardUrl: WEBSITE.dashboardUrl ?? null,
		error: firstError && !firstError.ok ? firstError.error : null,
		overview: overview.ok ? overview.data : null,
		pages: pages.ok ? pages.data : [],
		breakdowns:
			/** @type {Record<import('#lib/server/openpanel.js').BreakdownColumn, import('#lib/server/openpanel.js').BreakdownRow[]>} */ (
				Object.fromEntries(
					COLUMNS.map((column, index) => {
						const result = breakdowns[index];
						return [column, result.ok ? result.data : []];
					})
				)
			)
	};
}
