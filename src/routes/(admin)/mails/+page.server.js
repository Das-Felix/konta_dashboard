import {
	EMAIL_PAGE_SIZE,
	EMAIL_STATUS_FILTERS,
	getEmailSeries,
	getEmailSummary,
	getEmailTypeOptions,
	getEmailTypes,
	listEmailLogs
} from '#lib/server/queries/emails.js';
import { parseRange } from '#lib/server/queries/shared.js';

/** @type {import('./$types').PageServerLoad} */
export async function load({ url }) {
	const range = parseRange(url, 30);
	const search = (url.searchParams.get('q') ?? '').trim().slice(0, 120);
	const statusParam = url.searchParams.get('status') ?? 'alle';
	const status = /** @type {keyof typeof EMAIL_STATUS_FILTERS} */ (
		statusParam in EMAIL_STATUS_FILTERS ? statusParam : 'alle'
	);
	const typeOptions = await getEmailTypeOptions();
	const typeParam = url.searchParams.get('typ');
	const type = typeParam && typeOptions.includes(typeParam) ? typeParam : null;
	const page = Math.max(1, Math.floor(Number(url.searchParams.get('page')) || 1));

	const [summary, series, types, log] = await Promise.all([
		getEmailSummary(range),
		getEmailSeries(range),
		getEmailTypes(range),
		listEmailLogs({ search, status, type, page })
	]);

	return {
		range,
		search,
		status,
		type,
		page,
		pageSize: EMAIL_PAGE_SIZE,
		summary,
		series,
		types,
		typeOptions,
		statusFilters: Object.entries(EMAIL_STATUS_FILTERS).map(([value, { label }]) => ({
			value,
			label
		})),
		log
	};
}
