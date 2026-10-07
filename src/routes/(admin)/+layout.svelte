<script>
	import { navigating } from '$app/state';
	import Sidebar from '#lib/components/layout/Sidebar.svelte';

	/** @type {import('./$types').LayoutProps} */
	let { data, children } = $props();
</script>

<div class="min-h-dvh bg-paper md:flex">
	<Sidebar admin={data.admin} />
	<main class="min-w-0 flex-1">
		{#if navigating.to}
			<div
				class="fixed inset-x-0 top-0 z-50 h-0.5 animate-pulse bg-violet-700"
				aria-hidden="true"
			></div>
		{/if}
		<div class="mx-auto w-full max-w-[1280px] px-4 py-6 md:px-8 md:py-8">
			{@render children()}
		</div>
	</main>
</div>
