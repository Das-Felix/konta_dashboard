<script>
	/**
	 * Anteile als ein waagrechter Balken mit 2 px Luft zwischen den Segmenten
	 * und einer Legende mit Wert und Anteil (Identität nie nur über Farbe).
	 */
	import { formatNumber, formatPercent } from '#lib/format.js';

	/**
	 * @type {{
	 *   segments: { key: string, label: string, value: number, color: string, href?: string }[],
	 *   label: string
	 * }}
	 */
	let { segments, label } = $props();

	const visible = $derived(segments.filter((segment) => segment.value > 0));
	const total = $derived(visible.reduce((sum, segment) => sum + segment.value, 0));
</script>

<div>
	<div
		class="flex h-3.5 w-full gap-[2px] overflow-hidden rounded-full bg-ink-100"
		role="img"
		aria-label="{label}: {visible
			.map((segment) => `${segment.label} ${formatNumber(segment.value)}`)
			.join(', ')}"
	>
		{#each visible as segment (segment.key)}
			<div
				class="h-full first:rounded-l-full last:rounded-r-full"
				style="flex: {segment.value} 1 0; background: {segment.color}"
				title="{segment.label}: {formatNumber(segment.value)}"
			></div>
		{/each}
	</div>
	<ul class="m-0 mt-4 grid list-none grid-cols-1 gap-x-6 gap-y-2.5 p-0 text-[14px] sm:grid-cols-2">
		{#each segments as segment (segment.key)}
			<li class="flex items-center justify-between gap-3">
				<span class="flex min-w-0 items-center gap-2">
					<span
						class="inline-block size-2.5 shrink-0 rounded-full"
						style="background: {segment.color}"
						aria-hidden="true"
					></span>
					{#if segment.href}
						<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- Aufrufer übergibt resolve()-Pfade -->
						<a href={segment.href} class="truncate text-ink hover:text-violet-700"
							>{segment.label}</a
						>
					{:else}
						<span class="truncate text-ink">{segment.label}</span>
					{/if}
				</span>
				<span class="tnum shrink-0 text-ink-500">
					<span class="font-semibold text-ink">{formatNumber(segment.value)}</span>
					<span class="ml-1">{total > 0 ? formatPercent(segment.value / total) : '—'}</span>
				</span>
			</li>
		{/each}
	</ul>
</div>
