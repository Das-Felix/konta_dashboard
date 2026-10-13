<script>
	import { resolve } from '$app/paths';
	import Card from '#lib/components/ui/Card.svelte';
	import PageHeader from '#lib/components/ui/PageHeader.svelte';
	import SegmentedLinks from '#lib/components/ui/SegmentedLinks.svelte';
	import StatCard from '#lib/components/ui/StatCard.svelte';
	import Notice from '#lib/components/ui/Notice.svelte';
	import LineChart from '#lib/components/charts/LineChart.svelte';
	import RankedBars from '#lib/components/charts/RankedBars.svelte';
	import {
		formatDayLabel,
		formatDayLong,
		formatMonth,
		formatNumber,
		formatPageLabel,
		formatRelative,
		formatTime
	} from '#lib/format.js';
	import { eventGroup, eventLabel } from '#lib/labels.js';

	/** @type {import('./$types').PageProps} */
	let { data } = $props();

	const rangeOptions = $derived(
		[7, 30, 90].map((days) => ({
			value: String(days),
			label: `${days} Tage`,
			href: resolve(`/(admin)/analytics?range=${days}`)
		}))
	);

	const points = $derived(data.overview?.points ?? []);
	const days = $derived(points.map((point) => point.day));
	// Ab etwa zwei Monaten liefert OpenPanel einen Punkt pro Monat.
	const monthly = $derived(days.length > 1 && days.every((day) => day.endsWith('-01')));
	const multipleOrigins = $derived(new Set(data.pages.map((row) => row.origin)).size > 1);

	/**
	 * Pfad aus einem Screen View (volle URL mit SvelteKit-Route).
	 * @param {string | null} value
	 */
	function pathOf(value) {
		if (!value) return '';
		try {
			return new URL(value).pathname;
		} catch {
			return value;
		}
	}
</script>

<svelte:head>
	<title>Analytics | Konta Admin</title>
</svelte:head>

<PageHeader
	title="Analytics."
	description="Produktereignisse aus OpenPanel, verknüpft mit den Konten in der Datenbank."
>
	{#snippet actions()}
		{#if data.configured}
			<SegmentedLinks label="Zeitraum" options={rangeOptions} value={String(data.range)} />
		{/if}
	{/snippet}
</PageHeader>

{#if !data.configured}
	<Notice title="OpenPanel ist nicht verbunden.">
		<p class="m-0 mt-1">
			Leg im OpenPanel-Projekt unter Einstellungen einen eigenen Client im Modus „read“ an und setz
			OPENPANEL_CLIENT_ID und OPENPANEL_CLIENT_SECRET. Der Tracking-Client der App darf nur
			schreiben und reicht dafür nicht.
		</p>
	</Notice>
{:else}
	{#if data.error}
		<Notice tone="error" title="OpenPanel antwortet nicht vollständig." class="mb-4">
			{data.error}. Ein Teil der Auswertungen fehlt.
		</Notice>
	{/if}

	<section class="grid grid-cols-1 gap-4 sm:grid-cols-3">
		<StatCard
			label="Besucher"
			value={formatNumber(data.overview?.totals.visitors ?? 0)}
			hint="eindeutig · {data.range} Tage"
			series={points.map((point) => point.visitors)}
		/>
		<StatCard
			label="Sessions"
			value={formatNumber(data.overview?.totals.sessions ?? 0)}
			hint="{data.range} Tage"
			series={points.map((point) => point.sessions)}
		/>
		<StatCard
			label="Seitenaufrufe"
			value={formatNumber(data.overview?.totals.pageViews ?? 0)}
			hint="{data.range} Tage"
			series={points.map((point) => point.pageViews)}
		/>
	</section>

	<section class="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
		<Card title="Besucher und Sessions" class="xl:col-span-2">
			<LineChart
				label={monthly ? 'Besucher und Sessions pro Monat' : 'Besucher und Sessions pro Tag'}
				keys={days}
				series={[
					{
						key: 'users',
						label: 'Besucher',
						color: 'ink',
						values: points.map((point) => point.visitors)
					},
					{
						key: 'sessions',
						label: 'Sessions',
						color: 'violet',
						values: points.map((point) => point.sessions)
					}
				]}
				formatKey={monthly ? formatMonth : formatDayLabel}
				formatKeyLong={monthly ? formatMonth : formatDayLong}
				height={380}
			/>
		</Card>
		<Card title="Meistbesuchte Seiten (Sessions)">
			<RankedBars
				color="ink"
				items={data.pages.map((row) => ({
					key: `${row.origin}${row.path}`,
					label: formatPageLabel(row, multipleOrigins),
					value: row.sessions
				}))}
			/>
		</Card>
	</section>

	<section class="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
		<Card title="Wichtige Ereignisse ({data.range} Tage)">
			<RankedBars
				showShare={false}
				items={data.keyEvents
					.filter((row) => row.total > 0)
					.toSorted((a, b) => b.total - a.total)
					.map((row) => ({ key: row.name, label: eventLabel(row.name), value: row.total }))}
			/>
		</Card>

		<Card title="Live" class="xl:col-span-2">
			{#snippet action()}
				<span class="inline-flex items-center gap-1.5 text-[12.5px] text-ink-500">
					<span class="size-2 animate-pulse rounded-full bg-green" aria-hidden="true"></span>
					Letzte {formatNumber(data.recent.length)} Ereignisse
				</span>
			{/snippet}
			<ul class="m-0 list-none divide-y divide-ink-100 p-0">
				{#each data.recent as event (event.id)}
					<li class="flex items-start gap-3 py-2.5">
						<span
							class="tnum w-12 shrink-0 pt-0.5 text-[12.5px] text-ink-500"
							title={formatRelative(event.createdAt)}
						>
							{formatTime(event.createdAt)}
						</span>
						<div class="min-w-0 flex-1">
							<p class="m-0 truncate text-[14px] text-ink">
								{eventLabel(event.name)}{#if event.name === 'screen_view'}<span class="text-ink-500"
										>: {pathOf(event.path)}</span
									>{/if}
							</p>
							<p class="m-0 mt-0.5 truncate text-[12.5px] text-ink-500">
								{#if event.user}
									<a
										href={resolve('/(admin)/nutzer/[id]', { id: event.user.id })}
										class="font-medium text-ink-700 hover:text-violet-700"
									>
										{event.user.firstName}
										{event.user.lastName}
									</a>
									{#if event.user.companyName}· {event.user.companyName}{/if}
								{:else if event.profileId}
									Profil {event.profileId.slice(0, 10)}…
								{:else}
									Anonym
								{/if}
								· {eventGroup(event.name)}
								{#if event.city || event.country}· {[event.city, event.country]
										.filter(Boolean)
										.join(', ')}{/if}
							</p>
						</div>
					</li>
				{:else}
					<li class="py-6 text-center text-[14px] text-ink-500">
						Keine Ereignisse in den letzten 48 Stunden.
					</li>
				{/each}
			</ul>
		</Card>
	</section>
{/if}
