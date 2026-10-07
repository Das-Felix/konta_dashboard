<script>
	import { resolve } from '$app/paths';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import Mail from '@lucide/svelte/icons/mail';
	import Phone from '@lucide/svelte/icons/phone';
	import ShieldCheck from '@lucide/svelte/icons/shield-check';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import Card from '#lib/components/ui/Card.svelte';
	import Badge from '#lib/components/ui/Badge.svelte';
	import Avatar from '#lib/components/ui/Avatar.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import Notice from '#lib/components/ui/Notice.svelte';
	import CopyButton from '#lib/components/ui/CopyButton.svelte';
	import SubscriptionBadge from '#lib/components/ui/SubscriptionBadge.svelte';
	import UserCell from '#lib/components/ui/UserCell.svelte';
	import Timeline from '#lib/components/Timeline.svelte';
	import ActivityCalendar from '#lib/components/charts/ActivityCalendar.svelte';
	import { CARD_CLASS } from '#lib/components/ui/card.js';
	import { buildTimeline } from '#lib/timeline.js';
	import {
		describeUserAgent,
		formatDate,
		formatDateShort,
		formatDateTime,
		formatEuro,
		formatNumber,
		formatRelative
	} from '#lib/format.js';
	import {
		CURRENT_TOOL_LABELS,
		GUIDE_STEP_LABELS,
		INTERVAL_LABELS,
		LEAD_SOURCE_LABELS,
		LOGIN_RESULT,
		ONBOARDING_STEP_LABELS,
		ONBOARDING_STEPS,
		PLAN_LABELS,
		UVA_PERIOD_LABELS,
		VAT_MODE_LABELS,
		labelOf
	} from '#lib/labels.js';
	import { monthlyRevenue } from '#lib/plans.js';

	/** @type {import('./$types').PageProps} */
	let { data } = $props();

	const u = $derived(data.user);
	const c = $derived(data.counts);
	const name = $derived(`${u.firstName} ${u.lastName}`.trim());

	const lastActive = $derived.by(() => {
		const candidates = [
			...data.sessions.map((session) => session.lastActiveAt),
			...data.logins.filter((login) => login.success).map((login) => login.createdAt),
			...data.audit.filter((entry) => entry.userId === u.id).map((entry) => entry.createdAt)
		].filter(Boolean);
		return candidates.length > 0
			? new Date(Math.max(...candidates.map((date) => date.getTime())))
			: null;
	});

	/** Basis-Zeitleiste aus der DB; OpenPanel wird ergänzt, sobald es da ist. */
	const dbSources = $derived({
		user: /** @type {import('#lib/timeline.js').TimelineUser} */ (u),
		audit: data.audit,
		logins: data.logins,
		notifications: data.notifications
	});

	const failedLogins24h = $derived(
		data.logins.filter(
			(login) => !login.success && Date.now() - login.createdAt.getTime() < 86_400_000
		).length
	);

	const guideByStep = $derived(new Map(data.guide.map((row) => [row.step, row])));

	const onboardingIndex = $derived(
		u.onboardingCompletedAt
			? ONBOARDING_STEPS.length
			: ONBOARDING_STEPS.indexOf(u.onboardingStep ?? 'steuerstatus')
	);

	const problems = $derived(
		[
			...data.failedExtractions.map((row) => ({
				id: `ex-${row.id}`,
				at: row.createdAt,
				title: `Belegerkennung fehlgeschlagen${row.originalFilename ? `: ${row.originalFilename}` : ''}`,
				detail: row.extractionError
			})),
			...data.failedRuns.map((row) => ({
				id: `run-${row.id}`,
				at: row.scheduledFor,
				title: `Dauerrechnung „${row.name}“ fehlgeschlagen`,
				detail: row.error
			})),
			...data.notifications
				.filter((row) => row.emailError)
				.map((row) => ({
					id: `mail-${row.id}`,
					at: row.createdAt,
					title: `Mail nicht zugestellt: ${row.title}`,
					detail: row.emailError
				}))
		].sort((a, b) => b.at.getTime() - a.at.getTime())
	);

	const usage = $derived([
		{
			label: 'Belege hochgeladen',
			value: c.receipts_uploaded,
			hint: c.receipts_pending ? `${formatNumber(c.receipts_pending)} offen` : ''
		},
		{ label: 'Belege manuell', value: c.receipts_manual },
		{
			label: 'Rechnungen ausgestellt',
			value: c.invoices_issued,
			hint: c.invoices_draft ? `${formatNumber(c.invoices_draft)} Entwürfe` : ''
		},
		{ label: 'E-Rechnungen', value: c.einvoices },
		{ label: 'Angebote', value: c.offers },
		{ label: 'Mahnungen', value: c.dunnings },
		{ label: 'Kontakte', value: c.contacts },
		{ label: 'Produkte', value: c.products },
		{ label: 'Dauerrechnungen aktiv', value: c.recurring_active },
		{ label: 'Anlagen', value: c.assets },
		{ label: 'Fahrzeuge', value: c.vehicles },
		{ label: 'Fahrten', value: c.trips }
	]);
</script>

<svelte:head>
	<title>{name} | Konta Admin</title>
</svelte:head>

{#snippet row(/** @type {string} */ label, /** @type {string | null | undefined} */ value)}
	<div class="flex items-baseline justify-between gap-4 py-2 first:pt-0 last:pb-0">
		<dt class="shrink-0 text-[13.5px] text-ink-500">{label}</dt>
		<dd class="m-0 min-w-0 text-right text-[14px] break-words text-ink">{value || '—'}</dd>
	</div>
{/snippet}

<a
	href={resolve('/(admin)/nutzer')}
	class="mb-4 inline-flex items-center gap-1.5 text-[14px] font-medium text-ink-700 hover:text-ink"
>
	<ArrowLeft size={16} strokeWidth={1.75} /> Alle Nutzer
</a>

<!-- Kopf -->
<section
	class="{CARD_CLASS} mb-4 flex flex-col gap-5 px-6 py-6 lg:flex-row lg:items-center lg:justify-between"
>
	<div class="flex min-w-0 items-center gap-4">
		<Avatar firstName={u.firstName} lastName={u.lastName} size={56} />
		<div class="min-w-0">
			<h1 class="text-[26px] md:text-[30px]">{name}</h1>
			<div class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[14px] text-ink-700">
				<span class="inline-flex items-center gap-1">
					<Mail size={15} strokeWidth={1.75} class="text-ink-400" />{u.email}<CopyButton
						value={u.email}
						label="E-Mail kopieren"
					/>
				</span>
				{#if u.phone}
					<span class="inline-flex items-center gap-1">
						<Phone size={15} strokeWidth={1.75} class="text-ink-400" />{u.phone}<CopyButton
							value={u.phone}
							label="Telefonnummer kopieren"
						/>
					</span>
				{/if}
				<span class="inline-flex items-center gap-1 text-[12.5px] text-ink-500">
					ID {u.id}<CopyButton value={u.id} label="ID kopieren" />
				</span>
			</div>
			<div class="mt-2.5 flex flex-wrap items-center gap-2">
				<SubscriptionBadge status={u.status} plan={u.plan} showPlan />
				<Badge tone="neutral">{labelOf(VAT_MODE_LABELS, u.vatMode)}</Badge>
				{#if !u.emailVerifiedAt}<Badge tone="error">E-Mail nicht bestätigt</Badge>{/if}
				{#if !u.onboardingCompletedAt}<Badge tone="neutral">Onboarding offen</Badge>{/if}
				{#if u.twoFactorEnabled}
					<Badge tone="soft"><ShieldCheck size={13} strokeWidth={2} /> 2FA</Badge>
				{/if}
				{#if u.experimental}<Badge tone="ink">Experimentell</Badge>{/if}
				{#if u.companyRole !== 'OWNER'}<Badge tone="neutral">Mitglied</Badge>{/if}
			</div>
		</div>
	</div>
	<div class="flex flex-wrap gap-2 lg:justify-end">
		<Button variant="secondary" size="sm" icon={Mail} href="mailto:{u.email}">Mail schreiben</Button
		>
		{#if data.openPanel.profileUrl}
			<Button
				variant="secondary"
				size="sm"
				icon={ExternalLink}
				href={data.openPanel.profileUrl}
				target="_blank"
				rel="noopener noreferrer"
			>
				OpenPanel
			</Button>
		{/if}
		{#if u.stripeCustomerId}
			<Button
				variant="secondary"
				size="sm"
				icon={ExternalLink}
				href="https://dashboard.stripe.com/customers/{u.stripeCustomerId}"
				target="_blank"
				rel="noopener noreferrer"
			>
				Stripe
			</Button>
		{/if}
	</div>
</section>

<!-- Eckdaten -->
<section class="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4" aria-label="Eckdaten">
	{#each [{ label: 'Registriert', value: formatDate(u.createdAt), hint: `seit ${formatNumber(Math.floor((Date.now() - u.createdAt.getTime()) / 86_400_000))} Tagen` }, { label: 'Zuletzt aktiv', value: lastActive ? formatRelative(lastActive) : '—', hint: lastActive ? formatDateTime(lastActive) : 'Keine Aktivität gespeichert' }, { label: 'Belege', value: formatNumber(c.receipts_uploaded + c.receipts_manual), hint: `${formatNumber(c.receipts_pending)} warten auf Bestätigung` }, { label: 'Rechnungen', value: formatNumber(c.invoices_issued), hint: `${formatNumber(c.offers)} Angebote · ${formatNumber(c.contacts)} Kontakte` }] as tile (tile.label)}
		<div class="{CARD_CLASS} flex min-w-0 flex-col gap-2 px-5 py-4">
			<span class="text-label text-ink-500">{tile.label}</span>
			<span class="tnum truncate text-[22px] leading-tight font-semibold text-ink"
				>{tile.value}</span
			>
			<span class="truncate text-[12.5px] text-ink-500">{tile.hint}</span>
		</div>
	{/each}
</section>

{#if problems.length > 0 || failedLogins24h > 2}
	<Notice tone="error" title="Auffälligkeiten" class="mb-4">
		<ul class="m-0 mt-1 list-none p-0">
			{#if failedLogins24h > 2}
				<li>{failedLogins24h} fehlgeschlagene Anmeldungen in den letzten 24 Stunden.</li>
			{/if}
			{#each problems.slice(0, 5) as problem (problem.id)}
				<li>
					{formatDateShort(problem.at)}: {problem.title}{problem.detail
						? ` (${problem.detail})`
						: ''}
				</li>
			{/each}
		</ul>
	</Notice>
{/if}

<div class="grid grid-cols-1 gap-4 xl:grid-cols-3">
	<!-- Zeitleiste -->
	<div class="flex min-w-0 flex-col gap-4 xl:col-span-2">
		<Card title="Aktivität (90 Tage)">
			<ActivityCalendar days={data.dailyActivity} />
		</Card>

		<Card title="Zeitleiste">
			{#snippet action()}
				<span class="text-[12.5px] text-ink-500">Datenbank und OpenPanel zusammengeführt</span>
			{/snippet}
			{#if data.openPanel.result}
				{#await data.openPanel.result}
					<Timeline items={buildTimeline(dbSources)} loadingSources={['OpenPanel']} />
				{:then op}
					{#if !op.ok}
						<Notice tone="error" class="mb-4"
							>OpenPanel antwortet nicht ({op.error}). Gezeigt wird nur, was in der Datenbank steht.</Notice
						>
					{/if}
					<Timeline items={buildTimeline({ ...dbSources, events: op.ok ? op.events : [] })} />
				{/await}
			{:else}
				<Timeline items={buildTimeline(dbSources)} />
			{/if}
		</Card>
	</div>

	<!-- Seitenspalte -->
	<div class="flex min-w-0 flex-col gap-4">
		<Card title="Abo">
			<dl class="m-0 divide-y divide-ink-100">
				<div class="flex items-center justify-between gap-4 pb-2">
					<dt class="text-[13.5px] text-ink-500">Status</dt>
					<dd class="m-0"><SubscriptionBadge status={u.status} /></dd>
				</div>
				{@render row('Tarif', labelOf(PLAN_LABELS, u.plan))}
				{@render row('Abrechnung', labelOf(INTERVAL_LABELS, u.billingInterval))}
				{#if u.status === 'ACTIVE' || u.status === 'PAST_DUE'}
					{@render row('MRR netto', formatEuro(monthlyRevenue(u.plan, u.billingInterval)))}
				{/if}
				{@render row(
					u.status === 'TRIALING' ? 'Test endet' : 'Test endete',
					u.trialEndsAt
						? u.status === 'TRIALING'
							? `${formatDateShort(u.trialEndsAt)}, ${formatRelative(u.trialEndsAt)}`
							: formatDateShort(u.trialEndsAt)
						: null
				)}
				{#if u.currentPeriodEnd}{@render row(
						'Periode endet',
						formatDateShort(u.currentPeriodEnd)
					)}{/if}
				{#if u.cancelAtPeriodEnd}{@render row('Kündigung', 'zum Periodenende')}{/if}
				{#if u.stripeCustomerId}{@render row('Stripe-Kunde', u.stripeCustomerId)}{/if}
				{#if u.stripeSyncedAt}{@render row(
						'Letzter Abgleich',
						`${formatDateTime(u.stripeSyncedAt)} · ${u.lastSyncSource ?? ''}`
					)}{/if}
			</dl>
		</Card>

		<Card title="Unternehmen">
			<dl class="m-0 divide-y divide-ink-100">
				{@render row('Name', u.companyName)}
				{@render row(
					'Adresse',
					[u.street, [u.postalCode, u.city].filter(Boolean).join(' '), u.country]
						.filter(Boolean)
						.join(', ')
				)}
				{@render row('Steuerstatus', labelOf(VAT_MODE_LABELS, u.vatMode))}
				{#if u.vatMode === 'REGELBESTEUERT'}
					{@render row('UVA', labelOf(UVA_PERIOD_LABELS, u.uvaPeriod))}
					{@render row('Besteuerung', u.uvaTaxPointMethod === 'SOLLBESTEUERUNG' ? 'Soll' : 'Ist')}
				{/if}
				{@render row('UID', u.vatId)}
				{@render row('Steuernummer', u.taxNumber)}
				{@render row('Geschäftsmail', u.companyEmail)}
				{@render row('IBAN hinterlegt', u.iban ? 'ja' : 'nein')}
				{@render row('Eigener Mailversand', c.smtp_configured ? 'eingerichtet' : 'nein')}
				{@render row('Vorlagen', formatNumber(c.templates))}
			</dl>
			{#if data.teammates.length > 0}
				<p class="text-label m-0 mt-5 mb-2 text-ink-500">Weitere Nutzer im Unternehmen</p>
				<ul class="m-0 flex list-none flex-col gap-2 p-0">
					{#each data.teammates as mate (mate.id)}
						<li>
							<UserCell
								id={mate.id}
								firstName={mate.firstName}
								lastName={mate.lastName}
								secondary={mate.email}
							/>
						</li>
					{/each}
				</ul>
			{/if}
		</Card>

		<Card title="Onboarding und Umfrage">
			<ol class="m-0 mb-4 flex list-none gap-1 p-0" aria-label="Onboarding-Fortschritt">
				{#each ONBOARDING_STEPS as step, index (step)}
					<li
						class="h-1.5 flex-1 rounded-full {index < onboardingIndex
							? 'bg-ink'
							: index === onboardingIndex
								? 'bg-violet-300'
								: 'bg-ink-100'}"
						title={ONBOARDING_STEP_LABELS[step]}
					></li>
				{/each}
			</ol>
			<dl class="m-0 divide-y divide-ink-100">
				{@render row(
					'Status',
					u.onboardingCompletedAt
						? `Fertig am ${formatDateShort(u.onboardingCompletedAt)}`
						: `Hängt bei: ${labelOf(ONBOARDING_STEP_LABELS, u.onboardingStep, 'Start')}`
				)}
				{@render row(
					'E-Mail bestätigt',
					u.emailVerifiedAt ? formatDateTime(u.emailVerifiedAt) : 'nein'
				)}
				{@render row(
					'Gefunden über',
					u.leadSource
						? `${labelOf(LEAD_SOURCE_LABELS, u.leadSource)}${u.leadSourceOther ? ` (${u.leadSourceOther})` : ''}`
						: null
				)}
				{@render row(
					'Bisher genutzt',
					u.currentTool
						? `${labelOf(CURRENT_TOOL_LABELS, u.currentTool)}${u.currentToolOther ? ` (${u.currentToolOther})` : ''}`
						: null
				)}
				{@render row(
					'Steuerberatung',
					u.hasTaxAdvisor === null || u.hasTaxAdvisor === undefined
						? null
						: u.hasTaxAdvisor
							? 'ja'
							: 'nein'
				)}
				{@render row(
					'Post von Konta',
					u.marketingConsentAt ? `zugestimmt am ${formatDateShort(u.marketingConsentAt)}` : 'nein'
				)}
			</dl>
			<p class="text-label m-0 mt-5 mb-2 text-ink-500">Leitfaden</p>
			<ul class="m-0 flex list-none flex-col gap-1.5 p-0 text-[14px]">
				{#each Object.entries(GUIDE_STEP_LABELS) as [step, label] (step)}
					{@const state = guideByStep.get(step)?.state}
					<li class="flex items-center justify-between gap-3">
						<span class={state === 'DONE' ? 'text-ink' : 'text-ink-500'}>{label}</span>
						<Badge tone={state === 'DONE' ? 'green' : 'neutral'} size="md">
							{state === 'DONE' ? 'Erledigt' : state === 'DISMISSED' ? 'Übersprungen' : 'Offen'}
						</Badge>
					</li>
				{/each}
			</ul>
			{#if u.guideDismissedAt}
				<p class="m-0 mt-3 text-[12.5px] text-ink-500">
					Leitfaden ausgeblendet am {formatDateShort(u.guideDismissedAt)}.
				</p>
			{/if}
		</Card>

		<Card title="Nutzung (OpenPanel)">
			{#if !data.openPanel.configured}
				<p class="m-0 text-[14px] text-ink-500">OpenPanel ist nicht verbunden.</p>
			{:else}
				{#await data.openPanel.result}
					<p class="m-0 text-[14px] text-ink-500">Lädt …</p>
				{:then op}
					{#if op?.ok && op.summary}
						{@const s = op.summary}
						<dl class="m-0 divide-y divide-ink-100">
							{@render row('Zuerst gesehen', formatDateTime(s.firstSeen))}
							{@render row('Zuletzt gesehen', `${formatRelative(s.lastSeen)}`)}
							{@render row('Sessions (90 Tage)', formatNumber(s.sessions))}
							{@render row('Seitenaufrufe', formatNumber(s.screenViews))}
							{@render row('Ereignisse', formatNumber(op.total))}
							{@render row('Browser', s.browsers.slice(0, 3).join(', '))}
							{@render row('System', s.os.slice(0, 3).join(', '))}
							{@render row('Gerät', s.devices.slice(0, 3).join(', '))}
							{@render row('Ort', s.locations.slice(0, 2).join(' · '))}
							{@render row('Herkunft', s.referrers.slice(0, 2).join(', '))}
						</dl>
						{#if s.topPages.length > 0}
							<p class="text-label m-0 mt-5 mb-2 text-ink-500">Meistbesuchte Seiten</p>
							<ul class="m-0 flex list-none flex-col gap-1 p-0 text-[13.5px]">
								{#each s.topPages as pageRow (pageRow.path)}
									<li class="flex justify-between gap-3">
										<span class="truncate text-ink">{pageRow.path}</span>
										<span class="tnum text-ink-500">{formatNumber(pageRow.value)}</span>
									</li>
								{/each}
							</ul>
						{/if}
					{:else if op?.ok}
						<p class="m-0 text-[14px] text-ink-500">Keine Ereignisse in den letzten 90 Tagen.</p>
					{:else}
						<p class="m-0 text-[14px] text-error">OpenPanel antwortet nicht ({op?.error}).</p>
					{/if}
				{/await}
			{/if}
		</Card>

		<Card title="Geräte und Sessions">
			{#if data.sessions.length === 0}
				<p class="m-0 text-[14px] text-ink-500">Keine aktiven Sessions.</p>
			{:else}
				<ul class="m-0 list-none divide-y divide-ink-100 p-0">
					{#each data.sessions as session (session.id)}
						<li class="flex items-baseline justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
							<span class="min-w-0">
								<span class="block truncate text-[14px] text-ink"
									>{describeUserAgent(session.userAgent)}</span
								>
								<span class="tnum block text-[12.5px] text-ink-500"
									>{session.ipAddress ?? 'IP unbekannt'} · seit {formatDateShort(
										session.createdAt
									)}</span
								>
							</span>
							<span class="tnum shrink-0 text-[12.5px] text-ink-500"
								>{formatRelative(session.lastActiveAt)}</span
							>
						</li>
					{/each}
				</ul>
			{/if}
			<p class="text-label m-0 mt-5 mb-2 text-ink-500">Letzte Anmeldungen</p>
			<ul class="m-0 list-none divide-y divide-ink-100 p-0">
				{#each data.logins.slice(0, 6) as login (login.id)}
					{@const result = LOGIN_RESULT[login.result] ?? { label: login.result, tone: 'neutral' }}
					<li class="flex items-center justify-between gap-3 py-2 text-[13px]">
						<span class="tnum text-ink-700">{formatDateTime(login.createdAt)}</span>
						<span
							class="inline-flex items-center gap-1.5 {login.success
								? 'text-ink-500'
								: 'text-error'}"
						>
							{#if !login.success}<CircleAlert size={14} strokeWidth={1.75} />{/if}
							{result.label}
						</span>
					</li>
				{:else}
					<li class="py-2 text-[13px] text-ink-500">Keine Anmeldungen gespeichert.</li>
				{/each}
			</ul>
		</Card>

		<Card title="Funktionen">
			<dl class="m-0 grid grid-cols-2 gap-x-4 gap-y-3">
				{#each usage as item (item.label)}
					<div class="min-w-0">
						<dt class="truncate text-[12.5px] text-ink-500">{item.label}</dt>
						<dd
							class="tnum m-0 text-[17px] font-semibold {item.value > 0
								? 'text-ink'
								: 'text-ink-300'}"
						>
							{formatNumber(item.value)}
							{#if item.hint}<span class="text-[12px] font-normal text-ink-500">{item.hint}</span
								>{/if}
						</dd>
					</div>
				{/each}
			</dl>
		</Card>
	</div>
</div>
