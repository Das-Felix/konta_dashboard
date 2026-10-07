<script>
	/**
	 * Segmented Control, dessen Zustand in der URL liegt (Zeitraum, Filter).
	 * Optik nach App-Regel: `bg-ink-100/70`-Spur, gewähltes Segment weiß mit
	 * `shadow-segment`.
	 */

	/**
	 * @type {{
	 *   label: string,
	 *   options: { value: string, label: string, href: string, count?: number }[],
	 *   value: string,
	 *   class?: string
	 * }}
	 */
	let { label, options, value, class: className = '' } = $props();
</script>

<nav aria-label={label} class="inline-flex max-w-full overflow-x-auto {className}">
	<div class="flex gap-0.5 rounded-md bg-ink-100/70 p-1">
		{#each options as option (option.value)}
			<!-- eslint-disable svelte/no-navigation-without-resolve -- Aufrufer übergibt resolve()-Pfade -->
			<a
				href={option.href}
				data-sveltekit-reset="false"
				aria-current={value === option.value ? 'page' : undefined}
				class="focus-ring inline-flex items-center gap-1.5 rounded-[7px] px-3 py-1.5 text-sm whitespace-nowrap transition-[background,color,box-shadow] duration-150 {value ===
				option.value
					? 'bg-white font-semibold text-ink shadow-segment'
					: 'font-medium text-ink-500 hover:text-ink'}"
			>
				{option.label}
				{#if option.count !== undefined}
					<span class="tnum text-[12px] font-medium text-ink-400">{option.count}</span>
				{/if}
			</a>
			<!-- eslint-enable svelte/no-navigation-without-resolve -->
		{/each}
	</div>
</nav>
