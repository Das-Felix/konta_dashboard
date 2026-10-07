<script>
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import Search from '@lucide/svelte/icons/search';
	import ShieldCheck from '@lucide/svelte/icons/shield-check';
	import PageHeader from '#lib/components/ui/PageHeader.svelte';
	import SegmentedLinks from '#lib/components/ui/SegmentedLinks.svelte';
	import UserCell from '#lib/components/ui/UserCell.svelte';
	import SubscriptionBadge from '#lib/components/ui/SubscriptionBadge.svelte';
	import Badge from '#lib/components/ui/Badge.svelte';
	import Pagination from '#lib/components/ui/Pagination.svelte';
	import { CARD_CLASS } from '#lib/components/ui/card.js';
	import { formatDateShort, formatNumber, formatRelative } from '#lib/format.js';
	import { ONBOARDING_STEP_LABELS, VAT_MODE_LABELS, labelOf } from '#lib/labels.js';

	/** @type {import('./$types').PageProps} */
	let { data } = $props();

	/**
	 * Baut die Listen-URL mit geänderten Parametern; Seite springt bei jedem
	 * Filterwechsel auf 1 zurück.
	 *
	 * @param {Record<string, string | number | null>} changes
	 */
	function hrefWith(changes) {
		/** @type {string[]} */
		const params = [];
		const next = { q: data.search, filter: data.filter, sort: data.sort, page: '1', ...changes };
		for (const [key, value] of Object.entries(next)) {
			const isDefault =
				(key === 'filter' && value === 'alle') ||
				(key === 'sort' && value === 'neu') ||
				(key === 'page' && String(value) === '1');
			if (value !== null && value !== '' && !isDefault)
				params.push(`${key}=${encodeURIComponent(String(value))}`);
		}
		const query = params.join('&');
		return resolve(query ? `/(admin)/nutzer?${query}` : '/(admin)/nutzer');
	}

	const filterOptions = $derived(
		data.filters.map((option) => ({
			...option,
			href: hrefWith({ filter: option.value }),
			count: data.counts[option.value] ?? 0
		}))
	);

	/**
	 * @param {Event} event
	 */
	function onSort(event) {
		goto(hrefWith({ sort: /** @type {HTMLSelectElement} */ (event.currentTarget).value }), {
			reset: false
		});
	}

	const headClass = 'text-label px-4 py-3 text-left font-semibold whitespace-nowrap text-ink-500';
</script>

<svelte:head>
	<title>Nutzer | Konta Admin</title>
</svelte:head>

<PageHeader
	title="Nutzer."
	description="Alle Konten mit Abo, Onboarding und Nutzung. Klick auf einen Namen öffnet alles, was wir zu diesem Konto wissen."
/>

<div class="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
	<form
		method="GET"
		action={resolve('/(admin)/nutzer')}
		class="relative w-full lg:max-w-[380px]"
		role="search"
	>
		<Search
			size={18}
			strokeWidth={1.75}
			class="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-ink-400"
		/>
		<input
			type="search"
			name="q"
			value={data.search}
			placeholder="Name, E-Mail, Unternehmen, Telefon oder ID"
			aria-label="Nutzer suchen"
			class="h-control w-full rounded-md border border-ink-200 bg-white pr-3.5 pl-10 text-[15px] text-ink outline-none placeholder:text-ink-400 focus:border-ink-400 focus:shadow-[var(--focus-ring)]"
		/>
		{#if data.filter !== 'alle'}<input type="hidden" name="filter" value={data.filter} />{/if}
		{#if data.sort !== 'neu'}<input type="hidden" name="sort" value={data.sort} />{/if}
	</form>

	<label class="flex items-center gap-2 text-[14px] text-ink-700">
		Sortieren
		<select
			value={data.sort}
			onchange={onSort}
			class="h-control-sm rounded-md border border-ink-200 bg-white px-2.5 text-[14px] text-ink outline-none focus:shadow-[var(--focus-ring)]"
		>
			{#each data.sorts as option (option.value)}
				<option value={option.value}>{option.label}</option>
			{/each}
		</select>
	</label>
</div>

<SegmentedLinks label="Filter" options={filterOptions} value={data.filter} class="mb-4" />

<div class="{CARD_CLASS} overflow-hidden">
	{#if data.rows.length === 0}
		<p class="m-0 px-6 py-12 text-center text-[15px] text-ink-500">
			Keine Nutzer gefunden{data.search ? ` für „${data.search}“` : ''}.
		</p>
	{:else}
		<!-- Tabelle ab md, darunter Karten -->
		<div class="hidden overflow-x-auto md:block">
			<table class="w-full border-collapse text-[14px]">
				<thead class="border-b border-ink/7 bg-paper/60">
					<tr>
						<th class={headClass}>Nutzer</th>
						<th class={headClass}>Unternehmen</th>
						<th class={headClass}>Abo</th>
						<th class={headClass}>Onboarding</th>
						<th class="{headClass} text-right">Belege</th>
						<th class="{headClass} text-right">Rechnungen</th>
						<th class={headClass}>Zuletzt aktiv</th>
						<th class={headClass}>Registriert</th>
					</tr>
				</thead>
				<tbody>
					{#each data.rows as row (row.id)}
						<tr class="border-b border-ink/7 transition-colors last:border-b-0 hover:bg-violet-50">
							<td class="max-w-[260px] px-4 py-3">
								<UserCell
									id={row.id}
									firstName={row.firstName}
									lastName={row.lastName}
									secondary={row.email}
								/>
							</td>
							<td class="max-w-[200px] px-4 py-3">
								<span class="block truncate text-ink">{row.companyName ?? '—'}</span>
								<span class="block text-[12.5px] text-ink-500"
									>{labelOf(VAT_MODE_LABELS, row.vatMode)}</span
								>
							</td>
							<td class="px-4 py-3"
								><SubscriptionBadge status={row.status} plan={row.plan} showPlan /></td
							>
							<td class="px-4 py-3 whitespace-nowrap">
								{#if row.onboardingCompletedAt}
									<span class="inline-flex items-center gap-1.5 text-ink-700">
										Fertig
										{#if row.twoFactorEnabled}
											<ShieldCheck
												size={15}
												strokeWidth={1.75}
												class="text-violet-700"
												aria-label="2FA aktiv"
											/>
										{/if}
									</span>
								{:else if !row.emailVerifiedAt}
									<Badge tone="neutral">E-Mail offen</Badge>
								{:else}
									<Badge tone="neutral"
										>{labelOf(ONBOARDING_STEP_LABELS, row.onboardingStep, 'Start')}</Badge
									>
								{/if}
							</td>
							<td class="tnum px-4 py-3 text-right text-ink">{formatNumber(row.receipts)}</td>
							<td class="tnum px-4 py-3 text-right text-ink">{formatNumber(row.invoices)}</td>
							<td class="tnum px-4 py-3 whitespace-nowrap text-ink-700"
								>{formatRelative(row.last_active)}</td
							>
							<td class="tnum px-4 py-3 whitespace-nowrap text-ink-500"
								>{formatDateShort(row.createdAt)}</td
							>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<ul class="m-0 list-none divide-y divide-ink-100 p-0 md:hidden">
			{#each data.rows as row (row.id)}
				<li class="flex flex-col gap-2 px-4 py-3.5">
					<UserCell
						id={row.id}
						firstName={row.firstName}
						lastName={row.lastName}
						secondary={row.companyName ?? row.email}
					/>
					<div class="flex flex-wrap items-center gap-x-3 gap-y-1 pl-11 text-[12.5px] text-ink-500">
						<SubscriptionBadge status={row.status} />
						<span class="tnum"
							>{formatNumber(row.receipts)} Belege · {formatNumber(row.invoices)} Rechnungen</span
						>
						<span class="tnum">aktiv {formatRelative(row.last_active)}</span>
					</div>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<Pagination
	page={data.page}
	pageSize={data.pageSize}
	total={data.total}
	hrefFor={(page) => hrefWith({ page })}
/>
