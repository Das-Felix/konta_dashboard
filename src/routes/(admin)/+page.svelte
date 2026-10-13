<script>
	import { resolve } from '$app/paths';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import Card from '#lib/components/ui/Card.svelte';
	import StatCard from '#lib/components/ui/StatCard.svelte';
	import PageHeader from '#lib/components/ui/PageHeader.svelte';
	import SegmentedLinks from '#lib/components/ui/SegmentedLinks.svelte';
	import UserCell from '#lib/components/ui/UserCell.svelte';
	import SubscriptionBadge from '#lib/components/ui/SubscriptionBadge.svelte';
	import Badge from '#lib/components/ui/Badge.svelte';
	import Notice from '#lib/components/ui/Notice.svelte';
	import LineChart from '#lib/components/charts/LineChart.svelte';
	import ColumnChart from '#lib/components/charts/ColumnChart.svelte';
	import Funnel from '#lib/components/charts/Funnel.svelte';
	import RankedBars from '#lib/components/charts/RankedBars.svelte';
	import ActivityList from '#lib/components/ActivityList.svelte';
	import {
		changeRatio,
		formatDate,
		formatDayLabel,
		formatDayLong,
		formatEuro,
		formatMonth,
		formatNumber,
		formatPercent,
		formatRelative
	} from '#lib/format.js';
	import { LEAD_SOURCE_LABELS, ONBOARDING_STEP_LABELS, labelOf } from '#lib/labels.js';

	/** @type {import('./$types').PageProps} */
	let { data } = $props();

	const k = $derived(data.kpis);
	const landingpageHref = $derived(resolve('/(admin)/landingpage'));

	const rangeOptions = $derived(
		[7, 30, 90].map((days) => ({
			value: String(days),
			label: `${days} Tage`,
			href: `${resolve('/(admin)')}?range=${days}`
		}))
	);

	const onboarded = $derived(data.funnel.find((step) => step.key === 'onboarded')?.value ?? 0);
	const registered = $derived(data.funnel.find((step) => step.key === 'registered')?.value ?? 0);

	const alerts = $derived(
		[
			{
				value: k.pastDue,
				label: 'Abos mit offener Zahlung',
				href: resolve('/(admin)/nutzer?filter=zahlung_offen')
			},
			{
				value: k.trialsEndingSoon,
				label: 'Tests enden in 7 Tagen',
				href: resolve('/(admin)/abos')
			},
			{
				value: k.extractionFailed7d,
				label: 'Belegerkennung fehlgeschlagen (7 Tage)',
				href: resolve('/(admin)/nutzung')
			},
			{
				value: k.recurringFailed7d,
				label: 'Dauerrechnungen fehlgeschlagen (7 Tage)',
				href: resolve('/(admin)/nutzung')
			}
		].filter((alert) => alert.value > 0)
	);

	/**
	 * @param {number} signups
	 * @param {number | null} visitors
	 */
	function conversion(signups, visitors) {
		return visitors ? signups / visitors : null;
	}
</script>

<svelte:head>
	<title>Übersicht | Konta Admin</title>
</svelte:head>

{#snippet visitorsFallback(/** @type {string} */ label, /** @type {string} */ hint)}
	<StatCard {label} value="—" {hint} href={landingpageHref} />
{/snippet}

<PageHeader eyebrow={formatDate(new Date())} title="Übersicht." />

<h2 class="text-label m-0 mb-3 text-ink-500">Heute</h2>
<section class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Heute">
	{#if !data.website}
		{@render visitorsFallback('Besucher Landingpage', 'Landingpage nicht verbunden')}
	{:else}
		{#await data.website}
			{@render visitorsFallback('Besucher Landingpage', 'Lädt aus OpenPanel …')}
		{:then website}
			{#if website.ok}
				<StatCard
					label="Besucher Landingpage"
					value={formatNumber(website.today)}
					change={changeRatio(website.today, website.yesterday)}
					changeLabel="Gestern: {formatNumber(website.yesterday)}"
					series={website.last14}
					href={landingpageHref}
				/>
			{:else}
				{@render visitorsFallback('Besucher Landingpage', 'OpenPanel antwortet nicht')}
			{/if}
		{/await}
	{/if}
	<StatCard
		label="Registrierungen"
		value={formatNumber(k.signupsToday)}
		change={changeRatio(k.signupsToday, k.signupsYesterday)}
		changeLabel="Gestern: {formatNumber(k.signupsYesterday)}"
		series={data.signups14.map((point) => point.value)}
		href={resolve('/(admin)/wachstum')}
	/>
	<StatCard
		label="Aktive Nutzer"
		value={formatNumber(k.activeToday)}
		change={changeRatio(k.activeToday, k.activeYesterday)}
		changeLabel="Gestern: {formatNumber(k.activeYesterday)}"
		series={data.active14.map((point) => point.value)}
		href={resolve('/(admin)/nutzung')}
	/>
	<StatCard
		label="MRR netto"
		value={formatEuro(k.mrr, { whole: true })}
		hint="{formatNumber(k.paying)} zahlend · {formatNumber(k.trialing)} im Test"
		href={resolve('/(admin)/abos')}
	/>
</section>

<div class="mt-8 mb-3 flex flex-wrap items-center justify-between gap-3">
	<h2 class="text-label m-0 text-ink-500">Letzte {data.range} Tage</h2>
	<SegmentedLinks label="Zeitraum" options={rangeOptions} value={String(data.range)} />
</div>

<section
	class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
	aria-label="Letzte {data.range} Tage"
>
	{#if !data.website}
		{@render visitorsFallback('Besucher Landingpage', 'Landingpage nicht verbunden')}
		{@render visitorsFallback('Besucher zu Registrierung', 'Braucht die Landingpage')}
	{:else}
		{#await data.website}
			{@render visitorsFallback('Besucher Landingpage', 'Lädt aus OpenPanel …')}
			{@render visitorsFallback('Besucher zu Registrierung', 'Lädt aus OpenPanel …')}
		{:then website}
			{#if website.ok}
				<StatCard
					label="Besucher Landingpage"
					value={formatNumber(website.visitors)}
					change={website.previousVisitors === null
						? null
						: changeRatio(website.visitors, website.previousVisitors)}
					changeLabel="Davor: {formatNumber(website.previousVisitors ?? 0)}"
					hint="eindeutig · Davor: {formatNumber(website.previousVisitors ?? 0)}"
					href={landingpageHref}
				/>
				<StatCard
					label="Besucher zu Registrierung"
					value={formatPercent(conversion(data.signupTotal, website.visitors), 1)}
					change={changeRatio(
						conversion(data.signupTotal, website.visitors) ?? 0,
						conversion(data.signupPreviousTotal, website.previousVisitors) ?? 0
					)}
					changeLabel="Davor: {formatPercent(
						conversion(data.signupPreviousTotal, website.previousVisitors),
						1
					)}"
					hint="Registrierungen je Besucher · Davor: {formatPercent(
						conversion(data.signupPreviousTotal, website.previousVisitors),
						1
					)}"
					href={resolve('/(admin)/wachstum')}
				/>
			{:else}
				{@render visitorsFallback('Besucher Landingpage', 'OpenPanel antwortet nicht')}
				{@render visitorsFallback('Besucher zu Registrierung', 'OpenPanel antwortet nicht')}
			{/if}
		{/await}
	{/if}
	<StatCard
		label="Registrierungen"
		value={formatNumber(data.signupTotal)}
		change={changeRatio(data.signupTotal, data.signupPreviousTotal)}
		changeLabel="Davor: {formatNumber(data.signupPreviousTotal)}"
		hint="Davor: {formatNumber(data.signupPreviousTotal)}"
		href={resolve('/(admin)/wachstum')}
	/>
	<StatCard
		label="Onboarding abgeschlossen"
		value={formatPercent(registered ? onboarded / registered : null)}
		hint="{formatNumber(onboarded)} von {formatNumber(registered)} neuen Konten"
		href={resolve('/(admin)/wachstum')}
	/>
</section>

<section class="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
	<Card title="Besucher Landingpage">
		{#if !data.website}
			<p class="m-0 text-[14px] text-ink-500">
				Die Landingpage ist nicht verbunden. Setz OPENPANEL_WEBSITE_CLIENT_ID und
				OPENPANEL_WEBSITE_CLIENT_SECRET, dann erscheinen hier die Besucher.
			</p>
		{:else}
			{#await data.website}
				<p class="m-0 text-[14px] text-ink-500">Lädt Daten aus OpenPanel …</p>
			{:then website}
				{#if website.ok}
					{@const days = website.points.map((point) => point.day)}
					{@const monthly = days.length > 1 && days.every((day) => day.endsWith('-01'))}
					<LineChart
						label={monthly
							? 'Besucher der Landingpage pro Monat'
							: 'Besucher der Landingpage pro Tag'}
						keys={days}
						series={[
							{
								key: 'visitors',
								label: 'Besucher',
								color: 'ink',
								values: website.points.map((point) => point.visitors)
							}
						]}
						formatKey={monthly ? formatMonth : formatDayLabel}
						formatKeyLong={monthly ? formatMonth : formatDayLong}
						height={220}
					/>
				{:else}
					<Notice tone="error">OpenPanel antwortet nicht ({website.error}).</Notice>
				{/if}
			{/await}
		{/if}
	</Card>

	<Card title="Registrierungen">
		<ColumnChart
			label="Registrierungen pro Tag"
			points={data.signups.map((point) => ({ key: point.day, value: point.value }))}
			color="violet"
			formatKey={formatDayLabel}
			formatKeyLong={formatDayLong}
			height={220}
		/>
	</Card>
</section>

<section class="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
	<Card title="Aktive Nutzer" class="xl:col-span-2">
		<LineChart
			label="Aktive Nutzer pro Tag"
			keys={data.active.map((point) => point.day)}
			series={[
				{
					key: 'active',
					label: 'Aktive Nutzer',
					color: 'ink',
					values: data.active.map((point) => point.value)
				}
			]}
			formatKey={formatDayLabel}
			formatKeyLong={formatDayLong}
		/>
	</Card>

	<Card title="Funnel">
		{#if data.website}
			{#await data.website}
				<Funnel steps={data.funnel} />
			{:then website}
				<Funnel
					steps={website.ok
						? [
								{ key: 'visitors', label: 'Besucher Landingpage', value: website.visitors },
								...data.funnel
							]
						: data.funnel}
				/>
			{/await}
		{:else}
			<Funnel steps={data.funnel} />
		{/if}
	</Card>
</section>

<section class="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
	<Card title="Woher die Besucher kommen">
		{#snippet action()}
			<a href={landingpageHref} class="text-[14px] font-semibold text-violet-700">Landingpage</a>
		{/snippet}
		{#if !data.website}
			<p class="m-0 text-[14px] text-ink-500">Die Landingpage ist nicht verbunden.</p>
		{:else}
			{#await data.website}
				<p class="m-0 text-[14px] text-ink-500">Lädt Daten aus OpenPanel …</p>
			{:then website}
				{#if website.ok}
					<RankedBars
						color="ink"
						items={website.sources.map((row) => ({
							key: row.name ?? '',
							label: row.name ?? 'Direkt',
							value: row.sessions
						}))}
					/>
				{:else}
					<Notice tone="error">OpenPanel antwortet nicht ({website.error}).</Notice>
				{/if}
			{/await}
		{/if}
	</Card>

	<Card title="Heute in Konta">
		<dl class="m-0 grid grid-cols-1 divide-y divide-ink-100">
			{#each [{ label: 'Belege erfasst', value: k.receiptsToday }, { label: 'Rechnungen ausgestellt', value: k.invoicesIssuedToday }, { label: 'Einträge im Änderungsprotokoll', value: k.auditEventsToday }, { label: 'Nutzer gesamt', value: k.totalUsers }] as row (row.label)}
				<div class="flex items-baseline justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
					<dt class="text-[14px] text-ink-700">{row.label}</dt>
					<dd class="tnum m-0 text-[20px] font-semibold text-ink">{formatNumber(row.value)}</dd>
				</div>
			{/each}
		</dl>
	</Card>

	<Card title="Braucht Aufmerksamkeit">
		{#if alerts.length === 0}
			<p class="m-0 text-[14px] text-ink-500">Alles ruhig. Keine offenen Zahlungen oder Fehler.</p>
		{:else}
			<ul class="m-0 flex list-none flex-col gap-1 p-0">
				{#each alerts as alert (alert.label)}
					<li>
						<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- resolve() oben -->
						<a
							href={alert.href}
							class="-mx-2 flex items-center gap-3 rounded-md px-2 py-2 text-[14px] text-ink transition-colors hover:bg-violet-50"
						>
							<CircleAlert size={17} strokeWidth={1.75} class="shrink-0 text-error" />
							<span class="flex-1">{alert.label}</span>
							<Badge tone="error">{formatNumber(alert.value)}</Badge>
							<ChevronRight size={16} strokeWidth={1.75} class="text-ink-400" />
						</a>
					</li>
				{/each}
			</ul>
		{/if}
	</Card>
</section>

<section class="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
	<Card title="Neueste Registrierungen">
		{#snippet action()}
			<a href={resolve('/(admin)/nutzer')} class="text-[14px] font-semibold text-violet-700"
				>Alle Nutzer</a
			>
		{/snippet}
		<ul class="m-0 -mx-6 -mb-2 list-none divide-y divide-ink-100 p-0">
			{#each data.recentSignups as user (user.id)}
				<li class="flex items-center gap-3 px-6 py-3">
					<div class="min-w-0 flex-1">
						<UserCell
							id={user.id}
							firstName={user.firstName}
							lastName={user.lastName}
							secondary={[user.companyName, labelOf(LEAD_SOURCE_LABELS, user.leadSource, '')]
								.filter(Boolean)
								.join(' · ') || user.email}
						/>
					</div>
					<div class="hidden shrink-0 text-right sm:block">
						{#if user.onboardingCompletedAt}
							<SubscriptionBadge status={user.status} />
						{:else}
							<Badge tone="neutral">
								Onboarding: {labelOf(ONBOARDING_STEP_LABELS, user.onboardingStep, 'Start')}
							</Badge>
						{/if}
					</div>
					<span class="tnum w-[84px] shrink-0 text-right text-[12.5px] text-ink-500">
						{formatRelative(user.createdAt)}
					</span>
				</li>
			{/each}
		</ul>
	</Card>

	<Card title="Letzte Aktivität">
		{#snippet action()}
			<a href={resolve('/(admin)/aktivitaet')} class="text-[14px] font-semibold text-violet-700"
				>Alles ansehen</a
			>
		{/snippet}
		<ActivityList rows={data.feed} />
	</Card>
</section>
