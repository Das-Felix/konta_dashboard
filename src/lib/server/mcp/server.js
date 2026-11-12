/**
 * MCP-Server für Claude: dieselben Daten wie im Dashboard, als Tools.
 *
 * Jedes Tool ist eine dünne Hülle um die bestehenden Abfragen in
 * `src/lib/server/queries/*` und `src/lib/server/openpanel.js`. Dazu kommen
 * `describe_schema` und `run_sql` für freie Auswertungen, beides nur lesend.
 *
 * Zustandslos: pro HTTP-Anfrage ein neuer Server (siehe `routes/mcp`).
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { query, queryUntrusted } from '#lib/server/db.js';
import {
	getActiveUserSeries,
	getFunnel,
	getOverviewKpis,
	getRecentSignups,
	getSignupSeries
} from '#lib/server/queries/overview.js';
import {
	PAGE_SIZE,
	USER_FILTERS,
	USER_SORTS,
	getUserDetail,
	getUserNames,
	listUsers
} from '#lib/server/queries/users.js';
import {
	getOnboardingDropoff,
	getRetentionCohorts,
	getSurveyDistribution,
	getTaxAdvisorSplit,
	getVatModeSplit,
	getWeeklySignups
} from '#lib/server/queries/growth.js';
import {
	getAtRiskSubscriptions,
	getBillingSummary,
	getRecentConversions,
	getTrialsEndingSoon
} from '#lib/server/queries/billing.js';
import {
	getBackgroundHealth,
	getExtractionHealth,
	getFeatureAdoption,
	getTopAuditActions,
	getVolumeSeries
} from '#lib/server/queries/usage.js';
import {
	EMAIL_PAGE_SIZE,
	EMAIL_STATUS_FILTERS,
	getEmailSeries,
	getEmailSummary,
	getEmailTypeOptions,
	getEmailTypes,
	listEmailLogs
} from '#lib/server/queries/emails.js';
import {
	ACTIVITY_PAGE_SIZE,
	getAuditEntityTypes,
	getAuditFeed,
	getFailedLogins
} from '#lib/server/queries/activity.js';
import {
	WEBSITE,
	getBreakdown,
	getChart,
	getOverview,
	getProfileEvents,
	getRecentEvents,
	getTopPages,
	isOpenPanelConfigured,
	summarizeProfile
} from '#lib/server/openpanel.js';
import { KEY_EVENTS } from '#lib/labels.js';
import {
	BLOCKED_TABLES,
	DEFAULT_ROW_LIMIT,
	MAX_ROW_LIMIT,
	compactValue,
	isSecretColumn,
	prepareSql,
	sanitizeRows
} from './sql.js';

const INSTRUCTIONS = `Lesezugriff auf Konta Admin, das interne Dashboard der Buchhaltungssoftware Konta (Österreich).
Datenquellen: die Datenbank der Konta-App (Postgres, nur lesend) und OpenPanel (Produkt-Analytics der App und der Landingpage).
Regeln für Auswertungen:
- Tage zählen nach Wiener Zeit. Zeitstempel kommen als ISO-Strings in UTC.
- "Aktiv" heißt: Session-Aktivität, erfolgreicher Login oder ein Eintrag im Änderungsprotokoll im Zeitraum.
- Beträge (MRR) sind netto in Euro.
- Ein Unternehmen (companies) hat ein Abo (company_subscriptions) und einen oder mehrere Nutzer (users).
- Die OpenPanel-profileId ist die Konta-User-ID.
Für Fragen, die die festen Tools nicht abdecken: erst describe_schema, dann run_sql. Spaltennamen sind camelCase und brauchen Anführungszeichen (u."createdAt").`;

const days = (/** @type {number} */ fallback) =>
	z
		.number()
		.int()
		.min(1)
		.max(365)
		.default(fallback)
		.describe('Zeitraum in Tagen bis heute (Wiener Zeit). Das Dashboard nutzt 7, 30 oder 90.');

const page = z.number().int().min(1).default(1).describe('Seite, beginnt bei 1.');

/**
 * Wandelt Ergebnisse in MCP-Inhalt. Kompaktes JSON spart Tokens.
 *
 * @param {unknown} data
 */
function json(data) {
	return { content: [{ type: /** @type {const} */ ('text'), text: JSON.stringify(data) }] };
}

/** @param {string} message */
function fail(message) {
	return { isError: true, content: [{ type: /** @type {const} */ ('text'), text: message }] };
}

/**
 * Fängt Fehler ab, damit Claude eine lesbare Meldung statt eines
 * Protokollfehlers bekommt.
 *
 * @template A
 * @param {(args: A) => Promise<ReturnType<typeof json> | ReturnType<typeof fail>>} handler
 * @returns {(args: A) => Promise<ReturnType<typeof json> | ReturnType<typeof fail>>}
 */
function safe(handler) {
	return async (args) => {
		try {
			return await handler(args);
		} catch (error) {
			console.error('[mcp] tool error', error);
			return fail(error instanceof Error ? error.message : String(error));
		}
	};
}

/**
 * Kürzt lange Werte in einer Liste von Zeilen (Änderungsprotokoll-JSON).
 *
 * @param {Record<string, unknown>[]} rows
 */
function compactRows(rows) {
	return rows.map((row) =>
		Object.fromEntries(Object.entries(row).map(([key, value]) => [key, compactValue(value)]))
	);
}

const READ_ONLY = { readOnlyHint: true, openWorldHint: false };

/**
 * @returns {McpServer}
 */
export function createMcpServer() {
	const server = new McpServer(
		{ name: 'konta-admin', version: '1.0.0' },
		{ instructions: INSTRUCTIONS }
	);

	server.registerTool(
		'overview',
		{
			title: 'Übersicht',
			description:
				'Kennzahlen wie auf der Startseite: Nutzer gesamt, Registrierungen heute, aktive Nutzer, MRR, Tagesreihen für Registrierungen und aktive Nutzer, Funnel (Registrierung bis Abo) für Konten aus dem Zeitraum und die neuesten Registrierungen.',
			inputSchema: { days: days(30) },
			annotations: READ_ONLY
		},
		safe(async ({ days }) => {
			const [kpis, signups, active, funnel, recentSignups] = await Promise.all([
				getOverviewKpis(),
				getSignupSeries(days),
				getActiveUserSeries(days),
				getFunnel(days),
				getRecentSignups(10)
			]);
			return json({ days, kpis, signups, active, funnel, recentSignups });
		})
	);

	const filterKeys = /** @type {[string, ...string[]]} */ (Object.keys(USER_FILTERS));
	const sortKeys = /** @type {[string, ...string[]]} */ (Object.keys(USER_SORTS));

	server.registerTool(
		'list_users',
		{
			title: 'Nutzer suchen',
			description: `Nutzerliste wie unter /nutzer, ${PAGE_SIZE} pro Seite. Suche nach Name, E-Mail, Unternehmen, Telefon oder ID. Filter: ${Object.entries(
				USER_FILTERS
			)
				.map(([key, { label }]) => `${key} (${label})`)
				.join(', ')}. Sortierung: ${Object.entries(USER_SORTS)
				.map(([key, { label }]) => `${key} (${label})`)
				.join(', ')}. Liefert auch die Anzahl pro Filter.`,
			inputSchema: {
				search: z.string().max(120).default(''),
				filter: z.enum(filterKeys).default('alle'),
				sort: z.enum(sortKeys).default('neu'),
				page
			},
			annotations: READ_ONLY
		},
		safe(async (args) => {
			const result = await listUsers(args);
			return json({ ...result, page: args.page, pageSize: PAGE_SIZE });
		})
	);

	server.registerTool(
		'get_user',
		{
			title: 'Nutzer im Detail',
			description:
				'Alles zu einem Konto wie unter /nutzer/[id]: Stammdaten, Unternehmen, Abo, Umfrage, Zähler (Belege, Rechnungen, Kontakte, …), Teammitglieder, Leitfaden, Sessions, Logins, Änderungsprotokoll, Benachrichtigungen, fehlgeschlagene Belegerkennung und Dauerrechnungen, Mails und Aktivität pro Tag. Optional die OpenPanel-Ereignisse der letzten 90 Tage mit Zusammenfassung.',
			inputSchema: {
				id: z.string().min(1).describe('User-ID (aus list_users).'),
				include_events: z.boolean().default(false).describe('OpenPanel-Ereignisse mitliefern.'),
				event_limit: z.number().int().min(1).max(500).default(100)
			},
			annotations: READ_ONLY
		},
		safe(async ({ id, include_events, event_limit }) => {
			const detail = await getUserDetail(id);
			if (!detail) return fail(`Keinen Nutzer mit der ID ${id} gefunden.`);

			/** @type {unknown} */
			let openPanel = null;
			if (include_events) {
				if (!isOpenPanelConfigured()) {
					openPanel = { error: 'OpenPanel ist nicht eingerichtet.' };
				} else {
					const result = await getProfileEvents(id, { days: 90, limit: 500 });
					openPanel = result.ok
						? {
								total: result.data.total,
								summary: summarizeProfile(result.data.events),
								events: result.data.events.slice(0, event_limit)
							}
						: { error: result.error };
				}
			}

			return json({
				...detail,
				audit: compactRows(detail.audit),
				notifications: compactRows(detail.notifications),
				openPanel
			});
		})
	);

	server.registerTool(
		'growth',
		{
			title: 'Wachstum',
			description:
				'Wie /wachstum: Registrierungen pro Woche und pro Tag, Funnel, Akquise-Kanäle (leadSource) und bisher genutzte Tools (currentTool) aus der Onboarding-Umfrage, Steuerberatung ja/nein, Steuerstatus (vatMode), wo das Onboarding hängt, und Bindung nach Registrierungswoche (Anteil aktiver Konten in Woche 0, 1, 2, …).',
			inputSchema: {
				days: days(90),
				weeks: z.number().int().min(1).max(52).default(16).describe('Wochen für die Wochenreihe.'),
				cohort_weeks: z.number().int().min(1).max(26).default(8)
			},
			annotations: READ_ONLY
		},
		safe(async ({ days, weeks, cohort_weeks }) => {
			const [weekly, daily, funnel, leadSources, tools, taxAdvisor, vatModes, dropoff, cohorts] =
				await Promise.all([
					getWeeklySignups(weeks),
					getSignupSeries(days),
					getFunnel(days),
					getSurveyDistribution('leadSource', days),
					getSurveyDistribution('currentTool', days),
					getTaxAdvisorSplit(days),
					getVatModeSplit(days),
					getOnboardingDropoff(),
					getRetentionCohorts(cohort_weeks)
				]);
			return json({
				days,
				weekly,
				daily,
				funnel,
				leadSources,
				tools,
				taxAdvisor,
				vatModes,
				dropoff,
				cohorts
			});
		})
	);

	server.registerTool(
		'billing',
		{
			title: 'Abos',
			description:
				'Wie /abos: MRR (netto, Euro) und zahlende Abos nach Tarif und Intervall, Status aller Unternehmen, Test-zu-Abo-Quote, Tests die bald enden (mit Aktivitätssignalen), Zahlungsprobleme und Kündigungen, Abschlüsse der letzten Tage.',
			inputSchema: {
				trial_days: z
					.number()
					.int()
					.min(1)
					.max(60)
					.default(7)
					.describe('Tests, die in so vielen Tagen enden.'),
				conversion_days: days(30)
			},
			annotations: READ_ONLY
		},
		safe(async ({ trial_days, conversion_days }) => {
			const [summary, endingSoon, atRisk, conversions] = await Promise.all([
				getBillingSummary(),
				getTrialsEndingSoon(trial_days),
				getAtRiskSubscriptions(),
				getRecentConversions(conversion_days)
			]);
			return json({ summary, endingSoon, atRisk, conversions });
		})
	);

	server.registerTool(
		'usage',
		{
			title: 'Nutzung',
			description:
				'Wie /nutzung: aktive Nutzer pro Tag, Belege und Rechnungen pro Tag, Funktionen im Einsatz (wie viele Unternehmen welche Funktion nutzen), häufigste Aktionen im Änderungsprotokoll, Belegerkennung (Fehler- und Korrekturquote) und Hintergrundjobs.',
			inputSchema: { days: days(30) },
			annotations: READ_ONLY
		},
		safe(async ({ days }) => {
			const [active, volume, adoption, topActions, extraction, background] = await Promise.all([
				getActiveUserSeries(days),
				getVolumeSeries(days),
				getFeatureAdoption(),
				getTopAuditActions(days),
				getExtractionHealth(days),
				getBackgroundHealth(days)
			]);
			return json({ days, active, volume, adoption, topActions, extraction, background });
		})
	);

	const statusKeys =
		/** @type {[keyof typeof EMAIL_STATUS_FILTERS, ...(keyof typeof EMAIL_STATUS_FILTERS)[]]} */ (
			Object.keys(EMAIL_STATUS_FILTERS)
		);

	server.registerTool(
		'emails',
		{
			title: 'Mails',
			description: `Wie /mails: Plattform-Mails aus email_logs. Kennzahlen und Verlauf im Zeitraum, Aufschlüsselung nach Typ und ein Protokoll (${EMAIL_PAGE_SIZE} pro Seite, unabhängig vom Zeitraum) mit Suche nach Empfänger, Name, Unternehmen, Message-ID oder User-ID. Status: ${statusKeys.join(', ')}.`,
			inputSchema: {
				days: days(30),
				search: z.string().max(120).default(''),
				status: z.enum(statusKeys).default('alle'),
				type: z.string().optional().describe('Mail-Typ, z. B. aus der Aufschlüsselung.'),
				page
			},
			annotations: READ_ONLY
		},
		safe(async ({ days, search, status, type, page }) => {
			const typeOptions = await getEmailTypeOptions();
			if (type && !typeOptions.includes(type)) {
				return fail(`Unbekannter Mail-Typ. Möglich: ${typeOptions.join(', ')}`);
			}
			const [summary, series, types, log] = await Promise.all([
				getEmailSummary(days),
				getEmailSeries(days),
				getEmailTypes(days),
				listEmailLogs({ search: search.trim(), status, type: type ?? null, page })
			]);
			return json({
				days,
				summary,
				series,
				types,
				typeOptions,
				log,
				page,
				pageSize: EMAIL_PAGE_SIZE
			});
		})
	);

	server.registerTool(
		'activity',
		{
			title: 'Aktivität',
			description: `Wie /aktivitaet: Änderungsprotokoll über alle Unternehmen (neueste zuerst, ${ACTIVITY_PAGE_SIZE} pro Seite) mit Vorher und Nachher, und fehlgeschlagene Logins der letzten 24 Stunden. Filter nach entityType und actorType (USER, SYSTEM, UNKNOWN).`,
			inputSchema: {
				entity_type: z
					.string()
					.default('')
					.describe('Leer = alle. Mögliche Werte stehen in entityTypes.'),
				actor_type: z.enum(['', 'USER', 'SYSTEM', 'UNKNOWN']).default(''),
				page
			},
			annotations: READ_ONLY
		},
		safe(async ({ entity_type, actor_type, page }) => {
			const [feed, entityTypes, failedLogins] = await Promise.all([
				getAuditFeed({ entityType: entity_type, actorType: actor_type, page }),
				getAuditEntityTypes(),
				getFailedLogins()
			]);
			return json({
				rows: compactRows(feed.rows),
				total: feed.total,
				page,
				pageSize: ACTIVITY_PAGE_SIZE,
				entityTypes,
				failedLogins
			});
		})
	);

	server.registerTool(
		'app_analytics',
		{
			title: 'App-Analytics (OpenPanel)',
			description: `Wie /analytics: Besucher, Sessions und Seitenaufrufe der App aus OpenPanel, meistbesuchte Seiten, Tagesreihen für Ereignisse und die jüngsten Ereignisse mit aufgelöstem Kontonamen. Ohne "events" kommen die wichtigen Ereignisse: ${KEY_EVENTS.join(', ')}.`,
			inputSchema: {
				days: days(30),
				events: z
					.array(
						z.object({
							name: z.string().min(1),
							segment: z.enum(['event', 'user', 'session']).optional()
						})
					)
					.max(20)
					.optional()
					.describe(
						'Eigene Ereignisse für die Tagesreihen. segment: Ereignisse, eindeutige Nutzer oder Sessions zählen.'
					),
				breakdown: z
					.string()
					.optional()
					.describe('Optional: Eigenschaft für die Aufschlüsselung der Reihen.'),
				recent_limit: z.number().int().min(0).max(200).default(40)
			},
			annotations: READ_ONLY
		},
		safe(async ({ days, events, breakdown, recent_limit }) => {
			if (!isOpenPanelConfigured()) return fail('OpenPanel ist nicht eingerichtet.');
			const specs = events?.length ? events : KEY_EVENTS.map((name) => ({ name }));
			const [overview, chart, pages, recent] = await Promise.all([
				getOverview(days),
				getChart({ days, events: specs, breakdown }),
				getTopPages(days),
				recent_limit > 0
					? getRecentEvents({ limit: recent_limit })
					: Promise.resolve({ ok: /** @type {const} */ (true), data: [] })
			]);
			const recentEvents = recent.ok ? recent.data : [];
			const names = await getUserNames(recentEvents.map((event) => event.profileId ?? ''));
			const errors = [overview, chart, pages, recent].flatMap((result) =>
				result.ok ? [] : [result.error]
			);
			return json({
				days,
				errors,
				overview: overview.ok ? overview.data : null,
				events: chart.ok ? chart.data : null,
				pages: pages.ok ? pages.data : null,
				recent: recentEvents.map((event) => ({
					...event,
					user: event.profileId ? (names.get(event.profileId) ?? null) : null
				}))
			});
		})
	);

	/** @type {import('#lib/server/openpanel.js').BreakdownColumn[]} */
	const websiteColumns = [
		'referrer_name',
		'utm_source',
		'utm_campaign',
		'country',
		'device',
		'browser',
		'os'
	];

	server.registerTool(
		'website_analytics',
		{
			title: 'Landingpage (OpenPanel)',
			description:
				'Wie /landingpage: Besucher, Sessions, Absprungrate und Sessiondauer der Website aus dem zweiten OpenPanel-Projekt, meistbesuchte Seiten und Aufschlüsselung nach Quelle, UTM-Quelle, Kampagne, Land, Gerät, Browser und Betriebssystem.',
			inputSchema: { days: days(30), limit: z.number().int().min(1).max(50).default(10) },
			annotations: READ_ONLY
		},
		safe(async ({ days, limit }) => {
			if (!isOpenPanelConfigured(WEBSITE)) {
				return fail('Das OpenPanel-Projekt der Landingpage ist nicht eingerichtet.');
			}
			const [overview, pages, ...breakdowns] = await Promise.all([
				getOverview(days, WEBSITE),
				getTopPages(days, { project: WEBSITE, limit }),
				...websiteColumns.map((column) => getBreakdown(column, days, { project: WEBSITE, limit }))
			]);
			const errors = [overview, pages, ...breakdowns].flatMap((result) =>
				result.ok ? [] : [result.error]
			);
			return json({
				days,
				errors,
				overview: overview.ok ? overview.data : null,
				pages: pages.ok ? pages.data : null,
				breakdowns: Object.fromEntries(
					websiteColumns.map((column, index) => {
						const result = breakdowns[index];
						return [column, result.ok ? result.data : null];
					})
				)
			});
		})
	);

	server.registerTool(
		'describe_schema',
		{
			title: 'Datenbankschema',
			description:
				'Tabellen der Konta-Datenbank. Ohne "table": alle Tabellen mit geschätzter Zeilenzahl und Spaltennamen, dazu alle Enum-Werte. Mit "table": Spalten mit Typ und Nullbarkeit. Für run_sql.',
			inputSchema: { table: z.string().optional() },
			annotations: READ_ONLY
		},
		safe(async ({ table }) => {
			if (table && BLOCKED_TABLES.includes(table))
				return fail(`Die Tabelle ${table} ist gesperrt.`);
			const columns = await query(
				`SELECT c.table_name AS "table", c.column_name AS "column", c.data_type AS type,
					c.udt_name AS udt, c.is_nullable = 'YES' AS nullable, c.column_default AS "default"
				FROM information_schema.columns c
				WHERE c.table_schema = 'public' AND ($1::text IS NULL OR c.table_name = $1)
					AND NOT (c.table_name = ANY($2::text[]))
				ORDER BY c.table_name, c.ordinal_position`,
				[table ?? null, BLOCKED_TABLES]
			);
			const visible = columns.filter((row) => !isSecretColumn(row.column));

			if (table) {
				if (visible.length === 0) return fail(`Keine Tabelle ${table} im Schema public.`);
				return json({
					table,
					columns: visible.map(({ column, type, udt, nullable, default: def }) => ({
						column,
						type: type === 'USER-DEFINED' ? `enum ${udt}` : type,
						nullable,
						default: def
					}))
				});
			}

			const [sizes, enums] = await Promise.all([
				query(
					`SELECT relname AS "table", greatest(reltuples, 0)::bigint AS rows
					FROM pg_class WHERE relkind = 'r' AND relnamespace = 'public'::regnamespace`
				),
				query(
					`SELECT t.typname AS name, array_agg(e.enumlabel ORDER BY e.enumsortorder) AS "values"
					FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
					WHERE t.typnamespace = 'public'::regnamespace
					GROUP BY t.typname ORDER BY t.typname`
				)
			]);
			const rowCounts = new Map(sizes.map((row) => [row.table, Number(row.rows)]));

			/** @type {Record<string, { approxRows: number | null, columns: string[] }>} */
			const tables = {};
			for (const row of visible) {
				tables[row.table] ??= { approxRows: rowCounts.get(row.table) ?? null, columns: [] };
				tables[row.table].columns.push(row.column);
			}
			return json({
				tables,
				enums: Object.fromEntries(enums.map((row) => [row.name, row.values]))
			});
		})
	);

	server.registerTool(
		'run_sql',
		{
			title: 'SQL ausführen',
			description: `Freie Lese-Abfrage (nur SELECT oder WITH, eine Anweisung) gegen die Konta-Datenbank (Postgres). Läuft in einer read-only-Verbindung mit 15 Sekunden Zeitlimit. Höchstens ${MAX_ROW_LIMIT} Zeilen. Spaltennamen sind camelCase und brauchen Anführungszeichen (u."createdAt"), Tabellennamen sind snake_case (users, companies, company_subscriptions, invoices, issued_invoices, company_audit_logs, …). Zeitstempel sind UTC ohne Zone; Wiener Tage per ("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Vienna')::date. Hashes und Secrets sind gesperrt.`,
			inputSchema: {
				sql: z.string().min(1).max(20_000),
				limit: z.number().int().min(1).max(MAX_ROW_LIMIT).default(DEFAULT_ROW_LIMIT)
			},
			annotations: READ_ONLY
		},
		safe(async ({ sql, limit }) => {
			const prepared = prepareSql(sql, limit);
			if (!prepared.ok) return fail(prepared.error);
			const rows = await queryUntrusted(prepared.text, prepared.params);
			const truncated = rows.length > prepared.limit;
			const clean = sanitizeRows(truncated ? rows.slice(0, prepared.limit) : rows);
			return json({
				rowCount: clean.length,
				truncated,
				columns: clean[0] ? Object.keys(clean[0]) : [],
				rows: clean
			});
		})
	);

	return server;
}
