/**
 * Tarifpreise in Cent, netto. Spiegelt `PLANS` aus
 * `konta_app/src/lib/billing/plans.js`; bei Preisänderungen dort hier
 * nachziehen.
 */

/** @type {Record<string, { monthly: number, yearly: number }>} */
export const PLAN_PRICES = {
	START: { monthly: 1500, yearly: 14400 },
	KOMPLETT: { monthly: 2300, yearly: 22800 }
};

/**
 * Monatlich wiederkehrender Umsatz eines Abos in Euro, netto. Jahresabos
 * zählen mit einem Zwölftel.
 *
 * @param {string | null | undefined} plan
 * @param {string | null | undefined} interval
 * @returns {number}
 */
export function monthlyRevenue(plan, interval) {
	const prices = plan ? PLAN_PRICES[plan] : undefined;
	if (!prices) return 0;
	const cents = interval === 'YEARLY' ? prices.yearly / 12 : prices.monthly;
	return cents / 100;
}
