import { createCipheriv, createHash, randomBytes } from 'node:crypto';
import * as OTPAuth from 'otpauth';
import { describe, expect, it } from 'vitest';
import {
	createPendingToken,
	createSessionToken,
	decryptTotpSecret,
	isAdminEmail,
	readPendingToken,
	readSessionToken,
	registerAttempt,
	revokeSessionToken,
	verifyAdminTotp
} from './auth.js';
import { ADMIN_EMAILS, TWO_FACTOR_SECRET_KEY } from '$app/env/private';

/**
 * Verschlüsselt wie `konta_app/src/lib/server/auth/totp-secret.js`.
 * @param {string} plaintext
 */
function encryptLikeApp(plaintext) {
	const key = createHash('sha256').update(String(TWO_FACTOR_SECRET_KEY)).digest();
	const iv = randomBytes(12);
	const cipher = createCipheriv('aes-256-gcm', key, iv);
	const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
	return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64');
}

describe('auth', () => {
	const admin = ADMIN_EMAILS[0];

	it('prüft die Allowlist ohne Groß/Kleinschreibung', () => {
		expect(isAdminEmail(admin.toUpperCase())).toBe(true);
		expect(isAdminEmail('jemand@beispiel.at')).toBe(false);
	});

	it('hält Sessions im Prozess und verwirft sie einzeln', () => {
		const first = createSessionToken({ userId: 'u1', email: admin, name: 'Admin' });
		const second = createSessionToken({ userId: 'u1', email: admin, name: 'Admin' });
		expect(readSessionToken(first)?.userId).toBe('u1');
		expect(readSessionToken('fremd')).toBeNull();
		expect(readSessionToken(undefined)).toBeNull();
		revokeSessionToken(first);
		expect(readSessionToken(first)).toBeNull();
		expect(readSessionToken(second)?.name).toBe('Admin');
		revokeSessionToken(second);
	});

	it('trennt Pending- und Session-Token', () => {
		const pending = createPendingToken('u1');
		expect(readPendingToken(pending)).toBe('u1');
		expect(readSessionToken(pending)).toBeNull();
	});

	it('verifiziert TOTP mit dem verschlüsselten Secret der App', () => {
		const secret = new OTPAuth.Secret({ size: 20 }).base32;
		const encrypted = encryptLikeApp(secret);
		expect(decryptTotpSecret(encrypted)).toBe(secret);
		const code = new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(secret) }).generate();
		/** @type {any} */
		const candidate = { twoFactorSecret: encrypted };
		expect(verifyAdminTotp(candidate, code)).toBe(true);
		expect(verifyAdminTotp(candidate, '000000') && code !== '000000').toBe(false);
		expect(verifyAdminTotp(candidate, 'abc')).toBe(false);
	});

	it('drosselt nach zehn Versuchen', () => {
		const key = `test-${Math.random()}`;
		const results = Array.from({ length: 11 }, () => registerAttempt(key));
		expect(results.slice(0, 10).every(Boolean)).toBe(true);
		expect(results[10]).toBe(false);
	});
});
