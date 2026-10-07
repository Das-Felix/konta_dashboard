<script>
	import Copy from '@lucide/svelte/icons/copy';
	import Check from '@lucide/svelte/icons/check';

	/** @type {{ value: string, label: string }} */
	let { value, label } = $props();

	let copied = $state(false);

	async function copy() {
		try {
			await navigator.clipboard.writeText(value);
			copied = true;
			setTimeout(() => (copied = false), 1500);
		} catch {
			copied = false;
		}
	}
</script>

<button
	type="button"
	class="focus-ring inline-flex size-7 items-center justify-center rounded-md text-ink-400 transition-colors hover:bg-violet-50 hover:text-ink"
	aria-label={copied ? 'Kopiert' : label}
	title={copied ? 'Kopiert' : label}
	onclick={copy}
>
	{#if copied}<Check size={15} strokeWidth={2} />{:else}<Copy size={15} strokeWidth={1.75} />{/if}
</button>
