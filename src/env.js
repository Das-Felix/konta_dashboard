/**
 * Umgebungsvariablen des Dashboards (SvelteKit 3: `defineEnvVars`).
 *
 * Alles hier ist privat und wird zur Laufzeit gelesen, nichts davon landet im
 * Browser-Bundle. Pflichtwerte ohne `schema` müssen gesetzt sein, sonst
 * startet der Server nicht.
 */

import { defineEnvVars } from '@sveltejs/kit/env';
import { building } from '$app/env';

/**
 * Pflichtwert. Beim Build (SvelteKit analysiert die App, indem es sie
 * startet) gibt es die Laufzeit-Secrets noch nicht; geprüft wird erst beim
 * Serverstart. So landen keine Secrets im Docker-Build.
 *
 * @template T
 * @param {(value: string | undefined) => T} validate
 * @param {T} placeholder
 * @returns {(value: string | undefined) => T}
 */
function required(validate, placeholder) {
	return (value) => (building && !value ? placeholder : validate(value));
}

/**
 * Optionaler String: leer oder nicht gesetzt ergibt `undefined`.
 *
 * @param {string | undefined} value
 * @returns {string | undefined}
 */
function optional(value) {
	const trimmed = value?.trim();
	return trimmed ? trimmed : undefined;
}

export const variables = defineEnvVars({
	DATABASE_URL: {
		description:
			'Postgres-Verbindung zur Konta-Datenbank. Am besten eine Rolle mit reinen Leserechten (siehe README).',
		schema: required((value) => {
			if (!value) throw new Error('DATABASE_URL fehlt.');
			return value;
		}, '')
	},
	SESSION_SECRET: {
		description: 'Signiert das Admin-Session-Cookie. Mindestens 32 Zeichen.',
		schema: required((value) => {
			if (!value || value.length < 32) {
				throw new Error('SESSION_SECRET fehlt oder ist kürzer als 32 Zeichen.');
			}
			return value;
		}, '')
	},
	ADMIN_EMAILS: {
		description:
			'Kommagetrennte E-Mail-Adressen von Konta-Konten, die sich am Dashboard anmelden dürfen.',
		schema: required((value) => {
			const emails = (value ?? '')
				.split(',')
				.map((entry) => entry.trim().toLowerCase())
				.filter(Boolean);
			if (emails.length === 0) throw new Error('ADMIN_EMAILS enthält keine Adresse.');
			return emails;
		}, /** @type {string[]} */ ([]))
	},
	TWO_FACTOR_SECRET_KEY: {
		description:
			'Gleicher Wert wie in der Konta-App. Nötig, wenn ein Admin-Konto 2FA aktiviert hat.',
		schema: optional
	},
	OPENPANEL_API_URL: {
		description: 'Basis-URL der OpenPanel-API. Standard: https://api.openpanel.dev',
		schema: (value) => (optional(value) ?? 'https://api.openpanel.dev').replace(/\/+$/, '')
	},
	OPENPANEL_CLIENT_ID: {
		description: 'OpenPanel-Client mit Lese-Rechten (Modus "read" oder "root").',
		schema: optional
	},
	OPENPANEL_CLIENT_SECRET: {
		description: 'Secret zum Lese-Client.',
		schema: optional
	},
	OPENPANEL_PROJECT_ID: {
		description: 'Projekt-ID in OpenPanel (steht in der Projekt-URL).',
		schema: optional
	},
	OPENPANEL_DASHBOARD_URL: {
		description:
			'Optional: Projekt-URL im OpenPanel-Dashboard, z. B. https://dashboard.openpanel.dev/<org>/<projekt>. Aktiviert Direktlinks zu Profilen.',
		schema: (value) => optional(value)?.replace(/\/+$/, '')
	},
	KONTA_APP_URL: {
		description: 'Optional: URL der Konta-App, z. B. https://app.konta.at',
		schema: (value) => optional(value)?.replace(/\/+$/, '')
	}
});
