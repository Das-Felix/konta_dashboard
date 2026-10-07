<script>
	import Badge from './Badge.svelte';
	import { PLAN_LABELS, subscriptionStatus } from '#lib/labels.js';

	/**
	 * @type {{ status?: string | null, plan?: string | null, showPlan?: boolean }}
	 */
	let { status, plan, showPlan = false } = $props();

	const info = $derived(subscriptionStatus(status));
</script>

<span class="inline-flex items-center gap-2">
	<Badge tone={info.tone}>{info.label}</Badge>
	{#if showPlan && plan}
		<span class="text-[12.5px] whitespace-nowrap text-ink-500">{PLAN_LABELS[plan] ?? plan}</span>
	{/if}
</span>
