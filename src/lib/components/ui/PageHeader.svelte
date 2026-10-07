<script>
	/**
	 * Kopf einer Seite: Eyebrow, Titel, Untertitel, rechts Aktionen.
	 *
	 * @type {{
	 *   title: string,
	 *   eyebrow?: string,
	 *   description?: string,
	 *   actions?: import('svelte').Snippet
	 * }}
	 */
	let { title, eyebrow, description, actions } = $props();
</script>

<header class="mb-6 flex flex-wrap items-end justify-between gap-4">
	<div class="min-w-0">
		{#if eyebrow}<p class="text-label m-0 mb-2 text-ink-500">{eyebrow}</p>{/if}
		<h1 class="text-[28px] md:text-[34px]">{title}</h1>
		{#if description}
			<p class="m-0 mt-2 max-w-[62ch] text-[15px] text-ink-500">{description}</p>
		{/if}
	</div>
	{#if actions}
		<div class="flex flex-wrap items-center gap-2">{@render actions()}</div>
	{/if}
</header>
