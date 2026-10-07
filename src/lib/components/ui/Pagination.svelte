<script>
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import { formatNumber } from '#lib/format.js';

	/**
	 * @type {{
	 *   page: number,
	 *   pageSize: number,
	 *   total: number,
	 *   hrefFor: (page: number) => string
	 * }}
	 */
	let { page, pageSize, total, hrefFor } = $props();

	const pages = $derived(Math.max(1, Math.ceil(total / pageSize)));
	const from = $derived(total === 0 ? 0 : (page - 1) * pageSize + 1);
	const to = $derived(Math.min(total, page * pageSize));

	const linkClass =
		'focus-ring inline-flex size-9 items-center justify-center rounded-md text-ink transition-colors hover:bg-violet-50';
</script>

<div class="flex items-center justify-between gap-3 px-1 pt-4 text-[13.5px] text-ink-500">
	<span class="tnum">{formatNumber(from)} bis {formatNumber(to)} von {formatNumber(total)}</span>
	<div class="flex items-center gap-1">
		{#if page > 1}
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- hrefFor liefert resolve()-Pfade -->
			<a href={hrefFor(page - 1)} class={linkClass} aria-label="Vorherige Seite">
				<ChevronLeft size={18} strokeWidth={1.75} />
			</a>
		{:else}
			<span class="{linkClass} pointer-events-none text-ink-300" aria-hidden="true">
				<ChevronLeft size={18} strokeWidth={1.75} />
			</span>
		{/if}
		<span class="tnum px-2">Seite {page} von {pages}</span>
		{#if page < pages}
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- hrefFor liefert resolve()-Pfade -->
			<a href={hrefFor(page + 1)} class={linkClass} aria-label="Nächste Seite">
				<ChevronRight size={18} strokeWidth={1.75} />
			</a>
		{:else}
			<span class="{linkClass} pointer-events-none text-ink-300" aria-hidden="true">
				<ChevronRight size={18} strokeWidth={1.75} />
			</span>
		{/if}
	</div>
</div>
