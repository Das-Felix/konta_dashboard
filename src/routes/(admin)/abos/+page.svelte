<script>
	import { resolve } from '$app/paths';
	import Card from '#lib/components/ui/Card.svelte';
	import PageHeader from '#lib/components/ui/PageHeader.svelte';
	import StatCard from '#lib/components/ui/StatCard.svelte';
	import UserCell from '#lib/components/ui/UserCell.svelte';
	import SubscriptionBadge from '#lib/components/ui/SubscriptionBadge.svelte';
	import Badge from '#lib/components/ui/Badge.svelte';
	import StackBar from '#lib/components/charts/StackBar.svelte';
	import {
		formatDateShort,
		formatEuro,
		formatNumber,
		formatPercent,
		formatRelative
	} from '#lib/format.js';
	import { INTERVAL_LABELS, PLAN_LABELS, SUBSCRIPTION_STATUS } from '#lib/labels.js';

	/** @type {import('./$types').PageProps} */
	let { data } = $props();

	const s = $derived(data.summary);
	const paying = $derived(s.plans.reduce((sum, row) => sum + row.count, 0));
	const conversionRate = $derived(s.trialsEnded ? s.trialsConverted / s.trialsEnded : null);

	// Status-Farben nach App-Regel: bezahlt grün, laufend violett, Fehler rot, Rest neutral.
	const STATUS_COLORS = {
		ACTIVE: 'var(--green)',
		TRIALING: 'var(--violet-700)',
		PAST_DUE: 'var(--error)',
		TRIAL_EXPIRED: 'var(--ink-200)',
		CANCELED: 'var(--ink-400)'
	};

	/** @type {Record<string, string>} */
	const STATUS_FILTER = {
		ACTIVE: 'zahlend',
		TRIALING: 'test',
		PAST_DUE: 'zahlung_offen',
		TRIAL_EXPIRED: 'abgelaufen',
		CANCELED: 'gekuendigt'
	};

	const headClass = 'text-label px-4 py-3 text-left font-semibold whitespace-nowrap text-ink-500';
</script>

<svelte:head>
	<title>Abos | Konta Admin</title>
</svelte:head>

<PageHeader
	title="Abos."
	description="Wiederkehrender Umsatz, Tests und Abos mit Handlungsbedarf. Beträge netto, Jahresabos zählen mit einem Zwölftel."
/>

<section class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
	<StatCard
		label="MRR netto"
		value={formatEuro(s.mrr, { whole: true })}
		hint="{formatEuro(s.mrr * 12, { whole: true })} im Jahr"
	/>
	<StatCard
		label="Zahlende Abos"
		value={formatNumber(paying)}
		hint="{formatNumber(s.canceling)} gekündigt zum Periodenende"
	/>
	<StatCard
		label="Im Test"
		value={formatNumber(s.statusCounts.TRIALING ?? 0)}
		hint="{formatNumber(data.endingSoon.length)} enden in 7 Tagen"
	/>
	<StatCard
		label="Test zu Abo"
		value={formatPercent(conversionRate)}
		hint="{formatNumber(s.trialsConverted)} von {formatNumber(s.trialsEnded)} beendeten Tests"
	/>
</section>

<section class="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
	<Card title="Status aller Unternehmen">
		<StackBar
			label="Abo-Status"
			segments={Object.entries(STATUS_COLORS).map(([key, color]) => ({
				key,
				label: SUBSCRIPTION_STATUS[key]?.label ?? key,
				value: s.statusCounts[key] ?? 0,
				color,
				href: resolve(`/(admin)/nutzer?filter=${STATUS_FILTER[key]}`)
			}))}
		/>
	</Card>

	<Card title="Zahlende Abos nach Tarif">
		<table class="w-full border-collapse text-[14px]">
			<thead>
				<tr class="border-b border-ink/7">
					<th class="text-label py-2 text-left font-semibold text-ink-500">Tarif</th>
					<th class="text-label py-2 text-left font-semibold text-ink-500">Abrechnung</th>
					<th class="text-label py-2 text-right font-semibold text-ink-500">Abos</th>
					<th class="text-label py-2 text-right font-semibold text-ink-500">MRR</th>
				</tr>
			</thead>
			<tbody>
				{#each s.plans.toSorted((a, b) => b.mrr - a.mrr) as row (`${row.plan}-${row.interval}`)}
					<tr class="border-b border-ink/7 last:border-b-0">
						<td class="py-2.5 text-ink">{PLAN_LABELS[row.plan] ?? row.plan}</td>
						<td class="py-2.5 text-ink-700">{INTERVAL_LABELS[row.interval] ?? row.interval}</td>
						<td class="tnum py-2.5 text-right text-ink">{formatNumber(row.count)}</td>
						<td class="tnum py-2.5 text-right font-semibold text-ink">{formatEuro(row.mrr)}</td>
					</tr>
				{:else}
					<tr
						><td colspan="4" class="py-6 text-center text-ink-500">Noch keine zahlenden Abos.</td
						></tr
					>
				{/each}
			</tbody>
		</table>
	</Card>
</section>

<section class="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
	<Card title="Tests, die in 7 Tagen enden">
		<p class="m-0 mb-3 text-[13.5px] text-ink-500">
			Wer viele Belege hat, braucht eine Erinnerung. Wer nichts gemacht hat, eher ein Gespräch.
		</p>
		<ul class="m-0 list-none divide-y divide-ink-100 p-0">
			{#each data.endingSoon as row (row.id)}
				<li class="flex items-center gap-3 py-3">
					<div class="min-w-0 flex-1">
						<UserCell
							id={row.id}
							firstName={row.firstName}
							lastName={row.lastName}
							secondary={row.companyName ?? row.email}
						/>
					</div>
					<span class="tnum hidden text-[13px] text-ink-500 sm:block">
						{formatNumber(row.documents)} Dokumente
					</span>
					<Badge tone={row.documents > 5 ? 'soft' : 'neutral'}
						>{formatRelative(row.trialEndsAt)}</Badge
					>
				</li>
			{:else}
				<li class="py-6 text-center text-[14px] text-ink-500">
					Keine Tests enden in den nächsten 7 Tagen.
				</li>
			{/each}
		</ul>
	</Card>

	<Card title="Handlungsbedarf">
		<ul class="m-0 list-none divide-y divide-ink-100 p-0">
			{#each data.atRisk as row (row.id)}
				<li class="flex items-center gap-3 py-3">
					<div class="min-w-0 flex-1">
						<UserCell
							id={row.id}
							firstName={row.firstName}
							lastName={row.lastName}
							secondary={row.companyName ?? row.email}
						/>
					</div>
					<span class="tnum hidden text-[13px] text-ink-500 sm:block">
						{row.cancelAtPeriodEnd
							? `endet ${formatDateShort(row.currentPeriodEnd)}`
							: (PLAN_LABELS[row.plan] ?? row.plan)}
					</span>
					{#if row.status === 'PAST_DUE'}
						<SubscriptionBadge status={row.status} />
					{:else}
						<Badge tone="neutral">Gekündigt</Badge>
					{/if}
				</li>
			{:else}
				<li class="py-6 text-center text-[14px] text-ink-500">
					Keine offenen Zahlungen oder Kündigungen.
				</li>
			{/each}
		</ul>
	</Card>
</section>

<section class="mt-4">
	<Card title="Zuletzt zahlend geworden (30 Tage)">
		<p class="m-0 mb-3 text-[13.5px] text-ink-500">Zeitpunkt laut letztem Stripe-Abgleich.</p>
		<div class="overflow-x-auto">
			<table class="w-full border-collapse text-[14px]">
				<thead>
					<tr class="border-b border-ink/7">
						<th class={headClass}>Nutzer</th>
						<th class={headClass}>Tarif</th>
						<th class={headClass}>Abrechnung</th>
						<th class={headClass}>Seit</th>
					</tr>
				</thead>
				<tbody>
					{#each data.conversions as row (row.id)}
						<tr class="border-b border-ink/7 last:border-b-0">
							<td class="px-4 py-2.5"
								><UserCell
									id={row.id}
									firstName={row.firstName}
									lastName={row.lastName}
									secondary={row.companyName}
								/></td
							>
							<td class="px-4 py-2.5 text-ink">{PLAN_LABELS[row.plan] ?? row.plan}</td>
							<td class="px-4 py-2.5 text-ink-700">{INTERVAL_LABELS[row.billingInterval] ?? '—'}</td
							>
							<td class="tnum px-4 py-2.5 text-ink-700">{formatRelative(row.converted_at)}</td>
						</tr>
					{:else}
						<tr
							><td colspan="4" class="py-6 text-center text-ink-500"
								>Keine neuen Abos in den letzten 30 Tagen.</td
							></tr
						>
					{/each}
				</tbody>
			</table>
		</div>
	</Card>
</section>
