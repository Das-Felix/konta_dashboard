import {
	ACTIVITY_PAGE_SIZE,
	getAuditEntityTypes,
	getAuditFeed,
	getFailedLogins
} from '#lib/server/queries/activity.js';

const ACTOR_TYPES = ['USER', 'SYSTEM', 'UNKNOWN'];

/** @type {import('./$types').PageServerLoad} */
export async function load({ url }) {
	const entityType = url.searchParams.get('typ') ?? '';
	const actorParam = url.searchParams.get('akteur') ?? '';
	const actorType = ACTOR_TYPES.includes(actorParam) ? actorParam : '';
	const page = Math.max(1, Math.floor(Number(url.searchParams.get('page')) || 1));

	const [feed, entityTypes, failedLogins] = await Promise.all([
		getAuditFeed({ entityType, actorType, page }),
		getAuditEntityTypes(),
		getFailedLogins()
	]);

	return {
		entityType,
		actorType,
		page,
		pageSize: ACTIVITY_PAGE_SIZE,
		rows: feed.rows,
		total: feed.total,
		entityTypes,
		failedLogins
	};
}
