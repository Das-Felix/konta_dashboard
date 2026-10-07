import { redirect } from '@sveltejs/kit';

/** @type {import('./$types').LayoutServerLoad} */
export function load({ locals, url }) {
	// Der Hook leitet schon um; das hier ist die zweite Sicherung, falls eine
	// Route einmal aus PUBLIC_ROUTES herausfällt oder hineinrutscht.
	if (!locals.admin) redirect(303, `/login?redirectTo=${encodeURIComponent(url.pathname)}`);
	return { admin: { name: locals.admin.name, email: locals.admin.email } };
}
