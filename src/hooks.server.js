import { SESSION_COOKIE, readSessionToken } from '#lib/server/auth.js';

/** Routen, die ohne Anmeldung erreichbar sind. */
const PUBLIC_ROUTES = new Set(['/login']);

/**
 * @param {import('@sveltejs/kit').RequestEvent} event
 * @returns {Response}
 */
function unauthenticated(event) {
	if (event.request.method !== 'GET') {
		return new Response('Nicht angemeldet', { status: 401 });
	}
	// Als Response statt `redirect()`, damit die Header unten auch hier landen.
	const target = `${event.url.pathname}${event.url.search}`;
	return new Response(null, {
		status: 303,
		headers: { location: `/login?redirectTo=${encodeURIComponent(target)}` }
	});
}

/** @type {import('@sveltejs/kit/hooks').Handle} */
export async function handle({ event, resolve }) {
	event.locals.admin = readSessionToken(event.cookies.get(SESSION_COOKIE));

	const routeId = event.route.id;
	const isPublic = routeId !== null && PUBLIC_ROUTES.has(routeId);

	const response = !event.locals.admin && !isPublic ? unauthenticated(event) : await resolve(event);

	// Internes Werkzeug mit personenbezogenen Daten: nie indexieren, nie
	// einbetten, keine Referrer nach außen.
	response.headers.set('X-Robots-Tag', 'noindex, nofollow');
	response.headers.set('X-Frame-Options', 'DENY');
	response.headers.set('Referrer-Policy', 'no-referrer');
	response.headers.set('X-Content-Type-Options', 'nosniff');
	// Jede Antwort hängt an der Anmeldung, auch die Umleitung auf /login und das
	// Login-Formular. Ein Cache (Browser, CDN, Proxy) darf davon nichts
	// aufheben, sonst landet man nach dem Neuladen wieder auf /login.
	response.headers.set('Cache-Control', 'private, no-store');

	return response;
}
