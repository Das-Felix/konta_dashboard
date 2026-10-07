<script>
	/**
	 * @typedef {'default' | 'outline' | 'soft' | 'brand' | 'mesh'} CardVariant
	 */

	/**
	 * @type {{
	 *   title?: string,
	 *   variant?: CardVariant,
	 *   padding?: string,
	 *   class?: string,
	 *   action?: import('svelte').Snippet,
	 *   children?: import('svelte').Snippet,
	 *   [key: string]: any
	 * }}
	 */
	let {
		title,
		variant = 'default',
		// Oben und unten etwas knapper als seitlich, wie die Karten im Styleguide.
		padding = '20px var(--space-5)',
		class: className = '',
		action,
		children,
		...rest
	} = $props();

	const variantClass = $derived(
		{
			default: 'border border-ink/7 bg-white shadow-card',
			// Flach, nur für Karten innerhalb einer Karte (z. B. InvoiceCard).
			outline: 'border border-ink-100 bg-white',
			soft: 'bg-violet-200',
			brand: 'bg-green',
			mesh: 'bg-mesh-soft'
		}[variant]
	);
</script>

<section
	class="rounded-lg text-ink {variantClass} {className}"
	style="padding: {padding};"
	{...rest}
>
	{#if title || action}
		<header class="mb-4 flex flex-wrap items-center justify-between gap-3">
			{#if title}
				<h3 class="m-0 text-[17px] leading-tight font-semibold">{title}</h3>
			{/if}
			{#if action}
				{@render action()}
			{/if}
		</header>
	{/if}
	{#if children}
		{@render children()}
	{/if}
</section>
