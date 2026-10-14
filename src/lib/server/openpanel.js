/**
 * Lesezugriff auf OpenPanel über die Export-API.
 *
 * - `GET /export/events`: Rohereignisse, filterbar nach `profileId` und
 *   `event`. Die Konta-App setzt als `profileId` die User-ID, damit lassen
 *   sich Ereignisse direkt einem Konto zuordnen.
 * - `GET /export/charts`: aggregierte Reihen pro Ereignis.
 * - `GET /insights/:projectId/metrics` und `/pages`: dieselben Zahlen wie die
 *   Übersicht im OpenPanel-Dashboard (Besucher, Sessions, Seitenaufrufe).
 *
 * Authentifizierung über die Header `openpanel-client-id` und
 * `openpanel-client-secret`. Der Client braucht Leserechte (Modus "read"
 * oder "root"); der Tracking-Client der App ("write") reicht nicht. Ein
 * read-Client gehört zu genau einem Projekt, die API nimmt dann dessen ID.
 * `OPENPANEL_PROJECT_ID` braucht es nur für einen root-Client.
 *
 * Es gibt zwei Projekte: die App (`APP`, Standard für alle Funktionen) und
 * die Landingpage (`WEBSITE`, eigener read-Client über die
 * `OPENPANEL_WEBSITE_*`-Variablen).
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
	OPENPANEL_PROJECT_ID,
	OPENPANEL_WEBSITE_CLIENT_ID,
	OPENPANEL_WEBSITE_CLIENT_SECRET,
	OPENPANEL_WEBSITE_DASHBOARD_URL
} from '$app/env/private';
import { viennaDayKey } from '#lib/format.js';

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

/**
 * @typedef {Object} OpenPanelProject
 * @property {string | undefined} clientId
 * @property {string | undefined} clientSecret
 * @property {string | undefined} projectId nur für einen root-Client nötig
 * @property {string | undefined} dashboardUrl
 */

/** @type {OpenPanelProject} */
export const APP = {
	clientId: OPENPANEL_CLIENT_ID,
	clientSecret: OPENPANEL_CLIENT_SECRET,
	projectId: OPENPANEL_PROJECT_ID,
	dashboardUrl: OPENPANEL_DASHBOARD_URL
};

/** @type {OpenPanelProject} */
export const WEBSITE = {
	clientId: OPENPANEL_WEBSITE_CLIENT_ID,
	clientSecret: OPENPANEL_WEBSITE_CLIENT_SECRET,
	// Die Projekt-ID ergibt sich aus dem read-Client (siehe getProjectId).
	projectId: undefined,
	dashboardUrl: OPENPANEL_WEBSITE_DASHBOARD_URL
};

/** @type {Map<string, { at: number, value: unknown }>} */
const cache = new Map();

/**
 * @param {OpenPanelProject} [project]
 * @returns {boolean}
 */
export function isOpenPanelConfigured(project = APP) {
	return Boolean(project.clientId && project.clientSecret);
}

/**
 * Direktlink zum Profil im OpenPanel-Dashboard, falls konfiguriert.
 *
 * @param {string} profileId
 * @returns {string | null}
 */
export function openPanelProfileUrl(profileId) {
	if (!APP.dashboardUrl) return null;
	return `${APP.dashboardUrl}/profiles/${encodeURIComponent(profileId)}`;
}

/**
 * @param {OpenPanelProject} project
 * @param {string} path
 * @param {Record<string, string | number | undefined>} params
 * @returns {Promise<Result<any>>}
 */
async function request(project, path, params) {
	if (!isOpenPanelConfigured(project)) return { ok: false, error: 'not_configured' };

	const search = new URLSearchParams();
	if (project.projectId) search.set('projectId', project.projectId);
	for (const [key, value] of Object.entries(params)) {
		if (value !== undefined && value !== '') search.set(key, String(value));
	}
	const url = `${OPENPANEL_API_URL}${path}?${search}`;

	// Beide Projekte können dieselbe URL abfragen (z. B. ohne Projekt-ID).
	const cacheKey = `${project.clientId} ${url}`;
	const cached = cache.get(cacheKey);
	if (cached && Date.now() - cached.at < CACHE_TTL_MS) return { ok: true, data: cached.value };

	try {
		const response = await fetch(url, {
			headers: {
				'openpanel-client-id': /** @type {string} */ (project.clientId),
				'openpanel-client-secret': /** @type {string} */ (project.clientSecret),
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
		cache.set(cacheKey, { at: Date.now(), value: data });
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
	const result = await request(APP, '/export/events', {
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
	const result = await request(APP, '/export/events', {
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

/** @type {Map<OpenPanelProject, string>} */
const resolvedProjectIds = new Map();

/**
 * Die Insights-API braucht die Projekt-ID im Pfad. Ohne gesetzte Projekt-ID
 * steht sie in jedem exportierten Ereignis des read-Clients.
 *
 * @param {OpenPanelProject} project
 * @returns {Promise<Result<string>>}
 */
async function getProjectId(project) {
	const known = project.projectId ?? resolvedProjectIds.get(project);
	if (known) return { ok: true, data: known };
	const result = await request(project, '/export/events', { limit: 1, page: 1 });
	if (!result.ok) return result;
	const projectId = str(result.data?.data?.[0]?.projectId ?? result.data?.data?.[0]?.project_id);
	if (!projectId)
		return { ok: false, error: 'Projekt-ID unbekannt, noch keine Ereignisse im Projekt' };
	resolvedProjectIds.set(project, projectId);
	return { ok: true, data: projectId };
}

/**
 * Zeitraum wie im OpenPanel-Dashboard: 7 und 30 Tage gibt es dort als
 * Voreinstellung, alles andere als eigener Zeitraum bis heute Abend.
 *
 * @param {number} days
 * @returns {Record<string, string>}
 */
export function insightsRange(days, now = new Date()) {
	if (days === 7 || days === 30) return { range: `${days}d` };
	return {
		startDate: isoDay(new Date(now.getTime() - days * 86_400_000)),
		endDate: `${isoDay(now)} 23:59:59`
	};
}

/**
 * `YYYY-MM-DD`, um `days` Kalendertage zurückverschoben.
 *
 * @param {string} day
 * @param {number} days
 * @returns {string}
 */
export function shiftDay(day, days) {
	const [year, month, date] = day.split('-').map(Number);
	return new Date(Date.UTC(year, month - 1, date - days)).toISOString().slice(0, 10);
}

/**
 * Fester Zeitraum aus `days` Wiener Kalendertagen bis einschließlich heute.
 * `offset` 1 ist der gleich lange Zeitraum davor, für Vergleiche.
 *
 * @param {number} days
 * @param {number} [offset]
 * @returns {{ startDate: string, endDate: string }}
 */
export function periodRange(days, offset = 0, now = new Date()) {
	const end = shiftDay(viennaDayKey(now), offset * days);
	return { startDate: shiftDay(end, days - 1), endDate: `${end} 23:59:59` };
}

/**
 * @typedef {Object} OverviewPoint
 * @property {string} day erster Tag des Intervalls (bei langen Zeiträumen ein Monat)
 * @property {number} visitors
 * @property {number} sessions
 * @property {number} pageViews
 */

/**
 * @typedef {Object} Overview
 * @property {{ visitors: number, sessions: number, pageViews: number, bounceRate: number, sessionDuration: number }} totals
 * @property {OverviewPoint[]} points
 */

/**
 * Kennzahlen der OpenPanel-Übersicht.
 *
 * @param {number | { startDate: string, endDate: string }} range Tage wie im
 *   OpenPanel-Dashboard (`insightsRange`) oder ein fester Zeitraum (`periodRange`)
 * @param {OpenPanelProject} [project]
 * @returns {Promise<Result<Overview>>}
 */
export async function getOverview(range, project = APP) {
	const projectId = await getProjectId(project);
	if (!projectId.ok) return projectId;
	const result = await request(
		project,
		`/insights/${encodeURIComponent(projectId.data)}/metrics`,
		typeof range === 'number' ? insightsRange(range) : range
	);
	if (!result.ok) return result;
	return { ok: true, data: normalizeOverview(result.data) };
}

/**
 * @param {any} data
 * @returns {Overview}
 */
export function normalizeOverview(data) {
	const metrics = data?.metrics ?? {};
	const series = Array.isArray(data?.series) ? data.series : [];
	return {
		totals: {
			visitors: Number(metrics.unique_visitors ?? 0),
			sessions: Number(metrics.total_sessions ?? 0),
			pageViews: Number(metrics.total_screen_views ?? 0),
			bounceRate: Number(metrics.bounce_rate ?? 0),
			sessionDuration: Number(metrics.avg_session_duration ?? 0)
		},
		points: series.map((/** @type {any} */ point) => ({
			day: String(point.date ?? '').slice(0, 10),
			visitors: Number(point.unique_visitors ?? 0),
			sessions: Number(point.total_sessions ?? 0),
			pageViews: Number(point.total_screen_views ?? 0)
		}))
	};
}

/**
 * Meistbesuchte Seiten wie in der OpenPanel-Übersicht, je Origin und Pfad.
 *
 * @param {number} days
 * @param {{ limit?: number, project?: OpenPanelProject }} [options]
 * @returns {Promise<Result<{ origin: string, path: string, sessions: number, pageViews: number }[]>>}
 */
export async function getTopPages(days, { limit = 12, project = APP } = {}) {
	const projectId = await getProjectId(project);
	if (!projectId.ok) return projectId;
	const result = await request(
		project,
		`/insights/${encodeURIComponent(projectId.data)}/pages`,
		insightsRange(days)
	);
	if (!result.ok) return result;
	const list = Array.isArray(result.data) ? result.data : [];
	return {
		ok: true,
		data: list.slice(0, limit).map((/** @type {any} */ row) => ({
			origin: String(row.origin ?? ''),
			path: String(row.path ?? ''),
			sessions: Number(row.sessions ?? 0),
			pageViews: Number(row.pageviews ?? 0)
		}))
	};
}

/**
 * @typedef {'referrer_name' | 'utm_source' | 'utm_campaign' | 'country' | 'device' | 'browser' | 'os'} BreakdownColumn
 */

/**
 * @typedef {Object} BreakdownRow
 * @property {string | null} name `null` heißt ohne Wert, z. B. direkter Aufruf
 * @property {number} sessions
 * @property {number} pageViews
 */

/**
 * Aufschlüsselung wie in der OpenPanel-Übersicht (Quellen, Länder, Geräte, …),
 * nach Sessions absteigend.
 *
 * @param {BreakdownColumn} column
 * @param {number} days
 * @param {{ limit?: number, project?: OpenPanelProject }} [options]
 * @returns {Promise<Result<BreakdownRow[]>>}
 */
export async function getBreakdown(column, days, { limit = 8, project = APP } = {}) {
	const projectId = await getProjectId(project);
	if (!projectId.ok) return projectId;
	const result = await request(
		project,
		`/insights/${encodeURIComponent(projectId.data)}/${column}`,
		insightsRange(days)
	);
	if (!result.ok) return result;
	// Die API ignoriert `limit` derzeit, deshalb wird hier gekürzt.
	return { ok: true, data: normalizeBreakdown(result.data).slice(0, limit) };
}

/**
 * @param {any} data
 * @returns {BreakdownRow[]}
 */
export function normalizeBreakdown(data) {
	const list = Array.isArray(data) ? data : [];
	return list
		.map((/** @type {any} */ row) => ({
			name: str(row?.name),
			sessions: Number(row?.sessions ?? 0),
			pageViews: Number(row?.pageviews ?? row?.pageViews ?? 0)
		}))
		.sort((a, b) => b.sessions - a.sessions);
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
	const result = await request(APP, '/export/charts', {
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
	/** @type {any[]} */
	const series = Array.isArray(data?.series) ? data.series : [];
	// OpenPanel sortiert die Reihen nach Summe absteigend, nicht in der
	// angefragten Reihenfolge. Die Kennung (A, B, C, …) verrät die Position.
	const ordered = series
		.map((entry, index) => ({
			entry,
			position: seriesPosition(entry.event?.id) ?? index
		}))
		.sort((a, b) => a.position - b.position);
	return ordered.map(({ entry, position }) => {
		const spec = events[position];
		const names = Array.isArray(entry.names) ? entry.names : [];
		const eventName = entry.event?.name ?? spec?.name ?? '';
		// Bei Breakdowns steht der Wert (z. B. der Pfad) nach dem Ereignisnamen.
		// Ohne Breakdown trägt der Name ein Präfix wie "(A) screen_view".
		const name = names.length > 1 ? String(names[names.length - 1]) : eventName;
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
 * Position einer Reihe aus ihrer Kennung: "A" → 0, "B" → 1, …, "AA" → 26.
 *
 * @param {unknown} id
 * @returns {number | null}
 */
function seriesPosition(id) {
	if (typeof id !== 'string' || !/^[A-Z]+$/.test(id)) return null;
	let position = 0;
	for (const char of id) position = position * 26 + (char.charCodeAt(0) - 64);
	return position - 1;
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
