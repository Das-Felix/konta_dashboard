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
	import Funnel from '#lib/components/charts/Funnel.svelte';
	import ActivityList from '#lib/components/ActivityList.svelte';
	import {
		changeRatio,
		formatDate,
		formatDayLabel,
		formatDayLong,
		formatEuro,
		formatNumber,
		formatRelative
	} from '#lib/format.js';
	import { LEAD_SOURCE_LABELS, ONBOARDING_STEP_LABELS, labelOf } from '#lib/labels.js';

	/** @type {import('./$types').PageProps} */
	let { data } = $props();

	const k = $derived(data.kpis);

	const rangeOptions = $derived(
		[7, 30, 90].map((days) => ({
			value: String(days),
			label: `${days} Tage`,
			href: resolve(`/(admin)?range=${days}`)
		}))
	);

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
</script>

<svelte:head>
	<title>Übersicht | Konta Admin</title>
</svelte:head>

<PageHeader eyebrow={formatDate(new Date())} title="Übersicht." />

<section class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Kennzahlen">
	<StatCard
		label="Nutzer gesamt"
		value={formatNumber(k.totalUsers)}
		hint="{formatNumber(k.signups7d)} neu in 7 Tagen · {formatNumber(
			k.onboardedUsers
		)} mit Onboarding"
		href={resolve('/(admin)/nutzer')}
	/>
	<StatCard
		label="Registrierungen heute"
		value={formatNumber(k.signupsToday)}
		change={changeRatio(k.signupsToday, k.signupsYesterday)}
		changeLabel="Gestern: {formatNumber(k.signupsYesterday)}"
		series={data.signups14.map((point) => point.value)}
		href={resolve('/(admin)/wachstum')}
	/>
	<StatCard
		label="Aktive Nutzer heute"
		value={formatNumber(k.activeToday)}
		change={changeRatio(k.active7d, k.activePrev7d)}
		hint="{formatNumber(k.active7d)} in 7 Tagen · {formatNumber(k.active30d)} in 30 Tagen"
		changeLabel="7 Tage gegenüber den 7 Tagen davor"
		href={resolve('/(admin)/nutzung')}
	/>
	<StatCard
		label="MRR netto"
		value={formatEuro(k.mrr, { whole: true })}
		hint="{formatNumber(k.paying)} zahlend · {formatNumber(k.trialing)} im Test"
		href={resolve('/(admin)/abos')}
	/>
</section>

<section class="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
	<Card title="Registrierungen und aktive Nutzer" class="xl:col-span-2">
		{#snippet action()}
			<SegmentedLinks label="Zeitraum" options={rangeOptions} value={String(data.range)} />
		{/snippet}
		<LineChart
			label="Registrierungen und aktive Nutzer pro Tag"
			keys={data.active.map((point) => point.day)}
			series={[
				{
					key: 'active',
					label: 'Aktive Nutzer',
					color: 'ink',
					values: data.active.map((point) => point.value)
				},
				{
					key: 'signups',
					label: 'Registrierungen',
					color: 'violet',
					values: data.signups.map((point) => point.value)
				}
			]}
			formatKey={formatDayLabel}
			formatKeyLong={formatDayLong}
		/>
	</Card>

	<Card title="Trichter ({data.range} Tage)">
		<Funnel steps={data.funnel} />
	</Card>
</section>

<section class="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
	<Card title="Heute in Konta">
		<dl class="m-0 grid grid-cols-1 divide-y divide-ink-100">
			{#each [{ label: 'Belege erfasst', value: k.receiptsToday }, { label: 'Rechnungen ausgestellt', value: k.invoicesIssuedToday }, { label: 'Einträge im Änderungsprotokoll', value: k.auditEventsToday }, { label: 'Neue Konten', value: k.signupsToday }] as row (row.label)}
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

	<Card title="Besucher (OpenPanel)">
		{#if !data.openPanelConfigured}
			<p class="m-0 text-[14px] text-ink-500">
				OpenPanel ist nicht verbunden. Setz die OPENPANEL-Variablen, dann erscheinen hier Besucher,
				Sessions und Seitenaufrufe.
			</p>
		{:else}
			{#await data.visitors}
				<p class="m-0 text-[14px] text-ink-500">Lädt Daten aus OpenPanel …</p>
			{:then result}
				{#if result?.ok}
					<dl class="m-0 grid grid-cols-1 divide-y divide-ink-100">
						{#each [['Besucher', 0], ['Sessions', 2], ['Seitenaufrufe', 1]] as [label, index] (label)}
							<div class="flex items-baseline justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
								<dt class="text-[14px] text-ink-700">{label} ({data.range} Tage)</dt>
								<dd class="tnum m-0 text-[20px] font-semibold text-ink">
									{formatNumber(result.data[Number(index)]?.total ?? 0)}
								</dd>
							</div>
						{/each}
					</dl>
					<a
						href={resolve('/(admin)/analytics')}
						class="mt-3 inline-block text-[14px] font-semibold text-violet-700">Zu Analytics</a
					>
				{:else}
					<Notice tone="error">OpenPanel antwortet nicht ({result?.error}).</Notice>
				{/if}
			{/await}
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
