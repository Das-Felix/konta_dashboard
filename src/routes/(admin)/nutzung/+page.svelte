<script>
	import { resolve } from '$app/paths';
	import Card from '#lib/components/ui/Card.svelte';
	import PageHeader from '#lib/components/ui/PageHeader.svelte';
	import SegmentedLinks from '#lib/components/ui/SegmentedLinks.svelte';
	import StatCard from '#lib/components/ui/StatCard.svelte';
	import UserCell from '#lib/components/ui/UserCell.svelte';
	import LineChart from '#lib/components/charts/LineChart.svelte';
	import ColumnChart from '#lib/components/charts/ColumnChart.svelte';
	import RankedBars from '#lib/components/charts/RankedBars.svelte';
	import StackBar from '#lib/components/charts/StackBar.svelte';
	import {
		formatDateTime,
		formatDayLabel,
		formatDayLong,
		formatNumber,
		formatPercent
	} from '#lib/format.js';
	import { actionLabel, entityTypeLabel } from '#lib/labels.js';

	/** @type {import('./$types').PageProps} */
	let { data } = $props();

	const rangeOptions = $derived(
		[7, 30, 90].map((days) => ({
			value: String(days),
			label: `${days} Tage`,
			href: resolve(`/(admin)/nutzung?range=${days}`)
		}))
	);

	const avgActive = $derived(
		data.active.length
			? data.active.reduce((sum, point) => sum + point.value, 0) / data.active.length
			: 0
	);
	const receiptsTotal = $derived(data.volume.receipts.reduce((sum, point) => sum + point.value, 0));
	const invoicesTotal = $derived(data.volume.invoices.reduce((sum, point) => sum + point.value, 0));
	const ex = $derived(data.extraction);
	const extractionTotal = $derived(ex.states.reduce((sum, row) => sum + row.value, 0));
	const extractionFailed = $derived(ex.states.find((row) => row.key === 'FAILED')?.value ?? 0);

	/** @type {Record<string, { label: string, color: string }>} */
	const EXTRACTION = {
		COMPLETED: { label: 'Erkannt', color: 'var(--green)' },
		PROCESSING: { label: 'Läuft', color: 'var(--violet-700)' },
		QUEUED: { label: 'Wartet', color: 'var(--ink-200)' },
		FAILED: { label: 'Fehlgeschlagen', color: 'var(--error)' }
	};

	/** @type {Record<string, { label: string, color: string }>} */
	const RUNS = {
		SENT: { label: 'Versendet', color: 'var(--green)' },
		ISSUED: { label: 'Ausgestellt', color: 'var(--ink)' },
		CREATED: { label: 'Entwurf', color: 'var(--violet-700)' },
		PENDING: { label: 'Läuft', color: 'var(--ink-200)' },
		FAILED: { label: 'Fehlgeschlagen', color: 'var(--error)' }
	};
</script>

<svelte:head>
	<title>Nutzung | Konta Admin</title>
</svelte:head>

<PageHeader
	title="Nutzung."
	description="Welche Funktionen genutzt werden, wie viel durch Konta läuft und wo es hakt."
>
	{#snippet actions()}
		<SegmentedLinks label="Zeitraum" options={rangeOptions} value={String(data.range)} />
	{/snippet}
</PageHeader>

<section class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
	<StatCard
		label="Aktive Nutzer pro Tag"
		value={formatNumber(avgActive)}
		hint="Schnitt über {data.range} Tage"
		series={data.active.map((point) => point.value)}
	/>
	<StatCard
		label="Belege erfasst"
		value={formatNumber(receiptsTotal)}
		hint="{formatNumber(receiptsTotal / data.range)} pro Tag"
	/>
	<StatCard
		label="Rechnungen ausgestellt"
		value={formatNumber(invoicesTotal)}
		hint="{formatNumber(invoicesTotal / data.range)} pro Tag"
	/>
	<StatCard
		label="Belegerkennung fehlgeschlagen"
		value={formatPercent(extractionTotal ? extractionFailed / extractionTotal : null, 1)}
		hint="{formatNumber(extractionFailed)} von {formatNumber(extractionTotal)} Uploads"
		tone={extractionTotal && extractionFailed / extractionTotal > 0.05 ? 'error' : 'default'}
	/>
</section>

<section class="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
	<Card title="Aktive Nutzer pro Tag">
		<ColumnChart
			label="Aktive Nutzer pro Tag"
			points={data.active.map((point) => ({ key: point.day, value: point.value }))}
			formatKey={formatDayLabel}
			formatKeyLong={formatDayLong}
			highlightLast
		/>
	</Card>
	<Card title="Belege und Rechnungen pro Tag">
		<LineChart
			label="Belege und Rechnungen pro Tag"
			keys={data.volume.receipts.map((point) => point.day)}
			series={[
				{
					key: 'receipts',
					label: 'Belege',
					color: 'ink',
					values: data.volume.receipts.map((point) => point.value)
				},
				{
					key: 'invoices',
					label: 'Rechnungen',
					color: 'violet',
					values: data.volume.invoices.map((point) => point.value)
				}
			]}
			formatKey={formatDayLabel}
			formatKeyLong={formatDayLong}
			height={220}
		/>
	</Card>
</section>

<section class="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
	<Card title="Funktionen im Einsatz">
		<p class="m-0 mb-4 text-[13.5px] text-ink-500">
			Anteil der {formatNumber(data.adoption.companies)} Unternehmen mit abgeschlossenem Onboarding, die
			die Funktion mindestens einmal genutzt haben.
		</p>
		<RankedBars
			showShare={false}
			items={data.adoption.features
				.toSorted((a, b) => b.value - a.value)
				.map((feature) => ({
					key: feature.key,
					label: feature.label,
					value: feature.value,
					meta: formatPercent(
						data.adoption.companies ? feature.value / data.adoption.companies : null
					)
				}))}
		/>
	</Card>
	<Card title="Häufigste Aktionen ({data.range} Tage)">
		<p class="m-0 mb-4 text-[13.5px] text-ink-500">
			Aus dem Änderungsprotokoll, mit Zahl der Unternehmen.
		</p>
		<RankedBars
			color="ink"
			items={data.topActions.map((row) => ({
				key: `${row.entityType}.${row.action}`,
				label: `${entityTypeLabel(row.entityType)}: ${actionLabel(row.action)}`,
				value: Number(row.value),
				meta: `${formatNumber(Number(row.companies))} Unt.`
			}))}
		/>
	</Card>
</section>

<section class="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
	<Card title="Belegerkennung">
		<StackBar
			label="Status der Belegerkennung"
			segments={Object.entries(EXTRACTION).map(([key, meta]) => ({
				key,
				label: meta.label,
				color: meta.color,
				value: ex.states.find((row) => row.key === key)?.value ?? 0
			}))}
		/>
		<p class="m-0 mt-5 text-[14px] text-ink-700">
			Beim Bestätigen korrigiert:
			<span class="tnum font-semibold text-ink"
				>{formatPercent(ex.confirmed ? ex.corrected / ex.confirmed : null)}</span
			>
			<span class="text-ink-500"
				>({formatNumber(ex.corrected)} von {formatNumber(ex.confirmed)} Belegen)</span
			>
		</p>
		{#if ex.failures.length > 0}
			<p class="text-label m-0 mt-5 mb-2 text-ink-500">Zuletzt fehlgeschlagen</p>
			<ul class="m-0 list-none divide-y divide-ink-100 p-0">
				{#each ex.failures as row (row.id)}
					<li class="flex items-start gap-3 py-2.5">
						<div class="min-w-0 flex-1">
							<UserCell
								id={row.userId}
								firstName={row.firstName}
								lastName={row.lastName}
								secondary={row.extractionError ?? 'Ohne Fehlermeldung'}
								avatar={false}
							/>
						</div>
						<span class="tnum shrink-0 text-[12.5px] text-ink-500"
							>{formatDateTime(row.createdAt)}</span
						>
					</li>
				{/each}
			</ul>
		{/if}
	</Card>

	<Card title="Hintergrundjobs und Zustellung">
		<p class="text-label m-0 mb-3 text-ink-500">Dauerrechnungs-Läufe</p>
		<StackBar
			label="Dauerrechnungs-Läufe"
			segments={Object.entries(RUNS).map(([key, meta]) => ({
				key,
				label: meta.label,
				color: meta.color,
				value: data.background.runs.find((row) => row.key === key)?.value ?? 0
			}))}
		/>
		<p class="m-0 mt-5 text-[14px] text-ink-700">
			Benachrichtigungen per Mail:
			<span class="tnum font-semibold text-ink">{formatNumber(data.background.mailsSent)}</span>
			zugestellt,
			<span class="tnum font-semibold {data.background.mailsFailed ? 'text-error' : 'text-ink'}"
				>{formatNumber(data.background.mailsFailed)}</span
			> fehlgeschlagen
		</p>
		{#if data.background.failedRuns.length > 0}
			<p class="text-label m-0 mt-5 mb-2 text-ink-500">Fehlgeschlagene Läufe</p>
			<ul class="m-0 list-none divide-y divide-ink-100 p-0">
				{#each data.background.failedRuns as row (row.id)}
					<li class="flex items-start gap-3 py-2.5">
						<div class="min-w-0 flex-1">
							<UserCell
								id={row.userId}
								firstName={row.firstName}
								lastName={row.lastName}
								secondary="{row.name}: {row.error ?? 'Ohne Fehlermeldung'}"
								avatar={false}
							/>
						</div>
						<span class="tnum shrink-0 text-[12.5px] text-ink-500"
							>{formatDateTime(row.scheduledFor)}</span
						>
					</li>
				{/each}
			</ul>
		{/if}
	</Card>
</section>
