<script>
	import { resolve } from '$app/paths';
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import Button from '#lib/components/ui/Button.svelte';
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
		formatDuration,
		formatMonth,
		formatNumber,
		formatPageLabel,
		formatPercent
	} from '#lib/format.js';

	/** @type {import('./$types').PageProps} */
	let { data } = $props();

	const rangeOptions = $derived(
		[7, 30, 90].map((days) => ({
			value: String(days),
			label: `${days} Tage`,
			href: resolve(`/(admin)/landingpage?range=${days}`)
		}))
	);

	const points = $derived(data.overview?.points ?? []);
	const days = $derived(points.map((point) => point.day));
	// Ab etwa zwei Monaten liefert OpenPanel einen Punkt pro Monat.
	const monthly = $derived(days.length > 1 && days.every((day) => day.endsWith('-01')));
	const multipleOrigins = $derived(new Set(data.pages.map((row) => row.origin)).size > 1);

	const countryNames = new Intl.DisplayNames('de-AT', { type: 'region' });
	/** @param {string} code */
	function countryName(code) {
		try {
			return countryNames.of(code) ?? code;
		} catch {
			return code;
		}
	}

	/** @type {Record<string, string>} */
	const DEVICE_LABELS = { desktop: 'Desktop', mobile: 'Smartphone', tablet: 'Tablet' };

	/**
	 * @param {import('#lib/server/openpanel.js').BreakdownRow[] | undefined} rows
	 * @param {string} fallback Beschriftung für Zeilen ohne Wert
	 * @param {(name: string) => string} [label]
	 */
	function bars(rows, fallback, label = (name) => name) {
		return (rows ?? []).map((row) => ({
			key: row.name ?? '',
			label: row.name ? label(row.name) : fallback,
			value: row.sessions
		}));
	}
</script>

<svelte:head>
	<title>Landingpage | Konta Admin</title>
</svelte:head>

<PageHeader
	title="Landingpage."
	description="Besucher der Website aus dem OpenPanel-Projekt der Landingpage."
>
	{#snippet actions()}
		{#if data.dashboardUrl}
			<Button
				variant="secondary"
				size="sm"
				icon={ExternalLink}
				href={data.dashboardUrl}
				target="_blank"
				rel="noopener noreferrer"
			>
				In OpenPanel öffnen
			</Button>
		{/if}
		{#if data.configured}
			<SegmentedLinks label="Zeitraum" options={rangeOptions} value={String(data.range)} />
		{/if}
	{/snippet}
</PageHeader>

{#if !data.configured}
	<Notice title="Die Landingpage ist nicht verbunden.">
		<p class="m-0 mt-1">
			Leg im OpenPanel-Projekt der Landingpage unter Einstellungen einen eigenen Client im Modus
			„read“ an und setz OPENPANEL_WEBSITE_CLIENT_ID und OPENPANEL_WEBSITE_CLIENT_SECRET. Der Client
			der App gehört zu einem anderen Projekt und reicht dafür nicht.
		</p>
	</Notice>
{:else}
	{#if data.error}
		<Notice tone="error" title="OpenPanel antwortet nicht vollständig." class="mb-4">
			{data.error}. Ein Teil der Auswertungen fehlt.
		</Notice>
	{/if}

	<section class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
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
		<StatCard
			label="Absprungrate"
			value={formatPercent((data.overview?.totals.bounceRate ?? 0) / 100)}
			hint="Sessions mit nur einer Seite"
		/>
		<StatCard
			label="Sessiondauer"
			value={formatDuration(data.overview?.totals.sessionDuration ?? 0)}
			hint="Durchschnitt"
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

	<section class="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
		<Card title="Quellen (Sessions)">
			<RankedBars color="ink" items={bars(data.breakdowns?.referrer_name, 'Direkt')} />
		</Card>
		<Card title="UTM-Quellen">
			<RankedBars items={bars(data.breakdowns?.utm_source, 'Ohne UTM-Quelle')} />
		</Card>
		<Card title="UTM-Kampagnen">
			<RankedBars items={bars(data.breakdowns?.utm_campaign, 'Ohne Kampagne')} />
		</Card>
	</section>

	<section class="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
		<Card title="Länder">
			<RankedBars color="ink" items={bars(data.breakdowns?.country, 'Unbekannt', countryName)} />
		</Card>
		<Card title="Geräte">
			<RankedBars
				color="ink"
				items={bars(data.breakdowns?.device, 'Unbekannt', (name) => DEVICE_LABELS[name] ?? name)}
			/>
		</Card>
		<Card title="Browser">
			<RankedBars color="ink" items={bars(data.breakdowns?.browser, 'Unbekannt')} />
		</Card>
		<Card title="Betriebssysteme">
			<RankedBars color="ink" items={bars(data.breakdowns?.os, 'Unbekannt')} />
		</Card>
	</section>
{/if}
