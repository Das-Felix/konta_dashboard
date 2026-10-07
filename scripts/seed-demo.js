#!/usr/bin/env node
/**
 * Füllt eine LOKALE Konta-Datenbank mit erfundenen Demo-Daten, damit sich
 * das Dashboard ohne Produktivdaten entwickeln lässt.
 *
 * Voraussetzung: das Schema der Konta-App ist angelegt
 * (`npx prisma migrate deploy` im konta_app-Repo).
 *
 *   npm run db:seed-demo   (liest DATABASE_URL aus .env)
 *
 * Verweigert jede Verbindung, die nicht auf localhost zeigt. Alle Datensätze
 * tragen das Präfix `demo_` und werden vor dem Einspielen entfernt, das
 * Skript ist also wiederholbar.
 *
 * Login danach: admin@konta.at / konta-demo (ADMIN_EMAILS entsprechend setzen).
 */

import pg from 'pg';
import { hash } from '@node-rs/argon2';

const url = process.env.DATABASE_URL;
if (!url) {
	console.error('DATABASE_URL fehlt.');
	process.exit(1);
}

const parsed = new URL(url);
const hostParam = parsed.searchParams.get('host') ?? '';
const isLocal =
	['localhost', '127.0.0.1', '::1', ''].includes(parsed.hostname) || hostParam.startsWith('/');
if (!isLocal) {
	console.error(`Abgebrochen: ${parsed.hostname} ist nicht localhost. Demo-Daten nur lokal.`);
	process.exit(1);
}

// ---------------------------------------------------------------------------
// Deterministischer Zufall, damit jeder Lauf dieselben Daten erzeugt.
// ---------------------------------------------------------------------------
let seed = 20261007;
function random() {
	seed = (seed * 1664525 + 1013904223) % 4294967296;
	return seed / 4294967296;
}
/** @template T @param {T[]} list @returns {T} */
const pick = (list) => list[Math.floor(random() * list.length)];
/** @param {number} p */
const chance = (p) => random() < p;
/** @param {number} min @param {number} max */
const between = (min, max) => min + Math.floor(random() * (max - min + 1));

let counter = 0;
/** @param {string} prefix */
const id = (prefix) => `demo_${prefix}_${(++counter).toString(36).padStart(6, '0')}`;

const NOW = Date.now();
const DAY = 86_400_000;
/** @param {number} daysAgo @param {number} [hour] */
function at(daysAgo, hour = between(7, 21)) {
	const date = new Date(NOW - daysAgo * DAY);
	date.setUTCHours(hour - 2, between(0, 59), between(0, 59), 0);
	return past(date);
}
/** Nichts in der Zukunft: spätere Folgeereignisse (Bestätigung, Ausstellung) kappen. @param {Date} date */
function past(date) {
	return date.getTime() > NOW ? new Date(NOW - between(1, 50) * 60_000) : date;
}

// Erfundene Namen (Styleguide 12: keine echten Firmen).
const FIRST = [
	'Anna',
	'Lukas',
	'Sophie',
	'Jakob',
	'Lena',
	'Maximilian',
	'Marie',
	'Elias',
	'Laura',
	'Felix',
	'Hannah',
	'Paul',
	'Johanna',
	'David',
	'Katharina',
	'Tobias',
	'Julia',
	'Simon',
	'Theresa',
	'Florian',
	'Magdalena',
	'Matthias',
	'Valentina',
	'Stefan',
	'Verena'
];
const LAST = [
	'Gruber',
	'Huber',
	'Wagner',
	'Pichler',
	'Steiner',
	'Moser',
	'Mayer',
	'Hofer',
	'Leitner',
	'Berger',
	'Fuchs',
	'Eder',
	'Fischer',
	'Schmid',
	'Winkler',
	'Weber',
	'Schwarz',
	'Maier',
	'Reiter',
	'Brunnhofer',
	'Stiegler',
	'Novak',
	'Lindner',
	'Aigner',
	'Koller'
];
const TRADES = [
	'Grafikdesign',
	'Holzwerk',
	'Fotografie',
	'Tischlerei',
	'Coaching',
	'Webentwicklung',
	'Physiotherapie',
	'Übersetzungen',
	'Malerei',
	'Atelier',
	'Studio',
	'Gartenpflege',
	'Yogastudio',
	'Elektrotechnik',
	'Beratung'
];
const CITIES = [
	['1070', 'Wien'],
	['8010', 'Graz'],
	['4020', 'Linz'],
	['5020', 'Salzburg'],
	['6020', 'Innsbruck'],
	['9020', 'Klagenfurt'],
	['3100', 'St. Pölten'],
	['6900', 'Bregenz']
];
const LEAD = [
	'GOOGLE',
	'GOOGLE',
	'GOOGLE',
	'EMPFEHLUNG',
	'EMPFEHLUNG',
	'SOCIAL_MEDIA',
	'AI_CHAT',
	'STEUERBERATER',
	'WIRTSCHAFTSKAMMER',
	'SONSTIGES'
];
const TOOLS = [
	'EXCEL',
	'EXCEL',
	'PAPER_WORD_NOTES',
	'KEINS',
	'KEINS',
	'FREEFINANCE',
	'SEVDESK',
	'LEXOFFICE',
	'OTHER_SOFTWARE'
];
const VENDORS = [
	'Bürobedarf Lindner',
	'Druckerei Weitblick',
	'Netzwerk Hosting Süd',
	'Café Stiegler',
	'Papierwaren Koller',
	'Werkzeug Aigner'
];
const UA = [
	'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36',
	'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36 Edg/129.0',
	'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
	'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
	'Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0'
];

/** @type {Record<string, any[]>} */
const rows = {
	companies: [],
	users: [],
	company_subscriptions: [],
	onboarding_surveys: [],
	user_guide_progress: [],
	sessions: [],
	login_attempts: [],
	contacts: [],
	invoices: [],
	issued_invoices: [],
	offers: [],
	recurring_invoices: [],
	recurring_invoice_runs: [],
	vehicles: [],
	company_audit_logs: [],
	notifications: []
};

const adminHash = await hash('konta-demo', {
	algorithm: 2,
	memoryCost: 19456,
	timeCost: 2,
	parallelism: 1
});
const userHash = await hash('demo-nutzer-passwort', {
	algorithm: 2,
	memoryCost: 19456,
	timeCost: 2,
	parallelism: 1
});

/**
 * @param {{ companyId: string, userId: string | null, entityType: string, entityId: string, action: string, summary: string, createdAt: Date, changes?: any, metadata?: any, actorType?: string }} entry
 */
function audit({ changes, metadata, actorType, ...entry }) {
	rows.company_audit_logs.push({
		id: id('log'),
		...entry,
		actorType: entry.userId ? 'USER' : (actorType ?? 'SYSTEM'),
		changes: changes ? JSON.stringify(changes) : null,
		metadata: metadata ? JSON.stringify(metadata) : null
	});
}

const USER_COUNT = 186;
for (let index = 0; index < USER_COUNT; index += 1) {
	const isAdmin = index === 0;
	// Wachstum: neuere Tage dichter besetzt, plus ein paar Signups heute.
	const daysAgo = isAdmin ? 140 : index < 5 ? 0 : Math.floor(Math.pow(random(), 1.6) * 120);
	const createdAt = at(daysAgo);
	const firstName = isAdmin ? 'Konta' : pick(FIRST);
	const lastName = isAdmin ? 'Admin' : pick(LAST);
	const email = isAdmin
		? 'admin@konta.at'
		: `${firstName}.${lastName}${index}@beispiel.at`
				.toLowerCase()
				.replace(/ä/g, 'ae')
				.replace(/ö/g, 'oe')
				.replace(/ü/g, 'ue');
	const [postalCode, city] = pick(CITIES);
	const vatMode = chance(0.68) ? 'KLEINUNTERNEHMER' : 'REGELBESTEUERT';

	const verified = isAdmin || chance(daysAgo === 0 ? 0.5 : 0.9);
	const onboarded = isAdmin || (verified && chance(daysAgo === 0 ? 0.3 : 0.8));
	const engaged = onboarded && chance(0.75);

	const companyId = id('co');
	const userId = id('u');
	rows.companies.push({
		id: companyId,
		createdAt,
		updatedAt: createdAt,
		companyName: chance(0.6) ? `${pick(TRADES)} ${lastName}` : null,
		street: `${pick(['Hauptstraße', 'Gartengasse', 'Lindenweg', 'Bahnhofstraße'])} ${between(1, 80)}`,
		postalCode,
		city,
		vatMode,
		uvaPeriod: vatMode === 'REGELBESTEUERT' ? pick(['MONTHLY', 'QUARTERLY']) : null,
		experimental: isAdmin
	});

	const steps =
		vatMode === 'REGELBESTEUERT'
			? ['steuerstatus', 'uid', 'unternehmen', 'uva', 'fragen', 'bestaetigung', 'plan']
			: ['steuerstatus', 'unternehmen', 'fragen', 'bestaetigung', 'plan'];
	rows.users.push({
		id: userId,
		email,
		passwordHash: isAdmin ? adminHash : userHash,
		emailVerifiedAt: verified
			? past(new Date(createdAt.getTime() + between(2, 40) * 60_000))
			: null,
		createdAt,
		updatedAt: createdAt,
		firstName,
		lastName,
		phone: chance(0.7) ? `+43 6${between(50, 99)} ${between(100000, 9999999)}` : null,
		companyId,
		onboardingStep: onboarded ? null : pick(steps.slice(0, -1)),
		onboardingCompletedAt: onboarded
			? past(new Date(createdAt.getTime() + between(5, 90) * 60_000))
			: null,
		termsAcceptedAt: onboarded ? createdAt : null,
		marketingConsentAt: chance(0.4) ? createdAt : null,
		twoFactorEnabled: chance(0.15),
		twoFactorEnabledAt: null
	});

	if (onboarded || chance(0.5)) {
		rows.onboarding_surveys.push({
			id: id('sv'),
			userId,
			createdAt,
			updatedAt: createdAt,
			leadSource: pick(LEAD),
			hasTaxAdvisor: chance(0.45),
			currentTool: pick(TOOLS)
		});
	}

	// Abo: 30 Tage Test, danach Konvertierung, Ablauf oder Kündigung.
	const trialEndsAt = new Date(createdAt.getTime() + 30 * DAY);
	let status = 'TRIALING';
	if (trialEndsAt.getTime() < NOW) {
		status = engaged && chance(0.55) ? 'ACTIVE' : chance(0.85) ? 'TRIAL_EXPIRED' : 'CANCELED';
		if (status === 'ACTIVE' && chance(0.06)) status = 'PAST_DUE';
	} else if (engaged && chance(0.12)) {
		status = 'ACTIVE';
	}
	const plan = vatMode === 'REGELBESTEUERT' ? 'KOMPLETT' : chance(0.85) ? 'START' : 'KOMPLETT';
	const paying = status === 'ACTIVE' || status === 'PAST_DUE' || status === 'CANCELED';
	rows.company_subscriptions.push({
		id: id('sub'),
		companyId,
		plan,
		status,
		trialEndsAt,
		stripeCustomerId: paying ? `cus_demo${index}` : null,
		stripeSubscriptionId: paying ? `sub_demo${index}` : null,
		billingInterval: paying ? (chance(0.35) ? 'YEARLY' : 'MONTHLY') : null,
		currentPeriodEnd: paying ? new Date(NOW + between(2, 28) * DAY) : null,
		cancelAtPeriodEnd: status === 'CANCELED',
		createdAt,
		updatedAt: createdAt
	});

	// Logins und Sessions.
	const activeDays = engaged
		? between(4, Math.max(4, Math.min(60, daysAgo)))
		: onboarded
			? between(1, 3)
			: 1;
	const lastActiveDaysAgo = engaged
		? Math.min(daysAgo, Math.floor(Math.pow(random(), 2) * 20))
		: daysAgo;
	const ua = pick(UA);
	const ip = `84.${between(110, 119)}.${between(0, 255)}.${between(1, 254)}`;
	/** @type {number[]} */
	const days = [];
	for (let n = 0; n < activeDays; n += 1) {
		days.push(Math.max(lastActiveDaysAgo, between(lastActiveDaysAgo, daysAgo)));
	}
	days.push(lastActiveDaysAgo);
	for (const d of days) {
		const when = at(d);
		if (when < createdAt) continue;
		rows.login_attempts.push({
			id: id('la'),
			email,
			userId,
			stage: 'PASSWORD',
			result: 'SUCCESS',
			success: true,
			ipAddress: ip,
			userAgent: ua,
			createdAt: when
		});
	}
	if (chance(0.2)) {
		rows.login_attempts.push({
			id: id('la'),
			email,
			userId,
			stage: 'PASSWORD',
			result: 'INVALID_CREDENTIALS',
			success: false,
			ipAddress: ip,
			userAgent: ua,
			createdAt: at(lastActiveDaysAgo)
		});
	}
	const lastActive = at(lastActiveDaysAgo);
	rows.sessions.push({
		id: id('s'),
		tokenHash: id('tok'),
		userId,
		ipAddress: ip,
		userAgent: ua,
		lastActiveAt: lastActive < createdAt ? createdAt : lastActive,
		createdAt,
		expiresAt: new Date(NOW + 20 * DAY)
	});
	if (chance(0.3)) {
		const mobile = UA[2];
		rows.sessions.push({
			id: id('s'),
			tokenHash: id('tok'),
			userId,
			ipAddress: `178.${between(160, 190)}.${between(0, 255)}.${between(1, 254)}`,
			userAgent: mobile,
			lastActiveAt: at(Math.min(daysAgo, lastActiveDaysAgo + between(0, 5))),
			createdAt,
			expiresAt: new Date(NOW + 10 * DAY)
		});
	}

	if (!onboarded) continue;

	// Leitfaden.
	for (const step of ['unternehmen', 'briefpapier', 'vorlagen', 'kontakt', 'rechnung', 'beleg']) {
		if (chance(engaged ? 0.7 : 0.25)) {
			rows.user_guide_progress.push({
				id: id('gp'),
				userId,
				step,
				state: chance(0.85) ? 'DONE' : 'DISMISSED',
				createdAt,
				updatedAt: createdAt
			});
		}
	}

	audit({
		companyId,
		userId,
		entityType: 'company',
		entityId: companyId,
		action: 'update',
		summary: 'Unternehmensdaten geändert',
		createdAt: past(new Date(createdAt.getTime() + 20 * 60_000)),
		changes: { companyName: { from: null, to: 'Studio' }, city: { from: null, to: city } }
	});

	if (!engaged) continue;

	// Kontakte.
	/** @type {string[]} */
	const contactIds = [];
	const contactCount = between(1, 8);
	for (let c = 0; c < contactCount; c += 1) {
		const contactId = id('ct');
		contactIds.push(contactId);
		rows.contacts.push({
			id: contactId,
			companyId,
			name: `${pick(TRADES)} ${pick(LAST)}`,
			type: 'CUSTOMER',
			contactNumber: `K-${1000 + c}`,
			createdAt: at(between(lastActiveDaysAgo, daysAgo)),
			updatedAt: createdAt
		});
	}

	// Belege (Uploads) mit Belegerkennung.
	const receiptCount = between(2, 40);
	for (let r = 0; r < receiptCount; r += 1) {
		const when = at(between(lastActiveDaysAgo, daysAgo));
		const failed = chance(0.04);
		const pending = !failed && chance(0.1);
		const invoiceId = id('inv');
		rows.invoices.push({
			id: invoiceId,
			companyId,
			type: 'EXPENSE',
			source: chance(0.9) ? 'UPLOADED' : 'MANUAL',
			extractionState: failed ? 'FAILED' : pending && chance(0.3) ? 'PROCESSING' : 'COMPLETED',
			extractionError: failed
				? pick(['PDF konnte nicht gelesen werden', 'Zeitüberschreitung bei der Erkennung'])
				: null,
			issuerName: pick(VENDORS),
			reviewStatus: pending || failed ? 'PENDING' : 'CONFIRMED',
			createdAt: when,
			updatedAt: when
		});
		audit({
			companyId,
			userId,
			entityType: 'invoice',
			entityId: invoiceId,
			action: 'create',
			summary: `Beleg hochgeladen: ${pick(VENDORS)}`,
			createdAt: when,
			metadata: { flow: 'incoming' }
		});
		if (!pending && !failed) {
			const corrected = chance(0.3);
			audit({
				companyId,
				userId,
				entityType: 'invoice',
				entityId: invoiceId,
				action: 'confirm',
				summary: 'Beleg bestätigt',
				createdAt: past(new Date(when.getTime() + between(1, 120) * 60_000)),
				changes: corrected ? { invoiceDate: { from: '2026-09-01', to: '2026-09-02' } } : null,
				metadata: { flow: 'incoming' }
			});
		}
	}

	// Ausgangsrechnungen.
	const issuedCount = between(0, 18);
	for (let r = 0; r < issuedCount; r += 1) {
		const when = at(between(lastActiveDaysAgo, daysAgo));
		const invoiceId = id('inv');
		const draft = chance(0.12);
		rows.invoices.push({
			id: invoiceId,
			companyId,
			type: 'INCOME',
			source: 'CREATED',
			extractionState: 'COMPLETED',
			reviewStatus: draft ? 'PENDING' : 'CONFIRMED',
			invoiceNumber: `R-2026-${String(r + 1).padStart(3, '0')}`,
			paymentStatus: chance(0.6) ? 'PAID' : 'OPEN',
			createdAt: when,
			updatedAt: when
		});
		rows.issued_invoices.push({
			id: id('ii'),
			companyId,
			invoiceId,
			status: draft ? 'DRAFT' : 'ISSUED',
			title: 'Rechnung',
			issuedAt: draft ? null : when,
			eInvoiceEnabled: chance(0.1),
			createdAt: when,
			updatedAt: when
		});
		audit({
			companyId,
			userId,
			entityType: 'invoice',
			entityId: invoiceId,
			action: 'create',
			summary: 'Rechnungsentwurf angelegt',
			createdAt: when,
			metadata: { flow: 'outgoing' }
		});
		if (!draft) {
			audit({
				companyId,
				userId,
				entityType: 'invoice',
				entityId: invoiceId,
				action: 'issue',
				summary: `Rechnung R-2026-${String(r + 1).padStart(3, '0')} ausgestellt`,
				createdAt: past(new Date(when.getTime() + 15 * 60_000)),
				metadata: { invoiceNumber: `R-2026-${String(r + 1).padStart(3, '0')}` }
			});
		}
	}

	// Angebote.
	if (chance(0.45)) {
		for (let o = 0; o < between(1, 5); o += 1) {
			const when = at(between(lastActiveDaysAgo, daysAgo));
			rows.offers.push({
				id: id('of'),
				companyId,
				contactId: pick(contactIds),
				number: `AN-2026-${String(o + 1).padStart(3, '0')}`,
				title: 'Angebot',
				status: pick(['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED']),
				validUntil: new Date(when.getTime() + 30 * DAY),
				netAmount: 1000,
				vatAmount: 200,
				grossAmount: 1200,
				createdAt: when,
				updatedAt: when
			});
		}
	}

	// Dauerrechnungen mit Läufen.
	if (chance(0.25)) {
		const recurringId = id('ri');
		const start = at(daysAgo);
		rows.recurring_invoices.push({
			id: recurringId,
			companyId,
			contactId: pick(contactIds),
			name: 'Monatliche Betreuung',
			title: 'Betreuung',
			interval: 'MONTHLY',
			startDate: start,
			status: chance(0.8) ? 'ACTIVE' : 'PAUSED',
			createdAt: start,
			updatedAt: start
		});
		audit({
			companyId,
			userId,
			entityType: 'recurring_invoice',
			entityId: recurringId,
			action: 'create',
			summary: 'Dauerrechnung angelegt',
			createdAt: start,
			metadata: { interval: 'MONTHLY' }
		});
		for (let m = 0; m * 30 < daysAgo; m += 1) {
			const scheduled = new Date(start.getTime() + m * 30 * DAY);
			if (scheduled.getTime() > NOW) break;
			const failed = chance(0.08);
			rows.recurring_invoice_runs.push({
				id: id('rr'),
				recurringInvoiceId: recurringId,
				scheduledFor: scheduled,
				occurrenceIndex: m,
				serviceStart: scheduled,
				serviceEnd: new Date(scheduled.getTime() + 29 * DAY),
				status: failed ? 'FAILED' : 'SENT',
				error: failed ? 'SMTP-Server hat die Verbindung abgelehnt' : null,
				createdAt: scheduled,
				updatedAt: scheduled
			});
			audit({
				companyId,
				userId: null,
				entityType: 'recurring_invoice',
				entityId: recurringId,
				action: failed ? 'run_failed' : 'run',
				summary: failed
					? 'Dauerrechnung konnte nicht versendet werden'
					: 'Dauerrechnung ausgestellt und versendet',
				createdAt: scheduled,
				metadata: failed ? { error: 'SMTP' } : { status: 'SENT' }
			});
			if (failed) {
				rows.notifications.push({
					id: id('n'),
					companyId,
					userId,
					category: 'ERROR',
					type: 'recurring_run_failed',
					title: 'Dauerrechnung nicht versendet',
					body: 'Der Versand ist fehlgeschlagen. Prüf deine SMTP-Einstellungen.',
					createdAt: scheduled,
					emailError: chance(0.5) ? 'Mailbox nicht erreichbar' : null,
					emailSentAt: null
				});
			}
		}
	}

	// Fahrtenbuch.
	if (chance(0.15)) {
		const vehicleId = id('ve');
		const when = at(between(lastActiveDaysAgo, daysAgo));
		rows.vehicles.push({
			id: vehicleId,
			companyId,
			name: 'Firmenauto',
			type: 'CAR',
			createdAt: when,
			updatedAt: when
		});
		audit({
			companyId,
			userId,
			entityType: 'vehicle',
			entityId: vehicleId,
			action: 'create',
			summary: 'Fahrzeug angelegt',
			createdAt: when
		});
	}

	// Benachrichtigungen.
	if (chance(0.5)) {
		const when = at(between(0, 10));
		rows.notifications.push({
			id: id('n'),
			companyId,
			userId,
			category: 'TAX_DEADLINE',
			type: 'tax_deadline_upcoming',
			title: 'UVA Q3 fällig am 15.11.',
			body: null,
			createdAt: when,
			readAt: chance(0.6) ? when : null,
			emailSentAt: when
		});
	}
}

// ---------------------------------------------------------------------------
// Schreiben
// ---------------------------------------------------------------------------
const client = new pg.Client({ connectionString: url });
await client.connect();

/**
 * @param {string} table
 * @param {any[]} list
 */
async function insert(table, list) {
	if (list.length === 0) return;
	const columns = [...new Set(list.flatMap((row) => Object.keys(row)))];
	const chunkSize = Math.floor(30000 / columns.length);
	for (let start = 0; start < list.length; start += chunkSize) {
		const chunk = list.slice(start, start + chunkSize);
		/** @type {unknown[]} */
		const values = [];
		const tuples = chunk.map((row) => {
			const placeholders = columns.map((column) => {
				values.push(row[column] ?? null);
				return `$${values.length}`;
			});
			return `(${placeholders.join(', ')})`;
		});
		const columnList = columns.map((column) => `"${column}"`).join(', ');
		// Fehlende Spalten auf DEFAULT fallen lassen geht mit Platzhaltern nicht,
		// daher pro Tabelle nur Spalten, die jede Zeile kennt oder die NULL
		// vertragen.
		await client.query(`INSERT INTO ${table} (${columnList}) VALUES ${tuples.join(', ')}`, values);
	}
}

/**
 * Füllt fehlende Schlüssel mit Defaults, damit keine NULLs in NOT-NULL-Spalten
 * mit Default landen.
 *
 * @param {any[]} list
 * @param {Record<string, unknown>} defaults
 */
function withDefaults(list, defaults) {
	return list.map((row) => ({ ...defaults, ...row }));
}

try {
	await client.query('BEGIN');
	// Kaskaden entfernen abhängige Zeilen (users hängen mit RESTRICT an companies).
	await client.query(`DELETE FROM login_attempts WHERE id LIKE 'demo_%'`);
	await client.query(`DELETE FROM users WHERE id LIKE 'demo_%'`);
	await client.query(`DELETE FROM companies WHERE id LIKE 'demo_%'`);

	await insert(
		'companies',
		withDefaults(rows.companies, { uvaPeriod: null, companyName: null, experimental: false })
	);
	await insert('users', withDefaults(rows.users, { twoFactorEnabled: false }));
	await insert(
		'company_subscriptions',
		withDefaults(rows.company_subscriptions, { cancelAtPeriodEnd: false })
	);
	await insert('onboarding_surveys', rows.onboarding_surveys);
	await insert('user_guide_progress', rows.user_guide_progress);
	await insert('sessions', rows.sessions);
	await insert('login_attempts', rows.login_attempts);
	await insert('contacts', rows.contacts);
	await insert(
		'invoices',
		withDefaults(rows.invoices, {
			extractionError: null,
			issuerName: null,
			invoiceNumber: null,
			paymentStatus: 'OPEN'
		})
	);
	await insert('issued_invoices', withDefaults(rows.issued_invoices, { eInvoiceEnabled: false }));
	await insert('offers', rows.offers);
	await insert('recurring_invoices', rows.recurring_invoices);
	await insert(
		'recurring_invoice_runs',
		withDefaults(rows.recurring_invoice_runs, { error: null })
	);
	await insert('vehicles', rows.vehicles);
	await insert(
		'company_audit_logs',
		withDefaults(rows.company_audit_logs, { changes: null, metadata: null })
	);
	await insert(
		'notifications',
		withDefaults(rows.notifications, {
			readAt: null,
			emailSentAt: null,
			emailError: null,
			body: null
		})
	);
	await client.query('COMMIT');
} catch (error) {
	await client.query('ROLLBACK');
	throw error;
} finally {
	await client.end();
}

for (const [table, list] of Object.entries(rows)) {
	console.log(`${table.padEnd(26)} ${list.length}`);
}
console.log('\nLogin: admin@konta.at / konta-demo');
