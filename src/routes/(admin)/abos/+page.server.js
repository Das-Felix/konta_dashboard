import {
	getAtRiskSubscriptions,
	getBillingSummary,
	getRecentConversions,
	getTrialsEndingSoon
} from '#lib/server/queries/billing.js';

/** @type {import('./$types').PageServerLoad} */
export async function load() {
	const [summary, endingSoon, atRisk, conversions] = await Promise.all([
		getBillingSummary(),
		getTrialsEndingSoon(7),
		getAtRiskSubscriptions(),
		getRecentConversions(30)
	]);
	return { summary, endingSoon, atRisk, conversions };
}
