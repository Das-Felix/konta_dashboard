<script>
	/**
	 * Hinweisbox (Styleguide 8.3): `violet-200` für Hinweise, `error-bg` für
	 * Fehler.
	 */
	import Info from '@lucide/svelte/icons/info';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';

	/**
	 * @type {{
	 *   tone?: 'info' | 'error',
	 *   title?: string,
	 *   class?: string,
	 *   children?: import('svelte').Snippet
	 * }}
	 */
	let { tone = 'info', title, class: className = '', children } = $props();
</script>

<div
	class="flex items-start gap-3 rounded-lg px-4 py-3.5 text-[14px] leading-relaxed {tone === 'error'
		? 'bg-error-bg text-error'
		: 'bg-violet-200 text-ink'} {className}"
	role={tone === 'error' ? 'alert' : 'note'}
>
	{#if tone === 'error'}
		<CircleAlert size={18} strokeWidth={1.75} class="mt-0.5 shrink-0" />
	{:else}
		<Info size={18} strokeWidth={1.75} class="mt-0.5 shrink-0" />
	{/if}
	<div class="min-w-0">
		{#if title}<p class="m-0 font-semibold">{title}</p>{/if}
		{#if children}<div class={tone === 'error' ? 'text-error' : 'text-ink-700'}>
				{@render children()}
			</div>{/if}
	</div>
</div>
