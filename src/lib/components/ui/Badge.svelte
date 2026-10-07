<script>
	/**
	 * @typedef {'green' | 'soft' | 'neutral' | 'ink' | 'error'} BadgeTone
	 * @typedef {'md' | 'sm'} BadgeSize
	 */

	/**
	 * `sm` ist der Status-Pill aus dem Styleguide: kein horizontaler Innen-
	 * abstand, weil er auf eine feste Breite gesetzt und zentriert wird.
	 *
	 * @type {{
	 *   tone?: BadgeTone,
	 *   size?: BadgeSize,
	 *   class?: string,
	 *   children?: import('svelte').Snippet
	 * }}
	 */
	let { tone = 'green', size = 'md', class: className = '', children } = $props();

	const sizeClass = $derived(
		size === 'sm' ? 'px-0 py-[7px] text-[12px]' : 'px-2.5 py-1.5 text-[12.5px]'
	);

	const toneClass = $derived(
		{
			green: 'bg-green text-ink',
			soft: 'bg-violet-200 text-ink',
			neutral: 'bg-ink-100 text-ink-700',
			ink: 'bg-ink text-green',
			error: 'bg-error-bg text-error'
		}[tone]
	);
</script>

<span
	class="inline-flex items-center gap-1.5 rounded-full leading-none font-semibold whitespace-nowrap {sizeClass} {toneClass} {className}"
>
	{#if children}{@render children()}{/if}
</span>
