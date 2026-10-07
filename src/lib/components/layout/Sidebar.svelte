<script>
	/**
	 * Seitenleiste wie in der Konta-App: weiß, 230 px, aktiver Eintrag
	 * `violet-200`. Auf kleinen Bildschirmen als ausklappbares Panel.
	 */
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import LayoutDashboard from '@lucide/svelte/icons/layout-dashboard';
	import Users from '@lucide/svelte/icons/users';
	import TrendingUp from '@lucide/svelte/icons/trending-up';
	import CreditCard from '@lucide/svelte/icons/credit-card';
	import Activity from '@lucide/svelte/icons/activity';
	import ScrollText from '@lucide/svelte/icons/scroll-text';
	import ChartLine from '@lucide/svelte/icons/chart-line';
	import LogOut from '@lucide/svelte/icons/log-out';
	import Menu from '@lucide/svelte/icons/menu';
	import X from '@lucide/svelte/icons/x';
	import wordmark from '#lib/assets/konta-wordmark.svg';
	import Avatar from '../ui/Avatar.svelte';

	/**
	 * @type {{ admin: { name: string, email: string } }}
	 */
	let { admin } = $props();

	const items = [
		{ label: 'Übersicht', href: resolve('/(admin)'), icon: LayoutDashboard, exact: true },
		{ label: 'Nutzer', href: resolve('/(admin)/nutzer'), icon: Users },
		{ label: 'Wachstum', href: resolve('/(admin)/wachstum'), icon: TrendingUp },
		{ label: 'Abos', href: resolve('/(admin)/abos'), icon: CreditCard },
		{ label: 'Nutzung', href: resolve('/(admin)/nutzung'), icon: Activity },
		{ label: 'Änderungsprotokoll', href: resolve('/(admin)/aktivitaet'), icon: ScrollText },
		{ label: 'Analytics', href: resolve('/(admin)/analytics'), icon: ChartLine }
	];

	let open = $state(false);

	/**
	 * @param {{ href: string, exact?: boolean }} item
	 */
	function isActive(item) {
		const path = page.url.pathname;
		return item.exact ? path === item.href : path === item.href || path.startsWith(`${item.href}/`);
	}

	// Nach jeder Navigation schließen.
	$effect(() => {
		void page.url.pathname;
		open = false;
	});
</script>

<!-- Mobile Kopfzeile -->
<div
	class="sticky top-0 z-30 flex items-center justify-between border-b border-ink-100 bg-white px-4 py-3 md:hidden"
>
	<a href={resolve('/(admin)')} aria-label="Konta Admin Übersicht" class="flex items-center gap-2">
		<img src={wordmark} alt="Konta" class="h-5 w-auto" />
		<span class="text-label rounded-full bg-ink-100 px-2 py-1 text-ink-700">Admin</span>
	</a>
	<button
		type="button"
		class="focus-ring inline-flex size-10 items-center justify-center rounded-md text-ink hover:bg-violet-50"
		aria-label={open ? 'Menü schließen' : 'Menü öffnen'}
		aria-expanded={open}
		onclick={() => (open = !open)}
	>
		{#if open}<X size={20} strokeWidth={1.75} />{:else}<Menu size={20} strokeWidth={1.75} />{/if}
	</button>
</div>

<aside
	class="fixed inset-y-0 left-0 z-40 flex w-[230px] flex-col border-r border-ink-100 bg-white transition-transform duration-300 ease-out md:sticky md:top-0 md:h-dvh md:translate-x-0 {open
		? 'translate-x-0 shadow-dropdown'
		: '-translate-x-full'}"
>
	<div class="flex items-center gap-2 px-6 pt-6">
		<a href={resolve('/(admin)')} aria-label="Konta Admin Übersicht" class="block">
			<img src={wordmark} alt="Konta" class="h-5 w-auto" />
		</a>
		<span class="text-label rounded-full bg-ink-100 px-2 py-1 text-ink-700">Admin</span>
	</div>

	<nav class="flex-1 overflow-y-auto px-3 pt-[30px]" aria-label="Hauptnavigation">
		{#each items as item (item.href)}
			{@const active = isActive(item)}
			<a
				href={item.href}
				class="flex items-center gap-2.5 rounded-md px-3 py-2.5 text-sm transition-colors {active
					? 'bg-violet-200 font-semibold text-ink'
					: 'font-medium text-ink-700 hover:bg-violet-50 hover:text-ink'}"
				aria-current={active ? 'page' : undefined}
			>
				<item.icon size={18} strokeWidth={1.75} class="shrink-0" />
				{item.label}
			</a>
		{/each}
	</nav>

	<div class="flex items-center gap-2.5 border-t border-ink-100 px-4 py-4">
		<Avatar
			firstName={admin.name.split(' ')[0]}
			lastName={admin.name.split(' ').slice(1).join(' ')}
		/>
		<div class="min-w-0 flex-1">
			<p class="m-0 truncate text-[13.5px] font-semibold text-ink">{admin.name}</p>
			<p class="m-0 truncate text-[12px] text-ink-500">{admin.email}</p>
		</div>
		<form method="POST" action={resolve('/logout')}>
			<button
				type="submit"
				class="focus-ring inline-flex size-8 items-center justify-center rounded-md text-ink-500 hover:bg-violet-50 hover:text-ink"
				aria-label="Abmelden"
				title="Abmelden"
			>
				<LogOut size={17} strokeWidth={1.75} />
			</button>
		</form>
	</div>
</aside>

{#if open}
	<button
		type="button"
		class="fixed inset-0 z-30 bg-ink/20 md:hidden"
		aria-label="Menü schließen"
		onclick={() => (open = false)}
	></button>
{/if}
