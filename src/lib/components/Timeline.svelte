<script>
	/**
	 * Zusammengeführte Zeitleiste eines Nutzers. Filter nach Quelle,
	 * Gruppierung nach Tag, Änderungen aus dem Änderungsprotokoll aufklappbar
	 * als "vorher → nachher".
	 */
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import { formatDayHeading, formatNumber, formatTime, viennaDayKey } from '#lib/format.js';
	import { TIMELINE_SOURCE_LABELS, groupByDay } from '#lib/timeline.js';

	/**
	 * @type {{ items: import('#lib/timeline.js').TimelineItem[], loadingSources?: string[] }}
	 */
	let { items, loadingSources = [] } = $props();

	/** @type {'alle' | import('#lib/timeline.js').TimelineSource} */
	let source = $state('alle');
	let query = $state('');
	let limit = $state(80);

	const counts = $derived.by(() => {
		/** @type {Record<string, number>} */
		const out = {};
		for (const item of items) out[item.source] = (out[item.source] ?? 0) + 1;
		return out;
	});

	const sources = $derived(
		/** @type {(keyof typeof TIMELINE_SOURCE_LABELS)[]} */ (
			Object.keys(TIMELINE_SOURCE_LABELS)
		).filter((key) => (counts[key] ?? 0) > 0)
	);

	const filtered = $derived.by(() => {
		const needle = query.trim().toLowerCase();
		return items.filter(
			(item) =>
				(source === 'alle' || item.source === source) &&
				(!needle ||
					item.title.toLowerCase().includes(needle) ||
					(item.detail ?? '').toLowerCase().includes(needle) ||
					item.meta.some((meta) => meta.toLowerCase().includes(needle)))
		);
	});

	const groups = $derived(groupByDay(filtered.slice(0, limit), viennaDayKey));

	/** @type {Record<string, string>} */
	const DOT = {
		konto: 'bg-green',
		protokoll: 'bg-violet-700',
		login: 'bg-ink-400',
		nutzung: 'bg-ink',
		benachrichtigung: 'bg-violet-300'
	};

	const chipBase =
		'focus-ring inline-flex items-center gap-1.5 rounded-[7px] px-3 py-1.5 text-[13.5px] whitespace-nowrap transition-[background,color,box-shadow] duration-150';
</script>

<div class="flex flex-col gap-4">
	<div class="flex flex-col gap-3">
		<div class="inline-flex max-w-full overflow-x-auto" role="group" aria-label="Quelle">
			<div class="flex gap-0.5 rounded-md bg-ink-100/70 p-1">
				<button
					type="button"
					class="{chipBase} {source === 'alle'
						? 'bg-white font-semibold text-ink shadow-segment'
						: 'font-medium text-ink-500 hover:text-ink'}"
					aria-pressed={source === 'alle'}
					onclick={() => (source = 'alle')}
				>
					Alle <span class="tnum text-[12px] text-ink-400">{formatNumber(items.length)}</span>
				</button>
				{#each sources as key (key)}
					<button
						type="button"
						class="{chipBase} {source === key
							? 'bg-white font-semibold text-ink shadow-segment'
							: 'font-medium text-ink-500 hover:text-ink'}"
						aria-pressed={source === key}
						onclick={() => (source = key)}
					>
						<span class="size-2 rounded-full {DOT[key]}" aria-hidden="true"></span>
						{TIMELINE_SOURCE_LABELS[key]}
						<span class="tnum text-[12px] text-ink-400">{formatNumber(counts[key] ?? 0)}</span>
					</button>
				{/each}
			</div>
		</div>
		<input
			type="search"
			bind:value={query}
			placeholder="In der Zeitleiste suchen"
			aria-label="In der Zeitleiste suchen"
			class="h-control-sm w-full rounded-md border border-ink-200 bg-white px-3 text-[14px] text-ink outline-none placeholder:text-ink-400 focus:border-ink-400 focus:shadow-[var(--focus-ring)] sm:max-w-[320px]"
		/>
	</div>

	{#if loadingSources.length > 0}
		<p class="m-0 text-[13px] text-ink-500">Lädt noch: {loadingSources.join(', ')} …</p>
	{/if}

	{#if groups.length === 0}
		<p class="m-0 py-8 text-center text-[14px] text-ink-500">Keine Einträge.</p>
	{/if}

	{#each groups as group (group.day)}
		<section>
			<h4 class="text-label m-0 mb-2 text-ink-500">{formatDayHeading(group.items[0].at)}</h4>
			<ol class="m-0 list-none border-l border-ink-100 p-0 pl-5">
				{#each group.items as item (item.id)}
					<li class="relative py-2">
						<span
							class="absolute top-[15px] -left-[25px] size-2.5 rounded-full ring-4 ring-white {item.tone ===
							'error'
								? 'bg-error'
								: DOT[item.source]}"
							aria-hidden="true"
						></span>
						<div class="flex items-baseline justify-between gap-3">
							<p
								class="m-0 min-w-0 text-[14px] {item.tone === 'error' ? 'text-error' : 'text-ink'}"
							>
								{item.title}
							</p>
							<time
								class="tnum shrink-0 text-[12.5px] text-ink-500"
								datetime={item.at.toISOString()}
							>
								{formatTime(item.at)}
							</time>
						</div>
						{#if item.detail}
							<p class="m-0 mt-0.5 text-[13px] break-words text-ink-700">{item.detail}</p>
						{/if}
						<p class="m-0 mt-0.5 text-[12.5px] text-ink-500">
							{[TIMELINE_SOURCE_LABELS[item.source], ...item.meta].join(' · ')}
						</p>
						{#if item.changes.length > 0}
							<details class="group mt-1.5">
								<summary
									class="inline-flex cursor-pointer list-none items-center gap-1 text-[12.5px] font-semibold text-violet-700"
								>
									<ChevronRight
										size={14}
										strokeWidth={2}
										class="transition-transform group-open:rotate-90"
									/>
									{item.changes.length}
									{item.changes.length === 1 ? 'Änderung' : 'Änderungen'}
								</summary>
								<table class="mt-2 w-full border-collapse text-[12.5px]">
									<thead>
										<tr class="border-b border-ink/7">
											<th class="text-label py-1.5 pr-3 text-left font-semibold text-ink-500"
												>Feld</th
											>
											<th class="text-label py-1.5 pr-3 text-left font-semibold text-ink-500"
												>Vorher</th
											>
											<th class="text-label py-1.5 text-left font-semibold text-ink-500">Nachher</th
											>
										</tr>
									</thead>
									<tbody>
										{#each item.changes as change (change.field)}
											<tr class="border-b border-ink/7 last:border-b-0">
												<td class="py-1.5 pr-3 font-medium text-ink">{change.field}</td>
												<td class="py-1.5 pr-3 break-all text-ink-500">{change.from}</td>
												<td class="py-1.5 break-all text-ink">{change.to}</td>
											</tr>
										{/each}
									</tbody>
								</table>
							</details>
						{/if}
					</li>
				{/each}
			</ol>
		</section>
	{/each}

	{#if filtered.length > limit}
		<button
			type="button"
			class="focus-ring self-center rounded-md px-4 py-2 text-[14px] font-semibold text-ink hover:bg-violet-50"
			onclick={() => (limit += 80)}
		>
			Weitere {formatNumber(Math.min(80, filtered.length - limit))} anzeigen
		</button>
	{/if}
</div>
