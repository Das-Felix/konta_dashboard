<script>
	/**
	 * Kennzahl-Kachel: Label, Wert, optional Veränderung gegenüber einer
	 * Vorperiode (Trend-Chip in `violet-200` nach App-Regel), Hinweiszeile und
	 * Sparkline. Mit `href` wird die ganze Kachel zum Link in die Unteransicht.
	 */
	import TrendingUp from '@lucide/svelte/icons/trending-up';
	import TrendingDown from '@lucide/svelte/icons/trending-down';
	import Sparkline from '../charts/Sparkline.svelte';
	import { CARD_CLASS } from './card.js';
	import { formatChange } from '#lib/format.js';

	/**
	 * @type {{
	 *   label: string,
	 *   value: string,
	 *   change?: number | null,
	 *   changeLabel?: string,
	 *   hint?: string,
	 *   tone?: 'default' | 'error',
	 *   series?: number[],
	 *   href?: string,
	 *   class?: string
	 * }}
	 */
	let {
		label,
		value,
		change = null,
		changeLabel = '',
		hint = '',
		tone = 'default',
		series,
		href,
		class: className = ''
	} = $props();

	const hasChange = $derived(change !== null && change !== undefined && Number.isFinite(change));
	const up = $derived(hasChange && /** @type {number} */ (change) >= 0);
</script>

{#snippet body()}
	<div class="flex items-start justify-between gap-3">
		<span class="text-label min-w-0 text-ink-500">{label}</span>
		{#if hasChange}
			<span
				class="tnum inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[12px] leading-none font-semibold {up
					? 'bg-violet-200 text-ink'
					: 'bg-ink-100 text-ink-700'}"
				title={changeLabel}
			>
				{#if up}<TrendingUp size={13} strokeWidth={2} />{:else}<TrendingDown
						size={13}
						strokeWidth={2}
					/>{/if}
				{formatChange(/** @type {number} */ (change))}
			</span>
		{/if}
	</div>
	<div class="flex items-end justify-between gap-3">
		<span
			class="text-[30px] leading-none font-semibold tracking-[-0.02em] break-words {tone === 'error'
				? 'text-error'
				: 'text-ink'}"
		>
			{value}
		</span>
		{#if series && series.length > 1}
			<Sparkline values={series} class="mb-0.5 shrink-0" label="Verlauf {label}" />
		{/if}
	</div>
	{#if hint || changeLabel}
		<span class="text-[13px] leading-snug text-ink-500">{hint || changeLabel}</span>
	{/if}
{/snippet}

{#if href}
	<!-- eslint-disable svelte/no-navigation-without-resolve -- Aufrufer übergibt resolve()-Pfad -->
	<a
		{href}
		class="{CARD_CLASS} focus-ring flex min-w-0 flex-col gap-3 px-5 py-5 transition-shadow duration-200 hover:shadow-hover {className}"
	>
		{@render body()}
	</a>
	<!-- eslint-enable svelte/no-navigation-without-resolve -->
{:else}
	<div class="{CARD_CLASS} flex min-w-0 flex-col gap-3 px-5 py-5 {className}">
		{@render body()}
	</div>
{/if}
