<script>
	/**
	 * Aktivität eines Nutzers der letzten Wochen als Kalenderraster
	 * (Spalten = Wochen, Zeilen = Mo bis So). Sequenzielle Skala in Violett,
	 * leere Tage `ink-100`.
	 */
	import { formatDayLong, formatNumber, viennaDayKey } from '#lib/format.js';

	/**
	 * @type {{ days: { day: string, value: number }[], weeks?: number }}
	 */
	let { days, weeks = 13 } = $props();

	const STEPS = [
		'var(--ink-100)',
		'var(--violet-100)',
		'var(--violet-200)',
		'var(--violet-300)',
		'var(--violet-700)'
	];

	const grid = $derived.by(() => {
		const values = new Map(days.map((entry) => [entry.day, entry.value]));
		const max = Math.max(1, ...days.map((entry) => entry.value));
		const today = new Date(`${viennaDayKey(new Date())}T12:00:00Z`);
		const weekday = (today.getUTCDay() + 6) % 7;
		const start = new Date(today.getTime() - ((weeks - 1) * 7 + weekday) * 86_400_000);
		/** @type {{ day: string, value: number, level: number, future: boolean }[][]} */
		const columns = [];
		for (let week = 0; week < weeks; week += 1) {
			const column = [];
			for (let dow = 0; dow < 7; dow += 1) {
				const date = new Date(start.getTime() + (week * 7 + dow) * 86_400_000);
				const day = date.toISOString().slice(0, 10);
				const value = values.get(day) ?? 0;
				const level = value === 0 ? 0 : Math.min(4, 1 + Math.floor((value / max) * 3.999));
				column.push({ day, value, level, future: date > today });
			}
			columns.push(column);
		}
		return columns;
	});

	const activeDays = $derived(days.filter((entry) => entry.value > 0).length);
</script>

<div class="flex flex-col gap-3">
	<div
		class="flex gap-[3px] overflow-x-auto"
		role="img"
		aria-label="Aktivität: {activeDays} aktive Tage"
	>
		{#each grid as column, index (index)}
			<div class="flex flex-col gap-[3px]">
				{#each column as cell (cell.day)}
					<span
						class="block size-[13px] rounded-[3px]"
						style="background: {cell.future ? 'transparent' : STEPS[cell.level]}"
						title={cell.future
							? ''
							: `${formatDayLong(cell.day)}: ${formatNumber(cell.value)} Aktionen`}
					></span>
				{/each}
			</div>
		{/each}
	</div>
	<div class="flex items-center gap-1.5 text-[12px] text-ink-500">
		weniger
		{#each STEPS as step (step)}
			<span class="block size-[11px] rounded-[3px]" style="background: {step}"></span>
		{/each}
		mehr
	</div>
</div>
