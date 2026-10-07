import { fail, redirect } from '@sveltejs/kit';
import { dev } from '$app/env';
import {
	SESSION_COOKIE,
	SESSION_MAX_AGE_SECONDS,
	canVerifyTwoFactor,
	clearAttempts,
	createPendingToken,
	createSessionToken,
	findAdminByEmail,
	findAdminById,
	isAdminEmail,
	readPendingToken,
	registerAttempt,
	verifyAdminPassword,
	verifyAdminTotp
} from '#lib/server/auth.js';

/**
 * Nur app-interne Ziele, nie eine fremde Domain.
 *
 * @param {string | null} value
 * @returns {string}
 */
function safeRedirect(value) {
	if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/login')) {
		return '/';
	}
	return value;
}

/** @type {import('./$types').PageServerLoad} */
export function load({ locals, url }) {
	if (locals.admin) redirect(303, safeRedirect(url.searchParams.get('redirectTo')));
	return {};
}

/**
 * @param {import('@sveltejs/kit').Cookies} cookies
 * @param {{ id: string, email: string, firstName: string, lastName: string }} admin
 */
function startSession(cookies, admin) {
	cookies.set(
		SESSION_COOKIE,
		createSessionToken({
			userId: admin.id,
			email: admin.email,
			name: `${admin.firstName} ${admin.lastName}`.trim()
		}),
		{
			path: '/',
			httpOnly: true,
			sameSite: 'strict',
			secure: !dev,
			maxAge: SESSION_MAX_AGE_SECONDS
		}
	);
}

const INVALID =
	'E-Mail oder Passwort stimmt nicht, oder das Konto hat keinen Zugang zum Dashboard.';

/** @type {import('./$types').Actions} */
export const actions = {
	login: async ({ request, cookies, getClientAddress, url }) => {
		const form = await request.formData();
		const email = String(form.get('email') ?? '').trim();
		const password = String(form.get('password') ?? '');

		if (!registerAttempt(getClientAddress())) {
			return fail(429, { email, error: 'Zu viele Versuche. Probier es in 15 Minuten wieder.' });
		}
		if (!email || !password) {
			return fail(400, { email, error: 'Bitte E-Mail und Passwort eingeben.' });
		}

		const candidate = isAdminEmail(email) ? await findAdminByEmail(email) : null;
		const ok = await verifyAdminPassword(candidate, password);
		if (!ok || !candidate) return fail(400, { email, error: INVALID });

		if (candidate.twoFactorEnabled) {
			if (!canVerifyTwoFactor()) {
				return fail(400, {
					email,
					error: 'Für dieses Konto ist 2FA aktiv, aber TWO_FACTOR_SECRET_KEY ist nicht gesetzt.'
				});
			}
			return { email, pending: createPendingToken(candidate.id) };
		}

		clearAttempts(getClientAddress());
		startSession(cookies, candidate);
		redirect(303, safeRedirect(url.searchParams.get('redirectTo')));
	},

	code: async ({ request, cookies, getClientAddress, url }) => {
		const form = await request.formData();
		const pending = String(form.get('pending') ?? '');
		const code = String(form.get('code') ?? '');
		const email = String(form.get('email') ?? '');

		if (!registerAttempt(getClientAddress())) {
			return fail(429, { email, error: 'Zu viele Versuche. Probier es in 15 Minuten wieder.' });
		}

		const userId = readPendingToken(pending);
		if (!userId)
			return fail(400, { email, error: 'Die Anmeldung ist abgelaufen. Bitte neu anmelden.' });

		const candidate = await findAdminById(userId);
		if (!candidate || !isAdminEmail(candidate.email)) {
			return fail(400, { email, error: INVALID });
		}
		if (!verifyAdminTotp(candidate, code)) {
			return fail(400, {
				email,
				pending,
				error: 'Der Code stimmt nicht. Nimm den aktuellen aus deiner App.'
			});
		}

		clearAttempts(getClientAddress());
		startSession(cookies, candidate);
		redirect(303, safeRedirect(url.searchParams.get('redirectTo')));
	}
};
