/**
 * Kleine Helfer für Achsen. Keine Diagrammbibliothek: die Diagramme hier sind
 * einfach genug, und so folgen sie den Konta-Tokens ohne Umwege.
 */

/**
 * Runde Obergrenze und Ticks für eine Achse ab 0 (z. B. 0 / 20 / 40 / 60).
 *
 * @param {number} max
 * @param {number} [count] gewünschte Anzahl Intervalle
 * @returns {{ max: number, ticks: number[] }}
 */
export function niceTicks(max, count = 4) {
	if (!Number.isFinite(max) || max <= 0) return { max: 1, ticks: [0, 1] };
	const rough = max / count;
	const magnitude = 10 ** Math.floor(Math.log10(rough));
	const residual = rough / magnitude;
	const step = (residual > 5 ? 10 : residual > 2 ? 5 : residual > 1 ? 2 : 1) * magnitude;
	const niceMax = Math.ceil(max / step) * step;
	const ticks = [];
	for (let value = 0; value <= niceMax + step / 2; value += step)
		ticks.push(Math.round(value * 1e6) / 1e6);
	return { max: niceMax, ticks };
}

/**
 * Indizes, an denen eine X-Beschriftung steht: höchstens `max` Stück,
 * gleichmäßig verteilt, der letzte Punkt immer dabei.
 *
 * @param {number} length
 * @param {number} max
 * @returns {Set<number>}
 */
export function labelIndices(length, max) {
	const result = new Set();
	if (length === 0) return result;
	const step = Math.max(1, Math.ceil(length / max));
	for (let index = length - 1; index >= 0; index -= step) result.add(index);
	return result;
}

/** Farben der Diagramm-Reihen (Styleguide 3.5) als CSS-Variablen. */
export const SERIES_COLORS = {
	ink: 'var(--ink)',
	violet: 'var(--violet-700)',
	green: 'var(--green)',
	gray: 'var(--ink-400)',
	light: 'var(--ink-200)'
};

/** @typedef {keyof typeof SERIES_COLORS} SeriesColor */
