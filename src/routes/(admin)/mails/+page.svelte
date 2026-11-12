<script>
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import Search from '@lucide/svelte/icons/search';
	import Card from '#lib/components/ui/Card.svelte';
	import Badge from '#lib/components/ui/Badge.svelte';
	import PageHeader from '#lib/components/ui/PageHeader.svelte';
	import Pagination from '#lib/components/ui/Pagination.svelte';
	import SegmentedLinks from '#lib/components/ui/SegmentedLinks.svelte';
	import StatCard from '#lib/components/ui/StatCard.svelte';
	import UserCell from '#lib/components/ui/UserCell.svelte';
	import LineChart from '#lib/components/charts/LineChart.svelte';
	import { CARD_CLASS } from '#lib/components/ui/card.js';
	import {
		formatDateTime,
		formatDayLabel,
		formatDayLong,
		formatNumber,
		formatPercent,
		formatRelative
	} from '#lib/format.js';
	import { EMAIL_STATUS, EMAIL_TYPES, emailTypeLabel } from '#lib/labels.js';

	/** @type {import('./$types').PageProps} */
	let { data } = $props();

	/**
	 * Baut die URL mit geänderten Parametern. Filterwechsel springen auf
	 * Seite 1 zurück.
	 *
	 * @param {Record<string, string | number | null>} changes
	 */
	function hrefWith(changes) {
		/** @type {string[]} */
		const params = [];
		const next = {
			range: String(data.range),
			q: data.search,
			status: data.status,
			typ: data.type,
			page: '1',
			...changes
		};
		for (const [key, value] of Object.entries(next)) {
			const isDefault =
				(key === 'range' && String(value) === '30') ||
				(key === 'status' && value === 'alle') ||
				(key === 'page' && String(value) === '1');
			if (value !== null && value !== '' && !isDefault)
				params.push(`${key}=${encodeURIComponent(String(value))}`);
		}
		const query = params.join('&');
		return resolve(query ? `/(admin)/mails?${query}` : '/(admin)/mails');
	}

	const rangeOptions = $derived(
		[7, 30, 90].map((days) => ({
			value: String(days),
			label: `${days} Tage`,
			href: hrefWith({ range: days, page: data.page })
		}))
	);

	const statusOptions = $derived(
		data.statusFilters.map((option) => ({ ...option, href: hrefWith({ status: option.value }) }))
	);

	const s = $derived(data.summary);
	const failRate = $derived(s.sent + s.failed ? s.failed / (s.sent + s.failed) : null);

	/** @param {Event} event */
	function onType(event) {
		const value = /** @type {HTMLSelectElement} */ (event.currentTarget).value;
		goto(hrefWith({ typ: value || null }), { reset: false });
	}

	/**
	 * @param {{ status: string, stale: boolean }} row
	 */
	function statusOf(row) {
		if (row.stale) return { label: 'Hängt', tone: /** @type {const} */ ('error') };
		return (
			EMAIL_STATUS[row.status] ?? { label: row.status, tone: /** @type {const} */ ('neutral') }
		);
	}

	const headClass = 'text-label px-4 py-3 text-left font-semibold whitespace-nowrap text-ink-500';
</script>

<svelte:head>
	<title>E-Mails | Konta Admin</title>
</svelte:head>

<PageHeader
	title="E-Mails."
	description="Welche Mails Konta automatisch verschickt hat, an wen und ob sie rausgegangen sind. Mails an Kunden über eigenes SMTP stehen hier nicht."
>
	{#snippet actions()}
		<SegmentedLinks label="Zeitraum" options={rangeOptions} value={String(data.range)} />
	{/snippet}
</PageHeader>

<section class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
	<StatCard
		label="Versendet"
		value={formatNumber(s.sent)}
		hint="an {formatNumber(s.recipients)} Nutzer in {data.range} Tagen"
		series={data.series.sent.map((point) => point.value)}
	/>
	<StatCard
		label="Fehlgeschlagen"
		value={formatNumber(s.failed)}
		hint="{formatPercent(failRate, 1)} der Versuche"
		tone={failRate !== null && failRate > 0.02 ? 'error' : 'default'}
		href={hrefWith({ status: 'fehlgeschlagen' })}
	/>
	<StatCard
		label="Übersprungen"
		value={formatNumber(s.skipped)}
		hint="Bedingung beim Versand nicht mehr erfüllt"
		href={hrefWith({ status: 'uebersprungen' })}
	/>
	<StatCard
		label="Hängt gerade"
		value={formatNumber(s.stale)}
		hint={s.stale ? 'Länger als 15 Minuten im Versand' : 'Nichts liegen geblieben'}
		tone={s.stale ? 'error' : 'default'}
		href={hrefWith({ status: 'laeuft' })}
	/>
</section>

<section class="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
	<Card title="Versand pro Tag">
		<LineChart
			label="Versendete und fehlgeschlagene Mails pro Tag"
			keys={data.series.sent.map((point) => point.day)}
			series={[
				{
					key: 'sent',
					label: 'Versendet',
					color: 'ink',
					values: data.series.sent.map((point) => point.value)
				},
				{
					key: 'failed',
					label: 'Fehlgeschlagen',
					color: 'violet',
					values: data.series.failed.map((point) => point.value)
				}
			]}
			formatKey={formatDayLabel}
			formatKeyLong={formatDayLong}
			height={220}
		/>
	</Card>

	<Card title="Nach Typ ({data.range} Tage)">
		{#if data.types.length === 0}
			<p class="m-0 text-[14px] text-ink-500">Im Zeitraum wurden keine Mails verschickt.</p>
		{:else}
			<div class="-mx-1 overflow-x-auto">
				<table class="w-full border-collapse text-[13.5px]">
					<thead>
						<tr class="border-b border-ink-100">
							<th class="text-label px-1 pb-2 text-left font-semibold text-ink-500">Typ</th>
							<th class="text-label px-1 pb-2 text-right font-semibold text-ink-500">Versendet</th>
							<th class="text-label px-1 pb-2 text-right font-semibold text-ink-500">Fehler</th>
							<th class="text-label px-1 pb-2 text-right font-semibold text-ink-500"
								>Übersprungen</th
							>
							<th class="text-label px-1 pb-2 text-right font-semibold text-ink-500">Zuletzt</th>
						</tr>
					</thead>
					<tbody>
						{#each data.types as row (row.type)}
							<tr class="border-b border-ink-100 last:border-b-0">
								<td class="max-w-[220px] px-1 py-2">
									<a
										href={hrefWith({ typ: row.type, status: 'alle' })}
										data-sveltekit-reset="false"
										class="focus-ring block truncate rounded-sm text-ink hover:underline"
										>{emailTypeLabel(row.type)}</a
									>
									<span class="block text-[12px] text-ink-500"
										>{EMAIL_TYPES[row.type]?.group ?? 'Unbekannt'}</span
									>
								</td>
								<td class="tnum px-1 py-2 text-right text-ink">{formatNumber(row.sent)}</td>
								<td
									class="tnum px-1 py-2 text-right {row.failed
										? 'font-semibold text-error'
										: 'text-ink-300'}">{formatNumber(row.failed)}</td
								>
								<td
									class="tnum px-1 py-2 text-right {row.skipped ? 'text-ink-700' : 'text-ink-300'}"
									>{formatNumber(row.skipped)}</td
								>
								<td class="tnum px-1 py-2 text-right whitespace-nowrap text-ink-500"
									>{row.lastSentAt ? formatRelative(row.lastSentAt) : '—'}</td
								>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</Card>
</section>

<section class="mt-8" aria-labelledby="protokoll">
	<h2 id="protokoll" class="m-0 mb-1 text-[18px] font-semibold text-ink">Protokoll</h2>
	<p class="m-0 mb-4 text-[13.5px] text-ink-500">
		Alle Mails, neueste zuerst, unabhängig vom Zeitraum.
	</p>

	<div class="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
		<form
			method="GET"
			action={resolve('/(admin)/mails')}
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
				placeholder="Empfänger, Name, Unternehmen oder Message-ID"
				aria-label="Mails durchsuchen"
				class="h-control w-full rounded-md border border-ink-200 bg-white pr-3.5 pl-10 text-[15px] text-ink outline-none placeholder:text-ink-400 focus:border-ink-400 focus:shadow-[var(--focus-ring)]"
			/>
			{#if data.range !== 30}<input type="hidden" name="range" value={data.range} />{/if}
			{#if data.status !== 'alle'}<input type="hidden" name="status" value={data.status} />{/if}
			{#if data.type}<input type="hidden" name="typ" value={data.type} />{/if}
		</form>

		<label class="flex items-center gap-2 text-[14px] text-ink-700">
			Typ
			<select
				value={data.type ?? ''}
				onchange={onType}
				class="h-control-sm max-w-[240px] rounded-md border border-ink-200 bg-white px-2.5 text-[14px] text-ink outline-none focus:shadow-[var(--focus-ring)]"
			>
				<option value="">Alle Typen</option>
				{#each data.typeOptions as type (type)}
					<option value={type}>{emailTypeLabel(type)}</option>
				{/each}
			</select>
		</label>
	</div>

	<SegmentedLinks label="Status" options={statusOptions} value={data.status} class="mb-4" />

	<div class="{CARD_CLASS} overflow-hidden">
		{#if data.log.rows.length === 0}
			<p class="m-0 px-6 py-12 text-center text-[15px] text-ink-500">
				Keine Mails gefunden{data.search ? ` für „${data.search}“` : ''}.
			</p>
		{:else}
			<div class="hidden overflow-x-auto md:block">
				<table class="w-full border-collapse text-[14px]">
					<thead class="border-b border-ink/7 bg-paper/60">
						<tr>
							<th class={headClass}>Mail</th>
							<th class={headClass}>Empfänger</th>
							<th class={headClass}>Status</th>
							<th class={headClass}>Erstellt</th>
							<th class={headClass}>Versendet</th>
						</tr>
					</thead>
					<tbody>
						{#each data.log.rows as row (row.id)}
							{@const st = statusOf(row)}
							<tr class="border-b border-ink/7 align-top last:border-b-0">
								<td class="max-w-[280px] px-4 py-3">
									<span class="block truncate text-ink">{emailTypeLabel(row.type)}</span>
									{#if row.error}
										<span class="block text-[12.5px] break-words text-error">{row.error}</span>
									{:else}
										<span class="block text-[12.5px] text-ink-500"
											>{EMAIL_TYPES[row.type]?.group ?? row.type}</span
										>
									{/if}
								</td>
								<td class="max-w-[280px] px-4 py-3">
									{#if row.userId}
										<UserCell
											id={row.userId}
											firstName={row.firstName}
											lastName={row.lastName}
											secondary={row.toEmail ?? row.companyName}
											avatar={false}
										/>
									{:else}
										<span class="block truncate text-ink-700"
											>{row.toEmail ?? 'Adresse gelöscht'}</span
										>
										<span class="block text-[12.5px] text-ink-500"
											>{row.toEmail ? 'ohne Konto' : 'Konto gelöscht'}</span
										>
									{/if}
								</td>
								<td class="px-4 py-3 whitespace-nowrap">
									<Badge tone={st.tone}>{st.label}</Badge>
									{#if row.attempts > 1}
										<span class="tnum mt-1 block text-[12px] text-ink-500"
											>{row.attempts} Versuche{row.status === 'FAILED' && row.attempts >= 3
												? ', aufgegeben'
												: ''}</span
										>
									{/if}
								</td>
								<td class="tnum px-4 py-3 whitespace-nowrap text-ink-700"
									>{formatDateTime(row.createdAt)}</td
								>
								<td class="tnum px-4 py-3 whitespace-nowrap text-ink-500"
									>{row.sentAt ? formatDateTime(row.sentAt) : '—'}</td
								>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>

			<ul class="m-0 list-none divide-y divide-ink-100 p-0 md:hidden">
				{#each data.log.rows as row (row.id)}
					{@const st = statusOf(row)}
					<li class="flex flex-col gap-1.5 px-4 py-3.5">
						<div class="flex items-start justify-between gap-3">
							<span class="min-w-0 truncate font-medium text-ink">{emailTypeLabel(row.type)}</span>
							<Badge tone={st.tone}>{st.label}</Badge>
						</div>
						{#if row.userId}
							<UserCell
								id={row.userId}
								firstName={row.firstName}
								lastName={row.lastName}
								secondary={row.toEmail}
								avatar={false}
							/>
						{:else}
							<span class="truncate text-[13.5px] text-ink-700"
								>{row.toEmail ?? 'Konto gelöscht'}</span
							>
						{/if}
						{#if row.error}<span class="text-[12.5px] break-words text-error">{row.error}</span
							>{/if}
						<span class="tnum text-[12.5px] text-ink-500">{formatDateTime(row.createdAt)}</span>
					</li>
				{/each}
			</ul>
		{/if}
	</div>

	<Pagination
		page={data.page}
		pageSize={data.pageSize}
		total={data.log.total}
		hrefFor={(page) => hrefWith({ page })}
	/>
</section>
