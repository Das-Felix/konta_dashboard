/**
 * Anzeigetexte für Werte aus der Konta-Datenbank und aus OpenPanel.
 *
 * Quelle der Wahrheit für die Werte selbst ist die Konta-App:
 * - Audit: `src/lib/audit/labels.js`
 * - Umfrage: `src/lib/onboarding/labels.js`
 * - Onboarding-Schritte: `src/lib/onboarding/steps.js`
 * - Leitfaden: `src/lib/guide/steps.js`
 * - Analytics-Ereignisse: `src/lib/server/analytics/events.js` und die
 *   `trackServerEvent`-Aufrufe in den Routen.
 *
 * Unbekannte Werte fallen auf den Rohwert zurück, damit neue Werte in der App
 * hier nichts kaputt machen.
 */

/**
 * @typedef {'green' | 'soft' | 'neutral' | 'ink' | 'error'} Tone
 */

/** @type {Record<string, string>} */
export const ENTITY_TYPE_LABELS = {
	invoice: 'Beleg / Rechnung',
	issued_invoice: 'Ausgangsrechnung',
	asset: 'Anlage',
	mileage_trip: 'Fahrt',
	vehicle: 'Fahrzeug',
	company: 'Unternehmen',
	subscription: 'Abo',
	recurring_invoice: 'Dauerrechnung',
	number_series: 'Nummernkreis'
};

/** @type {Record<string, string>} */
export const ACTION_LABELS = {
	create: 'Erstellt',
	update: 'Geändert',
	confirm: 'Bestätigt',
	issue: 'Ausgestellt',
	storno: 'Storniert',
	delete: 'Gelöscht',
	payment: 'Zahlung aktualisiert',
	archive: 'Archiviert',
	restore: 'Wiederhergestellt',
	unlink_contact: 'Kontakt getrennt',
	ear_sync: 'Kilometergeld synchronisiert',
	subscription_sync: 'Abo aktualisiert',
	pause: 'Pausiert',
	resume: 'Fortgesetzt',
	end: 'Beendet',
	run: 'Lauf ausgeführt',
	run_failed: 'Lauf fehlgeschlagen',
	run_retry: 'Lauf wiederholt'
};

/**
 * @param {string} value
 * @returns {string}
 */
export function entityTypeLabel(value) {
	return ENTITY_TYPE_LABELS[value] ?? value;
}

/**
 * @param {string} value
 * @returns {string}
 */
export function actionLabel(value) {
	return ACTION_LABELS[value] ?? value;
}

/** @type {Record<string, { label: string, tone: Tone }>} */
export const SUBSCRIPTION_STATUS = {
	TRIALING: { label: 'Test', tone: 'soft' },
	TRIAL_EXPIRED: { label: 'Test abgelaufen', tone: 'neutral' },
	ACTIVE: { label: 'Zahlend', tone: 'green' },
	PAST_DUE: { label: 'Zahlung offen', tone: 'error' },
	CANCELED: { label: 'Gekündigt', tone: 'neutral' }
};

/**
 * @param {string | null | undefined} status
 * @returns {{ label: string, tone: Tone }}
 */
export function subscriptionStatus(status) {
	if (!status) return { label: 'Kein Abo', tone: 'neutral' };
	return SUBSCRIPTION_STATUS[status] ?? { label: status, tone: 'neutral' };
}

/** @type {Record<string, string>} */
export const PLAN_LABELS = {
	START: 'Konta Start',
	KOMPLETT: 'Konta Komplett'
};

/** @type {Record<string, string>} */
export const INTERVAL_LABELS = {
	MONTHLY: 'Monatlich',
	YEARLY: 'Jährlich'
};

/** @type {Record<string, string>} */
export const VAT_MODE_LABELS = {
	KLEINUNTERNEHMER: 'Kleinunternehmer',
	REGELBESTEUERT: 'Regelbesteuert'
};

/** @type {Record<string, string>} */
export const UVA_PERIOD_LABELS = {
	MONTHLY: 'UVA monatlich',
	QUARTERLY: 'UVA vierteljährlich'
};

/** @type {Record<string, string>} */
export const LEAD_SOURCE_LABELS = {
	GOOGLE: 'Google-Suche',
	AI_CHAT: 'Chat-Assistent',
	SOCIAL_MEDIA: 'Social Media',
	EMPFEHLUNG: 'Empfehlung',
	STEUERBERATER: 'Steuerberatung',
	WIRTSCHAFTSKAMMER: 'Wirtschaftskammer',
	PODCAST_BLOG: 'Podcast oder Blog',
	SONSTIGES: 'Woanders'
};

/** @type {Record<string, string>} */
export const CURRENT_TOOL_LABELS = {
	FREEFINANCE: 'FreeFinance',
	SEVDESK: 'sevdesk',
	EVERBILL: 'everbill',
	LEXOFFICE: 'Lexware Office',
	EXCEL: 'Tabellenkalkulation',
	PAPER_WORD_NOTES: 'Papier, Word oder Notizen',
	KEINS: 'Startet gerade',
	OTHER_SOFTWARE: 'Andere Software',
	WORD_NOTIZEN: 'Word oder Notizen',
	PAPIER: 'Auf Papier',
	STEUERBERATER_MACHT_ES: 'Macht die Steuerberatung',
	WISO: 'WISO',
	FINANZONLINE: 'Direkt in FinanzOnline',
	SONSTIGES: 'Etwas anderes'
};

/** Reihenfolge des Onboarding-Wizards (Passwort ist Schritt 0). */
export const ONBOARDING_STEPS = [
	'steuerstatus',
	'uid',
	'unternehmen',
	'uva',
	'fragen',
	'bestaetigung',
	'plan'
];

/** @type {Record<string, string>} */
export const ONBOARDING_STEP_LABELS = {
	steuerstatus: 'Steuerstatus',
	uid: 'UID-Nummer',
	unternehmen: 'Unternehmen',
	uva: 'UVA-Einstellungen',
	fragen: 'Umfrage',
	bestaetigung: 'E-Mail bestätigen',
	plan: 'Tarif wählen'
};

/** @type {Record<string, string>} */
export const GUIDE_STEP_LABELS = {
	unternehmen: 'Unternehmen vervollständigen',
	briefpapier: 'Briefpapier gestalten',
	vorlagen: 'Vorlagen ansehen',
	kontakt: 'Ersten Kontakt anlegen',
	rechnung: 'Erste Rechnung schreiben',
	beleg: 'Ersten Beleg hochladen'
};

/** @type {Record<string, { label: string, tone: Tone }>} */
export const LOGIN_RESULT = {
	SUCCESS: { label: 'Erfolgreich', tone: 'green' },
	INVALID_CREDENTIALS: { label: 'Falsches Passwort', tone: 'error' },
	RATE_LIMITED: { label: 'Gesperrt (zu viele Versuche)', tone: 'error' },
	INVALID_CODE: { label: 'Falscher 2FA-Code', tone: 'error' },
	INVALID_BACKUP_CODE: { label: 'Falscher Backup-Code', tone: 'error' },
	EXPIRED_OR_MISSING_PENDING: { label: '2FA abgelaufen', tone: 'neutral' }
};

/** @type {Record<string, string>} */
export const NOTIFICATION_CATEGORY_LABELS = {
	RECURRING_INVOICE: 'Dauerrechnung',
	ERROR: 'Fehler',
	TAX_DEADLINE: 'Steuerfrist',
	PAYMENT_DUE: 'Zahlung fällig',
	OFFER: 'Angebot'
};

/**
 * Analytics-Ereignisse der Konta-App. Gruppen dienen den Filtern und der
 * Farbe in der Zeitleiste.
 *
 * @type {Record<string, { label: string, group: string }>}
 */
export const EVENT_CATALOG = {
	screen_view: { label: 'Seite aufgerufen', group: 'Navigation' },
	signup: { label: 'Registriert', group: 'Konto' },
	signin: { label: 'Angemeldet', group: 'Konto' },
	signout: { label: 'Abgemeldet', group: 'Konto' },
	email_verified: { label: 'E-Mail bestätigt', group: 'Konto' },
	verification_resent: { label: 'Bestätigungscode erneut gesendet', group: 'Konto' },
	two_factor_enabled: { label: '2FA aktiviert', group: 'Konto' },
	two_factor_disabled: { label: '2FA deaktiviert', group: 'Konto' },
	account_deleted: { label: 'Konto gelöscht', group: 'Konto' },
	account_reset: { label: 'Konto zurückgesetzt', group: 'Konto' },
	onboarding_step_completed: { label: 'Onboarding-Schritt erledigt', group: 'Onboarding' },
	onboarding_uid_lookup: { label: 'UID abgefragt', group: 'Onboarding' },
	onboarding_completed: { label: 'Onboarding abgeschlossen', group: 'Onboarding' },
	receipt_uploaded: { label: 'Beleg hochgeladen', group: 'Belege' },
	receipt_manual_created: { label: 'Beleg manuell erfasst', group: 'Belege' },
	receipt_confirmed: { label: 'Beleg bestätigt', group: 'Belege' },
	receipt_updated: { label: 'Beleg geändert', group: 'Belege' },
	receipt_deleted: { label: 'Beleg gelöscht', group: 'Belege' },
	receipt_skipped: { label: 'Beleg übersprungen', group: 'Belege' },
	receipt_rescanned: { label: 'Beleg neu erkannt', group: 'Belege' },
	receipt_contact_unlinked: { label: 'Kontakt vom Beleg getrennt', group: 'Belege' },
	extraction_completed: { label: 'Belegerkennung fertig', group: 'Belege' },
	extraction_failed: { label: 'Belegerkennung fehlgeschlagen', group: 'Belege' },
	contact_suggestion_resolved: { label: 'Kontaktvorschlag entschieden', group: 'Belege' },
	invoice_created: { label: 'Rechnung angelegt', group: 'Rechnungen' },
	invoice_updated: { label: 'Rechnung geändert', group: 'Rechnungen' },
	invoice_draft_deleted: { label: 'Rechnungsentwurf gelöscht', group: 'Rechnungen' },
	invoice_issued: { label: 'Rechnung ausgestellt', group: 'Rechnungen' },
	invoice_stornoed: { label: 'Rechnung storniert', group: 'Rechnungen' },
	invoice_payment_updated: { label: 'Zahlung erfasst', group: 'Rechnungen' },
	invoice_email_sent: { label: 'Rechnung per Mail versendet', group: 'Rechnungen' },
	invoice_pdf_downloaded: { label: 'Rechnungs-PDF geladen', group: 'Rechnungen' },
	invoice_einvoice_exported: { label: 'E-Rechnung exportiert', group: 'Rechnungen' },
	offer_created: { label: 'Angebot angelegt', group: 'Angebote' },
	offer_status_changed: { label: 'Angebotsstatus geändert', group: 'Angebote' },
	offer_email_sent: { label: 'Angebot per Mail versendet', group: 'Angebote' },
	offer_converted_to_invoice: { label: 'Angebot abgerechnet', group: 'Angebote' },
	dunning_created: { label: 'Mahnung angelegt', group: 'Mahnungen' },
	dunning_status_changed: { label: 'Mahnungsstatus geändert', group: 'Mahnungen' },
	dunning_email_sent: { label: 'Mahnung per Mail versendet', group: 'Mahnungen' },
	dunning_pdf_downloaded: { label: 'Mahnungs-PDF geladen', group: 'Mahnungen' },
	recurring_created: { label: 'Dauerrechnung angelegt', group: 'Dauerrechnungen' },
	recurring_updated: { label: 'Dauerrechnung geändert', group: 'Dauerrechnungen' },
	recurring_paused: { label: 'Dauerrechnung pausiert', group: 'Dauerrechnungen' },
	recurring_resumed: { label: 'Dauerrechnung fortgesetzt', group: 'Dauerrechnungen' },
	recurring_ended: { label: 'Dauerrechnung beendet', group: 'Dauerrechnungen' },
	recurring_deleted: { label: 'Dauerrechnung gelöscht', group: 'Dauerrechnungen' },
	recurring_run: { label: 'Dauerrechnung gelaufen', group: 'Dauerrechnungen' },
	recurring_run_failed: { label: 'Dauerrechnung fehlgeschlagen', group: 'Dauerrechnungen' },
	recurring_run_retried: { label: 'Dauerrechnung wiederholt', group: 'Dauerrechnungen' },
	asset_created: { label: 'Anlage angelegt', group: 'Anlagen' },
	asset_confirmed: { label: 'Anlage bestätigt', group: 'Anlagen' },
	asset_updated: { label: 'Anlage geändert', group: 'Anlagen' },
	asset_deleted: { label: 'Anlage gelöscht', group: 'Anlagen' },
	asset_classification_completed: { label: 'Anlage eingestuft', group: 'Anlagen' },
	vehicle_created: { label: 'Fahrzeug angelegt', group: 'Fahrtenbuch' },
	vehicle_archived: { label: 'Fahrzeug archiviert', group: 'Fahrtenbuch' },
	vehicle_restored: { label: 'Fahrzeug wiederhergestellt', group: 'Fahrtenbuch' },
	vehicle_deleted: { label: 'Fahrzeug gelöscht', group: 'Fahrtenbuch' },
	trip_created: { label: 'Fahrt erfasst', group: 'Fahrtenbuch' },
	trip_updated: { label: 'Fahrt geändert', group: 'Fahrtenbuch' },
	trip_deleted: { label: 'Fahrt gelöscht', group: 'Fahrtenbuch' },
	contact_created: { label: 'Kontakt angelegt', group: 'Stammdaten' },
	product_created: { label: 'Produkt angelegt', group: 'Stammdaten' },
	company_settings_updated: { label: 'Unternehmensdaten geändert', group: 'Einstellungen' },
	number_series_updated: { label: 'Nummernkreis geändert', group: 'Einstellungen' },
	smtp_test: { label: 'SMTP getestet', group: 'Einstellungen' },
	tax_export_downloaded: { label: 'Steuerexport geladen', group: 'Einstellungen' },
	support_opened: { label: 'Support geöffnet', group: 'Support' },
	support_submitted: { label: 'Supportanfrage gesendet', group: 'Support' }
};

/**
 * Die Ereignisse, die für Produktnutzung zählen (ohne Seitenaufrufe und
 * reine Kontoereignisse). Reihenfolge = Reihenfolge in der Auswertung.
 */
export const KEY_EVENTS = [
	'signup',
	'onboarding_completed',
	'receipt_uploaded',
	'receipt_confirmed',
	'invoice_issued',
	'invoice_email_sent',
	'offer_created',
	'contact_created',
	'recurring_created',
	'dunning_created',
	'asset_created',
	'trip_created',
	'tax_export_downloaded',
	'support_submitted'
];

/**
 * @param {string} name
 * @returns {string}
 */
export function eventLabel(name) {
	return EVENT_CATALOG[name]?.label ?? name.replaceAll('_', ' ');
}

/**
 * @param {string} name
 * @returns {string}
 */
export function eventGroup(name) {
	return EVENT_CATALOG[name]?.group ?? 'Sonstiges';
}

/**
 * @param {Record<string, string>} map
 * @param {string | null | undefined} value
 * @param {string} [fallback]
 * @returns {string}
 */
export function labelOf(map, value, fallback = '—') {
	if (value === null || value === undefined || value === '') return fallback;
	return map[value] ?? value;
}
