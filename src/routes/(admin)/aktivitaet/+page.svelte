<script>
	import { resolve } from '$app/paths';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import Card from '#lib/components/ui/Card.svelte';
	import PageHeader from '#lib/components/ui/PageHeader.svelte';
	import SegmentedLinks from '#lib/components/ui/SegmentedLinks.svelte';
	import Pagination from '#lib/components/ui/Pagination.svelte';
	import Badge from '#lib/components/ui/Badge.svelte';
	import { CARD_CLASS } from '#lib/components/ui/card.js';
	import { parseAuditChanges } from '#lib/timeline.js';
	import { formatDateTime, formatNumber, formatRelative } from '#lib/format.js';
	import { LOGIN_RESULT, actionLabel, entityTypeLabel } from '#lib/labels.js';

	/** @type {import('./$types').PageProps} */
	let { data } = $props();

	/**
	 * @param {Record<string, string | number>} changes
	 */
	function hrefWith(changes) {
		const next = { typ: data.entityType, akteur: data.actorType, page: 1, ...changes };
		/** @type {string[]} */
		const params = [];
		for (const [key, value] of Object.entries(next)) {
			if (value !== '' && !(key === 'page' && Number(value) === 1))
				params.push(`${key}=${encodeURIComponent(String(value))}`);
		}
		const query = params.join('&');
		return resolve(query ? `/(admin)/aktivitaet?${query}` : '/(admin)/aktivitaet');
	}

	const typeOptions = $derived([
		{ value: '', label: 'Alle', href: hrefWith({ typ: '' }) },
		...data.entityTypes.map((row) => ({
			value: row.entityType,
			label: entityTypeLabel(row.entityType),
			href: hrefWith({ typ: row.entityType }),
			count: Number(row.value)
		}))
	]);

	const actorOptions = $derived(
		[
			['', 'Alle'],
			['USER', 'Nutzer'],
			['SYSTEM', 'System'],
			['UNKNOWN', 'Unbekannt']
		].map(([value, label]) => ({ value, label, href: hrefWith({ akteur: value }) }))
	);
</script>

<svelte:head>
	<title>Änderungsprotokoll | Konta Admin</title>
</svelte:head>

<PageHeader
	title="Änderungsprotokoll."
	description="Alle steuerrelevanten Änderungen über alle Unternehmen, neueste zuerst. Mit Vorher und Nachher, für Support und Nachvollziehbarkeit."
/>

<div class="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
	<SegmentedLinks label="Bereich" options={typeOptions} value={data.entityType} />
	<SegmentedLinks label="Ausgelöst von" options={actorOptions} value={data.actorType} />
</div>

<div class="grid grid-cols-1 gap-4 xl:grid-cols-3">
	<div class="min-w-0 xl:col-span-2">
		<div class="{CARD_CLASS} overflow-hidden">
			<ul class="m-0 list-none p-0">
				{#each data.rows as row (row.id)}
					{@const changes = parseAuditChanges(row.changes)}
					{@const personId = row.userId ?? row.ownerId}
					<li class="border-b border-ink/7 px-5 py-3.5 last:border-b-0">
						<div class="flex items-start justify-between gap-4">
							<div class="min-w-0">
								<p
									class="m-0 text-[14px] text-ink {String(row.action).includes('failed')
										? 'text-error'
										: ''}"
								>
									{row.summary ??
										`${entityTypeLabel(row.entityType)} ${actionLabel(row.action).toLowerCase()}`}
								</p>
								<p class="m-0 mt-0.5 text-[12.5px] text-ink-500">
									{#if personId}
										<a
											href={resolve('/(admin)/nutzer/[id]', { id: personId })}
											class="font-medium text-ink-700 hover:text-violet-700"
										>
											{row.userId
												? `${row.firstName ?? ''} ${row.lastName ?? ''}`.trim()
												: `System für ${row.ownerFirstName ?? ''} ${row.ownerLastName ?? ''}`.trim()}
										</a>
									{/if}
									{#if row.companyName}· {row.companyName}{/if}
									· {entityTypeLabel(row.entityType)} · {actionLabel(row.action)}
								</p>
							</div>
							<span class="flex shrink-0 flex-col items-end gap-1">
								<time
									class="tnum text-[12.5px] text-ink-700"
									datetime={new Date(row.createdAt).toISOString()}
									>{formatDateTime(row.createdAt)}</time
								>
								{#if row.actorType !== 'USER'}<Badge tone="neutral"
										>{row.actorType === 'SYSTEM' ? 'System' : 'Unbekannt'}</Badge
									>{/if}
							</span>
						</div>
						{#if changes.length > 0}
							<details class="group mt-2">
								<summary
									class="inline-flex cursor-pointer list-none items-center gap-1 text-[12.5px] font-semibold text-violet-700"
								>
									<ChevronRight
										size={14}
										strokeWidth={2}
										class="transition-transform group-open:rotate-90"
									/>
									{changes.length}
									{changes.length === 1 ? 'Änderung' : 'Änderungen'}
								</summary>
								<table class="mt-2 w-full border-collapse text-[12.5px]">
									<tbody>
										{#each changes as change (change.field)}
											<tr class="border-b border-ink/7 last:border-b-0">
												<td class="w-1/4 py-1.5 pr-3 font-medium text-ink">{change.field}</td>
												<td class="py-1.5 pr-3 break-all text-ink-500">{change.from}</td>
												<td class="py-1.5 break-all text-ink">{change.to}</td>
											</tr>
										{/each}
									</tbody>
								</table>
							</details>
						{/if}
					</li>
				{:else}
					<li class="px-5 py-12 text-center text-[14px] text-ink-500">
						Keine Einträge für diesen Filter.
					</li>
				{/each}
			</ul>
		</div>
		<Pagination
			page={data.page}
			pageSize={data.pageSize}
			total={data.total}
			hrefFor={(page) => hrefWith({ page })}
		/>
	</div>

	<Card title="Fehlgeschlagene Anmeldungen (24 Std.)">
		<p class="m-0 mb-3 text-[13.5px] text-ink-500">
			Hilft bei „Ich komme nicht rein“ und zeigt auffällige Muster.
		</p>
		<ul class="m-0 list-none divide-y divide-ink-100 p-0">
			{#each data.failedLogins as row (row.email)}
				<li class="flex flex-col gap-1 py-2.5">
					<div class="flex items-baseline justify-between gap-3">
						{#if row.userId}
							<a
								href={resolve('/(admin)/nutzer/[id]', { id: row.userId })}
								class="min-w-0 truncate text-[14px] font-medium text-ink hover:text-violet-700"
								>{row.email}</a
							>
						{:else}
							<span
								class="min-w-0 truncate text-[14px] text-ink-700"
								title="Kein Konto mit dieser Adresse">{row.email}</span
							>
						{/if}
						<Badge tone={row.attempts >= 5 ? 'error' : 'neutral'}
							>{formatNumber(row.attempts)}×</Badge
						>
					</div>
					<p class="m-0 text-[12.5px] text-ink-500">
						{row.results
							.map((/** @type {string} */ result) => LOGIN_RESULT[result]?.label ?? result)
							.join(', ')}
						· {formatNumber(row.ips)}
						{row.ips === 1 ? 'IP' : 'IPs'} · zuletzt {formatRelative(row.last_at)}
					</p>
				</li>
			{:else}
				<li class="py-6 text-center text-[14px] text-ink-500">
					Keine fehlgeschlagenen Anmeldungen.
				</li>
			{/each}
		</ul>
	</Card>
</div>
