import { getActiveUserSeries } from '#lib/server/queries/overview.js';
import {
	getBackgroundHealth,
	getExtractionHealth,
	getFeatureAdoption,
	getTopAuditActions,
	getVolumeSeries
} from '#lib/server/queries/usage.js';
import { parseRange } from '#lib/server/queries/shared.js';

/** @type {import('./$types').PageServerLoad} */
export async function load({ url }) {
	const range = parseRange(url, 30);
	const [active, volume, adoption, topActions, extraction, background] = await Promise.all([
		getActiveUserSeries(range),
		getVolumeSeries(range),
		getFeatureAdoption(),
		getTopAuditActions(range),
		getExtractionHealth(range),
		getBackgroundHealth(range)
	]);
	return { range, active, volume, adoption, topActions, extraction, background };
}
