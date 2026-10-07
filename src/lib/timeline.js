/**
 * Führt alle Quellen zu einem Nutzer in eine Zeitleiste zusammen:
 * Kontomeilensteine und Login-Versuche (DB), Änderungsprotokoll (DB),
 * Benachrichtigungen (DB) und Produktereignisse (OpenPanel).
 *
 * Reine Funktion ohne Server-Abhängigkeiten, damit sie testbar bleibt und
 * die Seite sie bei Bedarf auch im Browser nutzen kann.
 */

import {
	actionLabel,
	entityTypeLabel,
	eventLabel,
	LOGIN_RESULT,
	NOTIFICATION_CATEGORY_LABELS
} from './labels.js';

/**
 * @typedef {'konto' | 'protokoll' | 'login' | 'nutzung' | 'benachrichtigung'} TimelineSource
 */

/**
 * @typedef {Object} TimelineChange
 * @property {string} field
 * @property {string} from
 * @property {string} to
 */

/**
 * @typedef {Object} TimelineItem
 * @property {string} id
 * @property {Date} at
 * @property {TimelineSource} source
 * @property {string} title
 * @property {string | null} detail
 * @property {import('./labels.js').Tone} tone
 * @property {TimelineChange[]} changes
 * @property {string[]} meta Kurze Zusatzangaben, mit " · " verbunden angezeigt.
 */

/** @type {Record<TimelineSource, string>} */
export const TIMELINE_SOURCE_LABELS = {
	konto: 'Konto',
	protokoll: 'Änderungsprotokoll',
	login: 'Anmeldung',
	nutzung: 'Nutzung (OpenPanel)',
	benachrichtigung: 'Benachrichtigung'
};

/** Länger als das liegt zwischen zwei Seitenaufrufen keine zusammenhängende Strecke. */
const SCREEN_VIEW_GAP_MS = 30 * 60 * 1000;

/**
 * @param {unknown} value
 * @returns {string}
 */
export function formatChangeValue(value) {
	if (value === null || value === undefined || value === '') return 'leer';
	if (typeof value === 'boolean') return value ? 'ja' : 'nein';
	if (typeof value === 'object') return JSON.stringify(value);
	return String(value);
}

/**
 * `changes` aus dem Änderungsprotokoll ist `{ feld: { from, to } }` oder bei
 * create/delete ein Snapshot. Nur das Diff-Format wird aufgeschlüsselt.
 *
 * @param {unknown} changes
 * @returns {TimelineChange[]}
 */
export function parseAuditChanges(changes) {
	if (!changes || typeof changes !== 'object' || Array.isArray(changes)) return [];
	/** @type {TimelineChange[]} */
	const out = [];
	for (const [field, value] of Object.entries(changes)) {
		if (value && typeof value === 'object' && ('from' in value || 'to' in value)) {
			const diff = /** @type {{ from?: unknown, to?: unknown }} */ (value);
			out.push({ field, from: formatChangeValue(diff.from), to: formatChangeValue(diff.to) });
		}
	}
	return out;
}

/**
 * @typedef {Object} TimelineUser
 * @property {Date} createdAt
 * @property {Date | null} emailVerifiedAt
 * @property {Date | null} onboardingCompletedAt
 * @property {Date | null} [twoFactorEnabledAt]
 * @property {Date | null} [guideCompletedAt]
 * @property {Date | null} [trialEndsAt]
 */

/**
 * @param {{
 *   user: TimelineUser,
 *   audit?: any[],
 *   logins?: any[],
 *   notifications?: any[],
 *   events?: import('./server/openpanel.js').OpenPanelEvent[],
 *   now?: Date
 * }} sources
 * @returns {TimelineItem[]}
 */
export function buildTimeline({
	user,
	audit = [],
	logins = [],
	notifications = [],
	events = [],
	now = new Date()
}) {
	/** @type {TimelineItem[]} */
	const items = [];

	/**
	 * @param {Partial<TimelineItem> & Pick<TimelineItem, 'id' | 'at' | 'source' | 'title'>} item
	 */
	const push = (item) => {
		if (!(item.at instanceof Date) || Number.isNaN(item.at.getTime())) return;
		items.push({ detail: null, tone: 'neutral', changes: [], meta: [], ...item });
	};

	push({
		id: 'konto-signup',
		at: user.createdAt,
		source: 'konto',
		title: 'Konto erstellt',
		tone: 'soft'
	});
	if (user.emailVerifiedAt) {
		push({
			id: 'konto-verified',
			at: user.emailVerifiedAt,
			source: 'konto',
			title: 'E-Mail bestätigt',
			tone: 'soft'
		});
	}
	if (user.onboardingCompletedAt) {
		push({
			id: 'konto-onboarded',
			at: user.onboardingCompletedAt,
			source: 'konto',
			title: 'Onboarding abgeschlossen',
			tone: 'green'
		});
	}
	if (user.twoFactorEnabledAt) {
		push({
			id: 'konto-2fa',
			at: user.twoFactorEnabledAt,
			source: 'konto',
			title: '2FA aktiviert',
			tone: 'soft'
		});
	}
	if (user.guideCompletedAt) {
		push({
			id: 'konto-guide',
			at: user.guideCompletedAt,
			source: 'konto',
			title: 'Leitfaden abgeschlossen',
			tone: 'green'
		});
	}
	if (user.trialEndsAt && user.trialEndsAt.getTime() <= now.getTime()) {
		push({
			id: 'konto-trial-end',
			at: user.trialEndsAt,
			source: 'konto',
			title: 'Testzeitraum beendet',
			tone: 'neutral'
		});
	}

	for (const entry of audit) {
		const actor = entry.userId
			? [entry.actorFirstName, entry.actorLastName].filter(Boolean).join(' ')
			: entry.actorType === 'SYSTEM'
				? 'System'
				: 'Unbekannt';
		const failed = String(entry.action).includes('failed');
		push({
			id: `protokoll-${entry.id}`,
			at: entry.createdAt,
			source: 'protokoll',
			title:
				entry.summary ||
				`${entityTypeLabel(entry.entityType)} ${actionLabel(entry.action).toLowerCase()}`,
			tone: failed
				? 'error'
				: entry.action === 'delete' || entry.action === 'storno'
					? 'neutral'
					: 'soft',
			changes: parseAuditChanges(entry.changes),
			meta: [entityTypeLabel(entry.entityType), actionLabel(entry.action), actor].filter(
				/** @returns {value is string} */ (value) => Boolean(value)
			)
		});
	}

	for (const attempt of logins) {
		const result = LOGIN_RESULT[attempt.result] ?? { label: attempt.result, tone: 'neutral' };
		push({
			id: `login-${attempt.id}`,
			at: attempt.createdAt,
			source: 'login',
			title: attempt.success
				? attempt.stage === 'TWO_FACTOR'
					? 'Angemeldet (2FA)'
					: 'Angemeldet'
				: `Anmeldung fehlgeschlagen: ${result.label}`,
			tone: attempt.success ? 'neutral' : 'error',
			meta: attempt.ipAddress ? [attempt.ipAddress] : []
		});
	}

	for (const notification of notifications) {
		push({
			id: `benachrichtigung-${notification.id}`,
			at: notification.createdAt,
			source: 'benachrichtigung',
			title: notification.title,
			detail: notification.emailError
				? `Mail nicht zugestellt: ${notification.emailError}`
				: notification.body,
			tone: notification.emailError || notification.category === 'ERROR' ? 'error' : 'neutral',
			meta: [
				NOTIFICATION_CATEGORY_LABELS[notification.category] ?? notification.category,
				notification.readAt ? 'gelesen' : 'ungelesen',
				notification.emailSentAt ? 'per Mail' : null
			].filter(/** @returns {value is string} */ (value) => Boolean(value))
		});
	}

	items.push(...collapseEvents(events));

	return items.sort((a, b) => b.at.getTime() - a.at.getTime());
}

/**
 * Seitenaufrufe einer Session, die dicht aufeinander folgen, werden zu einem
 * Eintrag ("5 Seiten aufgerufen"). Alles andere bleibt einzeln.
 *
 * @param {import('./server/openpanel.js').OpenPanelEvent[]} events
 * @returns {TimelineItem[]}
 */
export function collapseEvents(events) {
	const sorted = [...events].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
	/** @type {TimelineItem[]} */
	const out = [];
	/** @type {{ start: Date, end: Date, paths: string[], session: string | null, id: string, meta: string[] } | null} */
	let run = null;

	const flush = () => {
		if (!run) return;
		const unique = [...new Set(run.paths)];
		out.push({
			id: `nutzung-${run.id}`,
			at: run.end,
			source: 'nutzung',
			title:
				run.paths.length === 1
					? `Seite aufgerufen: ${run.paths[0]}`
					: `${run.paths.length} Seiten aufgerufen`,
			detail:
				run.paths.length === 1
					? null
					: unique.slice(0, 6).join(', ') + (unique.length > 6 ? ' …' : ''),
			tone: 'neutral',
			changes: [],
			meta: run.meta
		});
		run = null;
	};

	for (const event of sorted) {
		if (event.name === 'screen_view') {
			const path = event.path ? pathOf(event.path) : '/';
			const continues =
				run &&
				run.session === event.sessionId &&
				event.createdAt.getTime() - run.end.getTime() < SCREEN_VIEW_GAP_MS;
			if (!continues) {
				flush();
				run = {
					start: event.createdAt,
					end: event.createdAt,
					paths: [],
					session: event.sessionId,
					id: event.id,
					meta: [
						event.browser,
						event.os,
						[event.city, event.country].filter(Boolean).join(', ')
					].filter(/** @returns {value is string} */ (value) => Boolean(value))
				};
			}
			const current = /** @type {NonNullable<typeof run>} */ (run);
			current.paths.push(path);
			current.end = event.createdAt;
			continue;
		}

		flush();
		const props = Object.entries(event.properties ?? {})
			.filter(
				([key, value]) => !key.startsWith('__') && value !== null && typeof value !== 'object'
			)
			.slice(0, 4)
			.map(([key, value]) => `${key}: ${value}`);
		out.push({
			id: `nutzung-${event.id}`,
			at: event.createdAt,
			source: 'nutzung',
			title: eventLabel(event.name),
			detail: props.length > 0 ? props.join(' · ') : null,
			tone: event.name.includes('failed') ? 'error' : 'neutral',
			changes: [],
			meta: [event.name]
		});
	}
	flush();
	return out;
}

/**
 * @param {string} value
 * @returns {string}
 */
function pathOf(value) {
	try {
		return new URL(value).pathname;
	} catch {
		return value;
	}
}

/**
 * Gruppiert eine (absteigend sortierte) Zeitleiste nach Wiener Kalendertag.
 *
 * @param {TimelineItem[]} items
 * @param {(date: Date) => string} dayKey
 * @returns {{ day: string, items: TimelineItem[] }[]}
 */
export function groupByDay(items, dayKey) {
	/** @type {{ day: string, items: TimelineItem[] }[]} */
	const groups = [];
	for (const item of items) {
		const day = dayKey(item.at);
		const last = groups[groups.length - 1];
		if (last && last.day === day) last.items.push(item);
		else groups.push({ day, items: [item] });
	}
	return groups;
}
