import { redirect } from '@sveltejs/kit';
import { SESSION_COOKIE, readSessionToken } from '#lib/server/auth.js';

/** Routen, die ohne Anmeldung erreichbar sind. */
const PUBLIC_ROUTES = new Set(['/login']);

/** @type {import('@sveltejs/kit/hooks').Handle} */
export async function handle({ event, resolve }) {
	event.locals.admin = readSessionToken(event.cookies.get(SESSION_COOKIE));

	const routeId = event.route.id;
	const isPublic = routeId !== null && PUBLIC_ROUTES.has(routeId);

	if (!event.locals.admin && !isPublic) {
		if (event.request.method !== 'GET') {
			return new Response('Nicht angemeldet', { status: 401 });
		}
		const target = `${event.url.pathname}${event.url.search}`;
		redirect(303, `/login?redirectTo=${encodeURIComponent(target)}`);
	}

	const response = await resolve(event);

	// Internes Werkzeug mit personenbezogenen Daten: nie indexieren, nie
	// einbetten, keine Referrer nach außen.
	response.headers.set('X-Robots-Tag', 'noindex, nofollow');
	response.headers.set('X-Frame-Options', 'DENY');
	response.headers.set('Referrer-Policy', 'no-referrer');
	response.headers.set('X-Content-Type-Options', 'nosniff');
	if (event.locals.admin) response.headers.set('Cache-Control', 'private, no-store');

	return response;
}
