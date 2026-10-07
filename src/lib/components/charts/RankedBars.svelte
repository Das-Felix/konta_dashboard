<script>
	/**
	 * Rangliste als waagrechte Balken (Kategorien, Seiten, Ereignisse). Eine
	 * Farbe, Wert und Anteil als Text daneben, damit nichts an der Farbe hängt.
	 */
	import { formatNumber, formatPercent } from '#lib/format.js';
	import { SERIES_COLORS } from './scale.js';

	/**
	 * @type {{
	 *   items: { key: string, label: string, value: number, href?: string, meta?: string }[],
	 *   color?: import('./scale.js').SeriesColor,
	 *   showShare?: boolean,
	 *   total?: number,
	 *   empty?: string
	 * }}
	 */
	let {
		items,
		color = 'violet',
		showShare = true,
		total,
		empty = 'Keine Daten im Zeitraum.'
	} = $props();

	const max = $derived(Math.max(1, ...items.map((item) => item.value)));
	const sum = $derived(total ?? items.reduce((acc, item) => acc + item.value, 0));
</script>

{#if items.length === 0}
	<p class="m-0 py-6 text-center text-[14px] text-ink-500">{empty}</p>
{:else}
	<ul class="m-0 flex list-none flex-col gap-3 p-0">
		{#each items as item (item.key)}
			<li class="flex flex-col gap-1.5">
				<div class="flex items-baseline justify-between gap-3 text-[14px]">
					{#if item.href}
						<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- Aufrufer übergibt resolve()-Pfade -->
						<a href={item.href} class="min-w-0 truncate text-ink hover:text-violet-700"
							>{item.label}</a
						>
					{:else}
						<span class="min-w-0 truncate text-ink">{item.label}</span>
					{/if}
					<span class="tnum shrink-0 text-ink-500">
						<span class="font-semibold text-ink">{formatNumber(item.value)}</span>
						{#if showShare && sum > 0}
							<span class="ml-1.5">{formatPercent(item.value / sum)}</span>
						{/if}
						{#if item.meta}<span class="ml-1.5">· {item.meta}</span>{/if}
					</span>
				</div>
				<div class="h-2 w-full rounded-full bg-ink-100" aria-hidden="true">
					<div
						class="h-2 rounded-full"
						style="width: {Math.max(1.5, (item.value / max) * 100)}%; background: {SERIES_COLORS[
							color
						]}"
					></div>
				</div>
			</li>
		{/each}
	</ul>
{/if}
