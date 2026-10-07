import { error } from '@sveltejs/kit';
import { KONTA_APP_URL } from '$app/env/private';
import { getUserDetail } from '#lib/server/queries/users.js';
import {
	getProfileEvents,
	isOpenPanelConfigured,
	openPanelProfileUrl,
	summarizeProfile
} from '#lib/server/openpanel.js';

/** @type {import('./$types').PageServerLoad} */
export async function load({ params }) {
	const detail = await getUserDetail(params.id);
	if (!detail) error(404, 'Diesen Nutzer gibt es nicht.');

	const configured = isOpenPanelConfigured();

	return {
		...detail,
		kontaAppUrl: KONTA_APP_URL ?? null,
		openPanel: {
			configured,
			profileUrl: openPanelProfileUrl(params.id),
			// Gestreamt: die Seite steht sofort mit den DB-Daten, OpenPanel
			// kommt nach.
			result: configured
				? getProfileEvents(params.id, { days: 90, limit: 500 }).then((result) =>
						result.ok
							? {
									ok: /** @type {const} */ (true),
									events: result.data.events,
									total: result.data.total,
									summary: summarizeProfile(result.data.events)
								}
							: { ok: /** @type {const} */ (false), error: result.error }
					)
				: null
		}
	};
}
