<script>
	/**
	 * Funnel: jede Stufe als Block aus Kopfzeile (Name, Anzahl, Anteil an der
	 * ersten Stufe) und zentriertem Band. Zwischen zwei Stufen verjüngt sich
	 * ein heller Übergang, darin die Quote vom Schritt davor. Die Quote ist
	 * die eigentliche Aussage, daher als Text und nicht nur als Breite.
	 */
	import { formatNumber, formatPercent } from '#lib/format.js';

	/**
	 * @type {{ steps: { key: string, label: string, value: number }[] }}
	 */
	let { steps } = $props();

	const MIN_WIDTH = 4;

	const first = $derived(Math.max(1, steps[0]?.value ?? 0));
	/** Breite jeder Stufe in Prozent der ersten. */
	const widths = $derived(
		steps.map((step) => Math.max(MIN_WIDTH, Math.min(100, (step.value / first) * 100)))
	);

	/**
	 * Trapez von der Breite einer Stufe auf die der nächsten.
	 * @param {number} index
	 */
	function connector(index) {
		const top = widths[index];
		const bottom = widths[index + 1];
		return `${50 - top / 2},0 ${50 + top / 2},0 ${50 + bottom / 2},1 ${50 - bottom / 2},1`;
	}
</script>

<ol class="m-0 grid list-none grid-cols-[minmax(0,5fr)_minmax(0,6fr)] gap-x-4 p-0">
	{#each steps as step, index (step.key)}
		{@const previous = index > 0 ? steps[index - 1].value : null}
		{@const last = index === steps.length - 1}
		{#if previous !== null}
			<!-- Übergang: links leer, rechts das Trapez mit der Quote. -->
			<li class="relative col-start-2 flex h-8 items-center justify-center" aria-hidden="true">
				<svg class="absolute inset-0 h-full w-full" viewBox="0 0 100 1" preserveAspectRatio="none">
					<polygon points={connector(index - 1)} class="fill-ink-100" />
				</svg>
				<span
					class="tnum relative rounded-full border border-ink/7 bg-white px-2 py-0.5 text-[12px] font-medium text-ink-700"
				>
					{previous > 0 ? formatPercent(step.value / previous) : '—'} weiter
				</span>
			</li>
		{/if}
		<li class="contents">
			<div class="flex min-w-0 flex-col justify-center">
				<span class="truncate text-[14px] text-ink" title={step.label}>
					<span class="tnum mr-1.5 text-ink-400">{index + 1}.</span>{step.label}
				</span>
				<span class="tnum text-[13px] text-ink-500">
					<span class="font-semibold text-ink">{formatNumber(step.value)}</span>
					· {formatPercent(step.value / first)}
					{#if previous !== null}
						<span class="sr-only">
							, {previous > 0 ? formatPercent(step.value / previous) : '—'} vom Schritt davor
						</span>
					{/if}
				</span>
			</div>
			<div class="flex h-11 items-center justify-center" aria-hidden="true">
				<div
					class="h-full rounded-sm {last ? 'bg-green' : 'bg-ink'}"
					style="width: {widths[index]}%"
				></div>
			</div>
		</li>
	{/each}
</ol>
