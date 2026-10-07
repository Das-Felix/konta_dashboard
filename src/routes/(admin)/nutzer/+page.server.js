import { PAGE_SIZE, USER_FILTERS, USER_SORTS, listUsers } from '#lib/server/queries/users.js';

/** @type {import('./$types').PageServerLoad} */
export async function load({ url }) {
	const search = (url.searchParams.get('q') ?? '').slice(0, 120);
	const filterParam = url.searchParams.get('filter') ?? 'alle';
	const filter = filterParam in USER_FILTERS ? filterParam : 'alle';
	const sortParam = url.searchParams.get('sort') ?? 'neu';
	const sort = sortParam in USER_SORTS ? sortParam : 'neu';
	const page = Math.max(1, Math.floor(Number(url.searchParams.get('page')) || 1));

	const { rows, total, counts } = await listUsers({ search, filter, sort, page });

	return {
		search,
		filter,
		sort,
		page,
		pageSize: PAGE_SIZE,
		rows,
		total,
		counts,
		filters: Object.entries(USER_FILTERS).map(([value, { label }]) => ({ value, label })),
		sorts: Object.entries(USER_SORTS).map(([value, { label }]) => ({ value, label }))
	};
}
