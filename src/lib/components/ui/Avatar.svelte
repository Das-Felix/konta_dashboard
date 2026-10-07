<script>
	import { initials } from '#lib/format.js';

	/**
	 * @type {{ firstName?: string | null, lastName?: string | null, size?: number, class?: string }}
	 */
	let { firstName, lastName, size = 36, class: className = '' } = $props();
</script>

<span
	class="inline-flex shrink-0 items-center justify-center rounded-full bg-ink font-semibold tracking-wide text-paper {className}"
	style="width: {size}px; height: {size}px; font-size: {Math.round(size * 0.34)}px"
	aria-hidden="true"
>
	{initials(firstName, lastName)}
</span>
