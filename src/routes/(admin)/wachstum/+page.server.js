import { getFunnel, getSignupSeries } from '#lib/server/queries/overview.js';
import {
	getOnboardingDropoff,
	getRetentionCohorts,
	getSurveyDistribution,
	getTaxAdvisorSplit,
	getVatModeSplit,
	getWeeklySignups
} from '#lib/server/queries/growth.js';
import { parseRange } from '#lib/server/queries/shared.js';

/** @type {import('./$types').PageServerLoad} */
export async function load({ url }) {
	const range = parseRange(url, 90);
	const [weekly, daily, funnel, leadSources, tools, taxAdvisor, vatModes, dropoff, cohorts] =
		await Promise.all([
			getWeeklySignups(16),
			getSignupSeries(range),
			getFunnel(range),
			getSurveyDistribution('leadSource', range),
			getSurveyDistribution('currentTool', range),
			getTaxAdvisorSplit(range),
			getVatModeSplit(range),
			getOnboardingDropoff(),
			getRetentionCohorts(8)
		]);
	return {
		range,
		weekly,
		daily,
		funnel,
		leadSources,
		tools,
		taxAdvisor,
		vatModes,
		dropoff,
		cohorts
	};
}
