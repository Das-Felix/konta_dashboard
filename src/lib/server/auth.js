/**
 * Anmeldung am Dashboard.
 *
 * Es gibt keine eigene Benutzerverwaltung: Admins melden sich mit ihrem
 * Konta-Konto an, sofern dessen E-Mail in `ADMIN_EMAILS` steht. Passwort-Hash
 * (Argon2id) und 2FA-Secret kommen aus der Konta-Datenbank, damit gelten
 * dieselben Zugangsdaten und dieselbe 2FA wie in der App.
 *
 * Die Session ist ein HMAC-signiertes Cookie ohne Serverzustand. Bei jedem
 * Request wird die Allowlist erneut geprüft: wer aus `ADMIN_EMAILS` fliegt,
 * ist sofort draußen.
 */

import {
	createDecipheriv,
	createHash,
	createHmac,
	randomBytes,
	timingSafeEqual
} from 'node:crypto';
import { hash as argon2Hash, verify as argon2Verify } from '@node-rs/argon2';
import * as OTPAuth from 'otpauth';
import { ADMIN_EMAILS, SESSION_SECRET, TWO_FACTOR_SECRET_KEY } from '$app/env/private';
import { queryOne } from '#lib/server/db.js';

export const SESSION_COOKIE = 'konta_admin';
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;
const PENDING_MAX_AGE_SECONDS = 60 * 5;

/**
 * Unbekannte E-Mails laufen gegen diesen Hash (zufälliges Passwort, gleiche
 * Parameter wie die App), damit die Antwortzeit nicht verrät, ob ein Konto
 * existiert.
 *
 * @type {Promise<string> | undefined}
 */
let dummyHash;

/** @returns {Promise<string>} */
function getDummyHash() {
	// Argon2id (2), Parameter wie `konta_app/src/lib/server/auth.js`.
	dummyHash ??= argon2Hash(randomBytes(16).toString('hex'), {
		algorithm: 2,
		memoryCost: 19456,
		timeCost: 2,
		parallelism: 1
	});
	return dummyHash;
}

/**
 * @typedef {Object} AdminSession
 * @property {string} userId
 * @property {string} email
 * @property {string} name
 * @property {number} exp Ablauf in Sekunden seit Epoch.
 */

/**
 * @typedef {Object} AdminCandidate
 * @property {string} id
 * @property {string} email
 * @property {string} firstName
 * @property {string} lastName
 * @property {string} passwordHash
 * @property {boolean} twoFactorEnabled
 * @property {string | null} twoFactorSecret
 */

/**
 * @param {string} payload
 * @returns {string}
 */
function sign(payload) {
	return createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
}

/**
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
function safeEqual(a, b) {
	const left = Buffer.from(a);
	const right = Buffer.from(b);
	return left.length === right.length && timingSafeEqual(left, right);
}

/**
 * @param {Record<string, unknown>} data
 * @returns {string}
 */
function seal(data) {
	const payload = Buffer.from(JSON.stringify(data)).toString('base64url');
	return `${payload}.${sign(payload)}`;
}

/**
 * @param {string | undefined} token
 * @returns {Record<string, any> | null}
 */
function unseal(token) {
	if (!token) return null;
	const [payload, signature] = token.split('.');
	if (!payload || !signature || !safeEqual(signature, sign(payload))) return null;
	try {
		const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
		if (typeof data?.exp !== 'number' || data.exp * 1000 < Date.now()) return null;
		return data;
	} catch {
		return null;
	}
}

/**
 * @param {string} email
 * @returns {boolean}
 */
export function isAdminEmail(email) {
	return ADMIN_EMAILS.includes(email.trim().toLowerCase());
}

/**
 * @param {{ userId: string, email: string, name: string }} admin
 * @returns {string}
 */
export function createSessionToken({ userId, email, name }) {
	const exp = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS;
	return seal({ kind: 'session', userId, email, name, exp });
}

/**
 * @param {string | undefined} token
 * @returns {AdminSession | null}
 */
export function readSessionToken(token) {
	const data = unseal(token);
	if (!data || data.kind !== 'session' || !isAdminEmail(String(data.email ?? ''))) return null;
	return { userId: data.userId, email: data.email, name: data.name, exp: data.exp };
}

/**
 * Kurzlebiger Nachweis "Passwort war richtig", der den 2FA-Schritt trägt,
 * ohne das Passwort ein zweites Mal durch das Formular zu schicken.
 *
 * @param {string} userId
 * @returns {string}
 */
export function createPendingToken(userId) {
	const exp = Math.floor(Date.now() / 1000) + PENDING_MAX_AGE_SECONDS;
	return seal({ kind: 'pending', userId, exp });
}

/**
 * @param {string | undefined} token
 * @returns {string | null} userId
 */
export function readPendingToken(token) {
	const data = unseal(token);
	return data?.kind === 'pending' && typeof data.userId === 'string' ? data.userId : null;
}

/**
 * @param {string} email
 * @returns {Promise<AdminCandidate | null>}
 */
export function findAdminByEmail(email) {
	return queryOne(
		`SELECT id, email, "firstName", "lastName", "passwordHash", "twoFactorEnabled", "twoFactorSecret"
		 FROM users WHERE lower(email) = lower($1)`,
		[email.trim()]
	);
}

/**
 * @param {string} id
 * @returns {Promise<AdminCandidate | null>}
 */
export function findAdminById(id) {
	return queryOne(
		`SELECT id, email, "firstName", "lastName", "passwordHash", "twoFactorEnabled", "twoFactorSecret"
		 FROM users WHERE id = $1`,
		[id]
	);
}

/**
 * Prüft das Passwort gegen den Argon2id-Hash aus der App. Läuft für unbekannte
 * Konten gegen einen Dummy-Hash, damit beide Fälle gleich lange dauern.
 *
 * @param {AdminCandidate | null} candidate
 * @param {string} password
 * @returns {Promise<boolean>}
 */
export async function verifyAdminPassword(candidate, password) {
	const hash = candidate?.passwordHash ?? (await getDummyHash());
	const ok = await argon2Verify(hash, password).catch(() => false);
	return Boolean(candidate) && ok;
}

/**
 * Entschlüsselt das TOTP-Secret wie `konta_app/src/lib/server/auth/totp-secret.js`
 * (AES-256-GCM, Schlüssel = SHA-256 des Key-Materials).
 *
 * @param {string} encoded
 * @returns {string}
 */
export function decryptTotpSecret(encoded) {
	if (!TWO_FACTOR_SECRET_KEY) throw new Error('TWO_FACTOR_SECRET_KEY fehlt.');
	const key = createHash('sha256').update(TWO_FACTOR_SECRET_KEY).digest();
	const buffer = Buffer.from(encoded, 'base64');
	const iv = buffer.subarray(0, 12);
	const tag = buffer.subarray(12, 28);
	const data = buffer.subarray(28);
	const decipher = createDecipheriv('aes-256-gcm', key, iv);
	decipher.setAuthTag(tag);
	return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

/** @returns {boolean} */
export function canVerifyTwoFactor() {
	return Boolean(TWO_FACTOR_SECRET_KEY);
}

/**
 * @param {AdminCandidate} candidate
 * @param {string} code
 * @returns {boolean}
 */
export function verifyAdminTotp(candidate, code) {
	const normalized = String(code ?? '').replace(/\s+/g, '');
	if (!/^\d{6}$/.test(normalized) || !candidate.twoFactorSecret) return false;
	try {
		const secret = decryptTotpSecret(candidate.twoFactorSecret);
		const delta = OTPAuth.TOTP.validate({
			token: normalized,
			secret: OTPAuth.Secret.fromBase32(secret),
			algorithm: 'SHA1',
			digits: 6,
			period: 30,
			window: 1
		});
		return delta !== null;
	} catch (error) {
		console.error('[auth] totp verification failed', error);
		return false;
	}
}

/** @type {Map<string, { count: number, resetAt: number }>} */
const attempts = new Map();
const ATTEMPT_LIMIT = 10;
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;

/**
 * Einfache Drosselung pro IP, im Speicher des Prozesses. Reicht für ein
 * internes Werkzeug mit einer Instanz.
 *
 * @param {string} key
 * @returns {boolean} `true`, wenn der Versuch erlaubt ist.
 */
export function registerAttempt(key) {
	const now = Date.now();
	const entry = attempts.get(key);
	if (!entry || entry.resetAt < now) {
		attempts.set(key, { count: 1, resetAt: now + ATTEMPT_WINDOW_MS });
		return true;
	}
	entry.count += 1;
	return entry.count <= ATTEMPT_LIMIT;
}

/**
 * @param {string} key
 */
export function clearAttempts(key) {
	attempts.delete(key);
}
