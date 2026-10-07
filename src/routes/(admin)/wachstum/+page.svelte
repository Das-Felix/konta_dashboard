<script>
	import { resolve } from '$app/paths';
	import Card from '#lib/components/ui/Card.svelte';
	import PageHeader from '#lib/components/ui/PageHeader.svelte';
	import SegmentedLinks from '#lib/components/ui/SegmentedLinks.svelte';
	import StatCard from '#lib/components/ui/StatCard.svelte';
	import ColumnChart from '#lib/components/charts/ColumnChart.svelte';
	import Funnel from '#lib/components/charts/Funnel.svelte';
	import RankedBars from '#lib/components/charts/RankedBars.svelte';
	import StackBar from '#lib/components/charts/StackBar.svelte';
	import RetentionGrid from '#lib/components/charts/RetentionGrid.svelte';
	import {
		changeRatio,
		formatDayLabel,
		formatDayLong,
		formatNumber,
		formatPercent
	} from '#lib/format.js';
	import {
		CURRENT_TOOL_LABELS,
		LEAD_SOURCE_LABELS,
		ONBOARDING_STEP_LABELS,
		VAT_MODE_LABELS,
		labelOf
	} from '#lib/labels.js';

	/** @type {import('./$types').PageProps} */
	let { data } = $props();

	const rangeOptions = $derived(
		[30, 90].map((days) => ({
			value: String(days),
			label: `${days} Tage`,
			href: resolve(`/(admin)/wachstum?range=${days}`)
		}))
	);

	const lastWeek = $derived(data.weekly[data.weekly.length - 1]?.value ?? 0);
	const prevWeek = $derived(data.weekly[data.weekly.length - 2]?.value ?? 0);
	const total = $derived(data.daily.reduce((sum, point) => sum + point.value, 0));
	const onboarded = $derived(data.funnel.find((step) => step.key === 'onboarded')?.value ?? 0);
	const paying = $derived(data.funnel.find((step) => step.key === 'paying')?.value ?? 0);
	const stuck = $derived(data.dropoff.reduce((sum, step) => sum + step.value, 0));

	/**
	 * @param {{ key: string, value: number }[]} rows
	 * @param {Record<string, string>} labels
	 */
	function ranked(rows, labels) {
		return rows.map((row) => ({
			key: row.key,
			label: row.key === 'UNBEKANNT' ? 'Keine Angabe' : labelOf(labels, row.key),
			value: row.value
		}));
	}

	/** @param {string} week */
	const weekLabel = (week) => `KW ab ${formatDayLabel(week)}`;
</script>

<svelte:head>
	<title>Wachstum | Konta Admin</title>
</svelte:head>

<PageHeader
	title="Wachstum."
	description="Registrierungen, woher die Leute kommen und wo sie im Onboarding hängen bleiben."
>
	{#snippet actions()}
		<SegmentedLinks label="Zeitraum" options={rangeOptions} value={String(data.range)} />
	{/snippet}
</PageHeader>

<section class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
	<StatCard
		label="Registrierungen diese Woche"
		value={formatNumber(lastWeek)}
		change={changeRatio(lastWeek, prevWeek)}
		changeLabel="Vorwoche: {formatNumber(prevWeek)}"
		series={data.weekly.map((point) => point.value)}
	/>
	<StatCard
		label="Registrierungen ({data.range} Tage)"
		value={formatNumber(total)}
		hint="{formatNumber((total / data.range) * 7)} pro Woche im Schnitt"
	/>
	<StatCard
		label="Onboarding-Quote"
		value={formatPercent(total ? onboarded / total : null)}
		hint="{formatNumber(stuck)} Konten hängen gerade im Onboarding"
	/>
	<StatCard
		label="Zahlend aus Zeitraum"
		value={formatPercent(total ? paying / total : null)}
		hint="{formatNumber(paying)} von {formatNumber(total)} Konten"
	/>
</section>

<section class="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
	<Card title="Registrierungen pro Woche" class="xl:col-span-2">
		<ColumnChart
			label="Registrierungen pro Woche"
			points={data.weekly.map((point) => ({ key: point.week, value: point.value }))}
			formatKey={formatDayLabel}
			formatKeyLong={weekLabel}
			color="violet"
			height={360}
		/>
	</Card>
	<Card title="Trichter ({data.range} Tage)">
		<Funnel steps={data.funnel} />
	</Card>
</section>

<section class="mt-4">
	<Card title="Registrierungen pro Tag ({data.range} Tage)">
		<ColumnChart
			label="Registrierungen pro Tag"
			points={data.daily.map((point) => ({ key: point.day, value: point.value }))}
			formatKey={formatDayLabel}
			formatKeyLong={formatDayLong}
			highlightLast
			height={200}
		/>
	</Card>
</section>

<section class="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
	<Card title="Gefunden über">
		<RankedBars items={ranked(data.leadSources, LEAD_SOURCE_LABELS)} />
	</Card>
	<Card title="Bisher genutzt">
		<RankedBars items={ranked(data.tools, CURRENT_TOOL_LABELS)} color="ink" />
	</Card>
	<div class="flex flex-col gap-4">
		<Card title="Steuerstatus">
			<StackBar
				label="Steuerstatus"
				segments={data.vatModes.map((row, index) => ({
					key: row.key,
					label: labelOf(VAT_MODE_LABELS, row.key),
					value: row.value,
					color: index === 0 ? 'var(--ink)' : 'var(--violet-700)'
				}))}
			/>
		</Card>
		<Card title="Mit Steuerberatung">
			<StackBar
				label="Mit Steuerberatung"
				segments={[
					{
						key: 'ja',
						label: 'Ja',
						color: 'var(--ink)',
						value: data.taxAdvisor.find((row) => row.key === 'ja')?.value ?? 0
					},
					{
						key: 'nein',
						label: 'Nein',
						color: 'var(--violet-700)',
						value: data.taxAdvisor.find((row) => row.key === 'nein')?.value ?? 0
					},
					{
						key: 'unbekannt',
						label: 'Keine Angabe',
						color: 'var(--ink-200)',
						value: data.taxAdvisor.find((row) => row.key === 'unbekannt')?.value ?? 0
					}
				]}
			/>
		</Card>
	</div>
</section>

<section class="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
	<Card title="Hängt im Onboarding">
		<p class="m-0 mb-4 text-[13.5px] text-ink-500">
			Offene Konten nach zuletzt erreichtem Schritt. In Klammern: seit mehr als zwei Tagen.
		</p>
		<RankedBars
			showShare={false}
			color="ink"
			items={data.dropoff
				.filter((step) => step.value > 0)
				.map((step) => ({
					key: step.step,
					label: ONBOARDING_STEP_LABELS[step.step] ?? step.step,
					value: step.value,
					meta: `${formatNumber(step.stale)} älter`
				}))}
			empty="Niemand hängt im Onboarding."
		/>
		<a
			href={resolve('/(admin)/nutzer?filter=onboarding')}
			class="mt-4 inline-block text-[14px] font-semibold text-violet-700"
		>
			Konten ansehen
		</a>
	</Card>
	<Card title="Bindung nach Registrierungswoche" class="xl:col-span-2">
		<p class="m-0 mb-4 text-[13.5px] text-ink-500">
			Anteil der Konten, die in Woche n nach der Registrierung etwas getan haben (Login oder Eintrag
			im Änderungsprotokoll).
		</p>
		<RetentionGrid cohorts={data.cohorts} />
	</Card>
</section>
