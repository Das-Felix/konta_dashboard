import { redirect } from '@sveltejs/kit';
import { SESSION_COOKIE, revokeSessionToken } from '#lib/server/auth.js';

/** @type {import('./$types').RequestHandler} */
export function POST({ cookies }) {
	revokeSessionToken(cookies.get(SESSION_COOKIE));
	cookies.delete(SESSION_COOKIE, { path: '/' });
	redirect(303, '/login');
}
