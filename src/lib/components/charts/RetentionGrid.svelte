<script>
	/**
	 * Kohortentabelle: Zeilen = Registrierungswoche, Spalten = Woche nach
	 * Registrierung. Sequenzielle Violett-Skala, der Prozentwert steht immer
	 * in der Zelle.
	 */
	import { formatDayLabel, formatNumber, formatPercent } from '#lib/format.js';

	/**
	 * @type {{ cohorts: { cohort: string, size: number, retention: (number | null)[] }[] }}
	 */
	let { cohorts } = $props();

	const columns = $derived(Math.max(0, ...cohorts.map((cohort) => cohort.retention.length)));

	/**
	 * @param {number} value 0 bis 1
	 */
	function cellStyle(value) {
		// Weiß bis violet-700 über die RGB-Kanäle, Text ab 55 % hell.
		const alpha = 0.08 + value * 0.92;
		const text = value > 0.55 ? 'var(--white)' : 'var(--ink)';
		return `background: rgb(var(--violet-700-rgb) / ${alpha.toFixed(2)}); color: ${text}`;
	}
</script>

<div class="overflow-x-auto">
	<table class="w-full border-separate border-spacing-[2px] text-[13px]">
		<thead>
			<tr>
				<th class="text-label px-2 py-1.5 text-left font-semibold text-ink-500">Woche ab</th>
				<th class="text-label px-2 py-1.5 text-right font-semibold text-ink-500">Konten</th>
				{#each Array.from({ length: columns }, (_, index) => index) as offset (offset)}
					<th class="text-label px-2 py-1.5 text-center font-semibold text-ink-500">W{offset}</th>
				{/each}
			</tr>
		</thead>
		<tbody>
			{#each cohorts as cohort (cohort.cohort)}
				<tr>
					<td class="px-2 py-1.5 whitespace-nowrap text-ink">{formatDayLabel(cohort.cohort)}</td>
					<td class="tnum px-2 py-1.5 text-right text-ink-500">{formatNumber(cohort.size)}</td>
					{#each cohort.retention as value, offset (offset)}
						<td
							class="tnum min-w-[46px] rounded-[4px] px-1.5 py-1.5 text-center font-medium"
							style={value === null ? '' : cellStyle(value)}
						>
							{value === null ? '' : formatPercent(value)}
						</td>
					{/each}
				</tr>
			{/each}
		</tbody>
	</table>
</div>
