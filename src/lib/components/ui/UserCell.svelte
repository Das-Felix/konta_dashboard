<script>
	/**
	 * Name, E-Mail oder Unternehmen eines Nutzers mit Link zur Detailansicht.
	 */
	import { resolve } from '$app/paths';
	import Avatar from './Avatar.svelte';

	/**
	 * @type {{
	 *   id: string,
	 *   firstName?: string | null,
	 *   lastName?: string | null,
	 *   secondary?: string | null,
	 *   avatar?: boolean
	 * }}
	 */
	let { id, firstName, lastName, secondary, avatar = true } = $props();

	const name = $derived([firstName, lastName].filter(Boolean).join(' ') || 'Ohne Namen');
</script>

<a
	href={resolve('/(admin)/nutzer/[id]', { id })}
	class="group flex min-w-0 items-center gap-3 rounded-md text-left focus-visible:shadow-[var(--focus-ring)] focus-visible:outline-none"
>
	{#if avatar}<Avatar {firstName} {lastName} size={32} />{/if}
	<span class="min-w-0">
		<span class="block truncate text-[14px] font-semibold text-ink group-hover:text-violet-700"
			>{name}</span
		>
		{#if secondary}<span class="block truncate text-[12.5px] text-ink-500">{secondary}</span>{/if}
	</span>
</a>
