/**
 * Lesezugriff auf OpenPanel über die Export-API.
 *
 * - `GET /export/events`: Rohereignisse, filterbar nach `profileId` und
 *   `event`. Die Konta-App setzt als `profileId` die User-ID, damit lassen
 *   sich Ereignisse direkt einem Konto zuordnen.
 * - `GET /export/charts`: aggregierte Reihen pro Ereignis.
 *
 * Authentifizierung über die Header `openpanel-client-id` und
 * `openpanel-client-secret`. Der Client braucht Leserechte (Modus "read"
 * oder "root"); der Tracking-Client der App ("write") reicht nicht. Ein
 * read-Client gehört zu genau einem Projekt, die API nimmt dann dessen ID.
 * `OPENPANEL_PROJECT_ID` braucht es nur für einen root-Client.
 *
 * Alle Funktionen werfen nie, sondern liefern `{ ok: false, error }`, damit
 * eine Seite ohne OpenPanel trotzdem lädt. Antworten werden kurz zwischen-
 * gespeichert, um die API bei Seitenwechseln nicht zu fluten.
 */

import {
	OPENPANEL_API_URL,
	OPENPANEL_CLIENT_ID,
	OPENPANEL_CLIENT_SECRET,
	OPENPANEL_DASHBOARD_URL,
	OPENPANEL_PROJECT_ID
} from '$app/env/private';

const TIMEOUT_MS = 8000;
const CACHE_TTL_MS = 60_000;

/**
 * @template T
 * @typedef {{ ok: true, data: T } | { ok: false, error: string }} Result
 */

/**
 * @typedef {Object} OpenPanelEvent
 * @property {string} id
 * @property {string} name
 * @property {string | null} profileId
 * @property {string | null} sessionId
 * @property {string | null} deviceId
 * @property {Date} createdAt
 * @property {string | null} path
 * @property {string | null} origin
 * @property {string | null} referrer
 * @property {string | null} referrerName
 * @property {string | null} country
 * @property {string | null} city
 * @property {string | null} os
 * @property {string | null} browser
 * @property {string | null} device
 * @property {number | null} duration
 * @property {Record<string, unknown>} properties
 */

/**
 * @typedef {Object} ChartSeries
 * @property {string} name
 * @property {number} total
 * @property {{ day: string, value: number }[]} points
 */

/** @type {Map<string, { at: number, value: unknown }>} */
const cache = new Map();

/** @returns {boolean} */
export function isOpenPanelConfigured() {
	return Boolean(OPENPANEL_CLIENT_ID && OPENPANEL_CLIENT_SECRET);
}

/**
 * Direktlink zum Profil im OpenPanel-Dashboard, falls konfiguriert.
 *
 * @param {string} profileId
 * @returns {string | null}
 */
export function openPanelProfileUrl(profileId) {
	if (!OPENPANEL_DASHBOARD_URL) return null;
	return `${OPENPANEL_DASHBOARD_URL}/profiles/${encodeURIComponent(profileId)}`;
}

/**
 * @param {string} path
 * @param {Record<string, string | number | undefined>} params
 * @returns {Promise<Result<any>>}
 */
async function request(path, params) {
	if (!isOpenPanelConfigured()) return { ok: false, error: 'not_configured' };

	const search = new URLSearchParams();
	if (OPENPANEL_PROJECT_ID) search.set('projectId', OPENPANEL_PROJECT_ID);
	for (const [key, value] of Object.entries(params)) {
		if (value !== undefined && value !== '') search.set(key, String(value));
	}
	const url = `${OPENPANEL_API_URL}${path}?${search}`;

	const cached = cache.get(url);
	if (cached && Date.now() - cached.at < CACHE_TTL_MS) return { ok: true, data: cached.value };

	try {
		const response = await fetch(url, {
			headers: {
				'openpanel-client-id': /** @type {string} */ (OPENPANEL_CLIENT_ID),
				'openpanel-client-secret': /** @type {string} */ (OPENPANEL_CLIENT_SECRET),
				accept: 'application/json'
			},
			signal: AbortSignal.timeout(TIMEOUT_MS)
		});
		if (!response.ok) {
			const body = await response.text().catch(() => '');
			console.error('[openpanel]', response.status, path, body.slice(0, 300));
			return { ok: false, error: `HTTP ${response.status}` };
		}
		const data = await response.json();
		cache.set(url, { at: Date.now(), value: data });
		if (cache.size > 200) cache.delete(/** @type {string} */ (cache.keys().next().value));
		return { ok: true, data };
	} catch (error) {
		console.error('[openpanel] request failed', path, error);
		return { ok: false, error: error instanceof Error ? error.message : 'Unbekannter Fehler' };
	}
}

/**
 * @param {unknown} value
 * @returns {string | null}
 */
function str(value) {
	return typeof value === 'string' && value !== '' ? value : null;
}

/**
 * Bringt ein Ereignis aus der API in eine feste Form. Die API liefert je
 * nach Version camelCase oder snake_case.
 *
 * @param {any} raw
 * @returns {OpenPanelEvent}
 */
export function normalizeEvent(raw) {
	const createdAt = raw.createdAt ?? raw.created_at;
	return {
		id: String(raw.id ?? `${raw.name}-${createdAt}`),
		name: String(raw.name ?? 'unbekannt'),
		profileId: str(raw.profileId ?? raw.profile_id),
		sessionId: str(raw.sessionId ?? raw.session_id),
		deviceId: str(raw.deviceId ?? raw.device_id),
		// ClickHouse liefert "2026-10-07 12:00:00.000" ohne Zone, gemeint ist UTC.
		createdAt: parseTimestamp(createdAt),
		path: str(raw.path),
		origin: str(raw.origin),
		referrer: str(raw.referrer),
		referrerName: str(raw.referrerName ?? raw.referrer_name),
		country: str(raw.country),
		city: str(raw.city),
		os: str(raw.os),
		browser: str(raw.browser),
		device: str(raw.device),
		duration: typeof raw.duration === 'number' ? raw.duration : null,
		properties: raw.properties && typeof raw.properties === 'object' ? raw.properties : {}
	};
}

/**
 * @param {unknown} value
 * @returns {Date}
 */
export function parseTimestamp(value) {
	if (value instanceof Date) return value;
	if (typeof value !== 'string') return new Date(0);
	const hasZone = /[zZ]|[+-]\d{2}:?\d{2}$/.test(value);
	return new Date(hasZone ? value : `${value.replace(' ', 'T')}Z`);
}

/**
 * @param {OpenPanelEvent[]} events
 * @returns {OpenPanelEvent[]}
 */
function sortNewestFirst(events) {
	return events.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

/**
 * @param {Date} date
 * @returns {string}
 */
function isoDay(date) {
	return date.toISOString().slice(0, 10);
}

/**
 * Ereignisse eines Profils (= Konta-User-ID).
 *
 * @param {string} profileId
 * @param {{ days?: number, limit?: number }} [options]
 * @returns {Promise<Result<{ events: OpenPanelEvent[], total: number }>>}
 */
export async function getProfileEvents(profileId, { days = 90, limit = 300 } = {}) {
	const start = new Date(Date.now() - days * 86_400_000);
	const result = await request('/export/events', {
		profileId,
		start: isoDay(start),
		end: isoDay(new Date(Date.now() + 86_400_000)),
		limit,
		page: 1
	});
	if (!result.ok) return result;
	const list = Array.isArray(result.data?.data) ? result.data.data : [];
	return {
		ok: true,
		data: {
			events: sortNewestFirst(list.map(normalizeEvent)),
			total: Number(result.data?.meta?.totalCount ?? list.length)
		}
	};
}

/**
 * Jüngste Ereignisse im ganzen Projekt (Live-Strom).
 *
 * @param {{ limit?: number, event?: string }} [options]
 * @returns {Promise<Result<OpenPanelEvent[]>>}
 */
export async function getRecentEvents({ limit = 50, event } = {}) {
	const result = await request('/export/events', {
		limit,
		page: 1,
		event,
		start: isoDay(new Date(Date.now() - 2 * 86_400_000)),
		end: isoDay(new Date(Date.now() + 86_400_000))
	});
	if (!result.ok) return result;
	const list = Array.isArray(result.data?.data) ? result.data.data : [];
	return {
		ok: true,
		data: sortNewestFirst(list.map(normalizeEvent))
	};
}

/**
 * @typedef {Object} ChartEventSpec
 * @property {string} name Ereignisname, z. B. `screen_view`
 * @property {'event' | 'user' | 'session'} [segment] zählt Ereignisse, eindeutige Nutzer oder Sessions
 * @property {string} [label]
 */

/**
 * Tagesreihen für mehrere Ereignisse.
 *
 * @param {{ events: ChartEventSpec[], days: number, breakdown?: string }} options
 * @returns {Promise<Result<ChartSeries[]>>}
 */
export async function getChart({ events, days, breakdown }) {
	const result = await request('/export/charts', {
		series: JSON.stringify(
			events.map((event) => ({ name: event.name, segment: event.segment ?? 'event', filters: [] }))
		),
		interval: 'day',
		// startDate und endDate überschreiben `range`. Ein reines Datum als
		// endDate wäre Mitternacht und würde den heutigen Tag abschneiden.
		startDate: isoDay(new Date(Date.now() - (days - 1) * 86_400_000)),
		endDate: new Date().toISOString(),
		...(breakdown ? { breakdowns: JSON.stringify([{ name: breakdown }]) } : {})
	});
	if (!result.ok) return result;
	return { ok: true, data: normalizeChart(result.data, events) };
}

/**
 * @param {any} data
 * @param {ChartEventSpec[]} events
 * @returns {ChartSeries[]}
 */
export function normalizeChart(data, events) {
	const series = Array.isArray(data?.series) ? data.series : [];
	return series.map((/** @type {any} */ entry, /** @type {number} */ index) => {
		const names = Array.isArray(entry.names) ? entry.names : [];
		const eventName = entry.event?.name ?? events[index]?.name ?? '';
		// Bei Breakdowns steht der Wert (z. B. der Pfad) nach dem Ereignisnamen.
		const name = names.length > 1 ? String(names[names.length - 1]) : String(names[0] ?? eventName);
		/** @type {{ day: string, value: number }[]} */
		const points = (Array.isArray(entry.data) ? entry.data : []).map(
			(/** @type {any} */ point) => ({
				day: String(point.date ?? '').slice(0, 10),
				value: Number(point.count ?? point.value ?? 0)
			})
		);
		const total = Number(entry.metrics?.sum ?? points.reduce((sum, point) => sum + point.value, 0));
		return { name, total, points };
	});
}

/**
 * Kompakte Zusammenfassung eines Profils aus seinen Ereignissen: erstes und
 * letztes Auftreten, Sessions, Geräte und Orte.
 *
 * @param {OpenPanelEvent[]} events
 */
export function summarizeProfile(events) {
	if (events.length === 0) return null;
	const sorted = [...events].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
	const sessions = new Set(events.map((event) => event.sessionId).filter(Boolean));
	/** @param {(event: OpenPanelEvent) => string | null} pickValue */
	const top = (pickValue) => {
		/** @type {Map<string, number>} */
		const counts = new Map();
		for (const event of events) {
			const value = pickValue(event);
			if (value) counts.set(value, (counts.get(value) ?? 0) + 1);
		}
		return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([value]) => value);
	};
	/** @type {Map<string, number>} */
	const pages = new Map();
	for (const event of events) {
		if (event.name === 'screen_view' && event.path) {
			const path = toPathname(event.path);
			pages.set(path, (pages.get(path) ?? 0) + 1);
		}
	}
	return {
		firstSeen: sorted[0].createdAt,
		lastSeen: sorted[sorted.length - 1].createdAt,
		events: events.length,
		screenViews: events.filter((event) => event.name === 'screen_view').length,
		sessions: sessions.size,
		browsers: top((event) => event.browser),
		os: top((event) => event.os),
		devices: top((event) => event.device),
		locations: top((event) => [event.city, event.country].filter(Boolean).join(', ') || null),
		referrers: top((event) => event.referrerName ?? event.referrer),
		topPages: [...pages.entries()]
			.sort((a, b) => b[1] - a[1])
			.slice(0, 8)
			.map(([path, value]) => ({ path, value }))
	};
}

/**
 * Die App schickt Screen Views als volle URL mit SvelteKit-Route
 * (`https://app.konta.at/rechnungen/[id]`). Für Auswertungen zählt der Pfad.
 *
 * @param {string} value
 * @returns {string}
 */
export function toPathname(value) {
	try {
		return new URL(value).pathname;
	} catch {
		return value;
	}
}
