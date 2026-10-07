/**
 * Formatierung nach Styleguide 14: Tausenderpunkt, Dezimalkomma, Beträge mit
 * geschütztem Leerzeichen vor dem €, Prozent mit Leerzeichen, Jänner statt
 * Januar. Alle Datumswerte in Wiener Zeit.
 */

const TIME_ZONE = 'Europe/Vienna';
const NBSP = ' ';

const MONTHS_LONG = [
	'Jänner',
	'Februar',
	'März',
	'April',
	'Mai',
	'Juni',
	'Juli',
	'August',
	'September',
	'Oktober',
	'November',
	'Dezember'
];

const MONTHS_SHORT = [
	'Jän',
	'Feb',
	'Mär',
	'Apr',
	'Mai',
	'Jun',
	'Jul',
	'Aug',
	'Sep',
	'Okt',
	'Nov',
	'Dez'
];

const WEEKDAYS_SHORT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

const integerFormat = new Intl.NumberFormat('de-AT', { maximumFractionDigits: 0 });
const decimalFormat = new Intl.NumberFormat('de-AT', {
	minimumFractionDigits: 2,
	maximumFractionDigits: 2
});

/**
 * `de-AT` setzt ein geschütztes Leerzeichen als Tausendertrenner, der
 * Styleguide will einen Punkt.
 *
 * @param {string} text
 * @returns {string}
 */
function dotThousands(text) {
	return text.replace(/[\u00a0\u202f ]/g, '.');
}

/**
 * @param {number | null | undefined} value
 * @returns {string}
 */
export function formatNumber(value) {
	if (value === null || value === undefined || !Number.isFinite(value)) return '—';
	return dotThousands(integerFormat.format(value));
}

/**
 * Betrag in Euro, z. B. `1.402,80 €`. Mit `whole`, ohne Nachkomma (`12 €`).
 *
 * @param {number | null | undefined} value
 * @param {{ whole?: boolean }} [options]
 * @returns {string}
 */
export function formatEuro(value, { whole = false } = {}) {
	if (value === null || value === undefined || !Number.isFinite(value)) return '—';
	const text = whole ? integerFormat.format(value) : decimalFormat.format(value);
	return `${dotThousands(text)}${NBSP}€`;
}

/**
 * Anteil (0 bis 1) als Prozent, z. B. `42 %`.
 *
 * @param {number | null | undefined} ratio
 * @param {number} [digits]
 * @returns {string}
 */
export function formatPercent(ratio, digits = 0) {
	if (ratio === null || ratio === undefined || !Number.isFinite(ratio)) return '—';
	const text = new Intl.NumberFormat('de-AT', {
		minimumFractionDigits: digits,
		maximumFractionDigits: digits
	}).format(ratio * 100);
	return `${text}${NBSP}%`;
}

/**
 * Datumsbestandteile in Wiener Zeit.
 *
 * @param {Date} date
 */
function viennaParts(date) {
	const parts = new Intl.DateTimeFormat('en-GB', {
		timeZone: TIME_ZONE,
		year: 'numeric',
		month: 'numeric',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
		weekday: 'short',
		hourCycle: 'h23'
	}).formatToParts(date);
	/** @param {string} type */
	const get = (type) => parts.find((part) => part.type === type)?.value ?? '';
	const weekdayIndex = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'));
	return {
		year: Number(get('year')),
		month: Number(get('month')),
		day: Number(get('day')),
		hour: get('hour'),
		minute: get('minute'),
		weekday: weekdayIndex
	};
}

/**
 * @param {Date | string | null | undefined} value
 * @returns {Date | null}
 */
function toDate(value) {
	if (!value) return null;
	const date = value instanceof Date ? value : new Date(value);
	return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Langes Datum: `4. Oktober 2026`.
 *
 * @param {Date | string | null | undefined} value
 * @returns {string}
 */
export function formatDate(value) {
	const date = toDate(value);
	if (!date) return '—';
	const { day, month, year } = viennaParts(date);
	return `${day}. ${MONTHS_LONG[month - 1]} ${year}`;
}

/**
 * Kurzes Datum: `04.10.2026`.
 *
 * @param {Date | string | null | undefined} value
 * @returns {string}
 */
export function formatDateShort(value) {
	const date = toDate(value);
	if (!date) return '—';
	const { day, month, year } = viennaParts(date);
	return `${String(day).padStart(2, '0')}.${String(month).padStart(2, '0')}.${year}`;
}

/**
 * Datum mit Uhrzeit: `04.10.2026, 14:05`.
 *
 * @param {Date | string | null | undefined} value
 * @returns {string}
 */
export function formatDateTime(value) {
	const date = toDate(value);
	if (!date) return '—';
	const { hour, minute } = viennaParts(date);
	return `${formatDateShort(date)}, ${hour}:${minute}`;
}

/**
 * Nur Uhrzeit: `14:05`.
 *
 * @param {Date | string | null | undefined} value
 * @returns {string}
 */
export function formatTime(value) {
	const date = toDate(value);
	if (!date) return '—';
	const { hour, minute } = viennaParts(date);
	return `${hour}:${minute}`;
}

/**
 * Achsenbeschriftung für einen Kalendertag (`YYYY-MM-DD`): `4. Okt`.
 *
 * @param {string} isoDay
 * @returns {string}
 */
export function formatDayLabel(isoDay) {
	const [, month, day] = isoDay.split('-').map(Number);
	return `${day}. ${MONTHS_SHORT[month - 1]}`;
}

/**
 * Tooltip-Beschriftung für einen Kalendertag: `Mo, 4. Oktober 2026`.
 *
 * @param {string} isoDay
 * @returns {string}
 */
export function formatDayLong(isoDay) {
	const [year, month, day] = isoDay.split('-').map(Number);
	const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
	return `${WEEKDAYS_SHORT[weekday]}, ${day}. ${MONTHS_LONG[month - 1]} ${year}`;
}

/**
 * Überschrift für eine Tagesgruppe in Zeitleisten: `Heute`, `Gestern` oder
 * das lange Datum.
 *
 * @param {Date | string} value
 * @param {Date} [now]
 * @returns {string}
 */
export function formatDayHeading(value, now = new Date()) {
	const date = toDate(value);
	if (!date) return '—';
	const key = viennaDayKey(date);
	if (key === viennaDayKey(now)) return 'Heute';
	if (key === viennaDayKey(new Date(now.getTime() - 86_400_000))) return 'Gestern';
	const { weekday } = viennaParts(date);
	return `${WEEKDAYS_SHORT[weekday]}, ${formatDate(date)}`;
}

/**
 * `YYYY-MM-DD` des Wiener Kalendertags.
 *
 * @param {Date} date
 * @returns {string}
 */
export function viennaDayKey(date) {
	const { year, month, day } = viennaParts(date);
	return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Relative Zeitangabe: `gerade eben`, `vor 5 Min.`, `vor 3 Std.`, `vor 2 Tagen`,
 * ab 30 Tagen das kurze Datum.
 *
 * @param {Date | string | null | undefined} value
 * @param {Date} [now]
 * @returns {string}
 */
export function formatRelative(value, now = new Date()) {
	const date = toDate(value);
	if (!date) return '—';
	const seconds = Math.round((now.getTime() - date.getTime()) / 1000);
	if (seconds < 0) {
		const ahead = -seconds;
		if (ahead < 3600) return `in ${Math.max(1, Math.round(ahead / 60))} Min.`;
		if (ahead < 86_400) return `in ${Math.round(ahead / 3600)} Std.`;
		const days = Math.round(ahead / 86_400);
		return days === 1 ? 'morgen' : `in ${days} Tagen`;
	}
	if (seconds < 60) return 'gerade eben';
	if (seconds < 3600) return `vor ${Math.round(seconds / 60)} Min.`;
	if (seconds < 86_400) return `vor ${Math.round(seconds / 3600)} Std.`;
	const days = Math.round(seconds / 86_400);
	if (days === 1) return 'gestern';
	if (days < 30) return `vor ${days} Tagen`;
	return formatDateShort(date);
}

/**
 * Veränderung gegenüber einer Vorperiode als Anteil (0,25 = +25 %). `null`,
 * wenn es keine Vergleichsbasis gibt.
 *
 * @param {number} current
 * @param {number} previous
 * @returns {number | null}
 */
export function changeRatio(current, previous) {
	if (!previous) return null;
	return (current - previous) / previous;
}

/**
 * Vorzeichenbehaftete Prozentveränderung: `+25 %`, `−10 %`.
 *
 * @param {number | null} ratio
 * @returns {string}
 */
export function formatChange(ratio) {
	if (ratio === null || !Number.isFinite(ratio)) return '—';
	const rounded = Math.round(ratio * 100);
	const sign = rounded > 0 ? '+' : rounded < 0 ? '−' : '±';
	return `${sign}${Math.abs(rounded)}${NBSP}%`;
}

/**
 * Initialen für Avatare.
 *
 * @param {string | null | undefined} firstName
 * @param {string | null | undefined} lastName
 * @returns {string}
 */
export function initials(firstName, lastName) {
	const value = `${(firstName ?? '').trim().charAt(0)}${(lastName ?? '').trim().charAt(0)}`;
	return value.toUpperCase() || '?';
}

/**
 * Grobe Geräteangabe aus einem User-Agent, z. B. `Chrome · macOS`.
 *
 * @param {string | null | undefined} userAgent
 * @returns {string}
 */
export function describeUserAgent(userAgent) {
	if (!userAgent) return 'Unbekanntes Gerät';
	const ua = userAgent;
	const browser = /Edg\//.test(ua)
		? 'Edge'
		: /Firefox\//.test(ua)
			? 'Firefox'
			: /Chrome\//.test(ua)
				? 'Chrome'
				: /Safari\//.test(ua)
					? 'Safari'
					: null;
	const os = /iPhone|iPad/.test(ua)
		? 'iOS'
		: /Android/.test(ua)
			? 'Android'
			: /Mac OS X/.test(ua)
				? 'macOS'
				: /Windows/.test(ua)
					? 'Windows'
					: /Linux/.test(ua)
						? 'Linux'
						: null;
	const parts = [browser, os].filter(Boolean);
	return parts.length > 0 ? parts.join(' · ') : 'Unbekanntes Gerät';
}
