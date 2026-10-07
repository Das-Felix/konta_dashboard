<script>
	/**
	 * Trichter: jede Stufe als Balken relativ zur ersten, daneben die
	 * Übergangsquote zur vorherigen Stufe. Die Quote ist die eigentliche
	 * Aussage, daher als Text und nicht nur als Länge.
	 */
	import { formatNumber, formatPercent } from '#lib/format.js';

	/**
	 * @type {{ steps: { key: string, label: string, value: number }[] }}
	 */
	let { steps } = $props();

	const first = $derived(Math.max(1, steps[0]?.value ?? 0));
</script>

<ol class="m-0 flex list-none flex-col gap-4 p-0">
	{#each steps as step, index (step.key)}
		{@const previous = index > 0 ? steps[index - 1].value : null}
		<li class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5">
			<span class="text-[14px] text-ink">
				<span class="tnum mr-1.5 text-ink-400">{index + 1}.</span>{step.label}
			</span>
			<span class="tnum text-right text-[14px]">
				<span class="font-semibold text-ink">{formatNumber(step.value)}</span>
				<span class="ml-1.5 text-ink-500">{formatPercent(step.value / first)}</span>
			</span>
			<div class="col-span-2 h-3 rounded-full bg-ink-100" aria-hidden="true">
				<div
					class="h-3 rounded-full {index === steps.length - 1 ? 'bg-green' : 'bg-ink'}"
					style="width: {Math.max(1.5, (step.value / first) * 100)}%"
				></div>
			</div>
			<span class="tnum col-span-2 text-[12.5px] text-ink-500">
				{#if previous !== null}
					{previous > 0 ? formatPercent(step.value / previous) : '—'} vom Schritt davor
				{:else}
					Basis
				{/if}
			</span>
		</li>
	{/each}
</ol>
