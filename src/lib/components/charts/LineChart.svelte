<script>
	/**
	 * Linien für mehrere Tagesreihen mit gemeinsamer X-Achse. 2 px Linien,
	 * die erste Reihe mit 10 % Fläche, Fadenkreuz und Tooltip mit allen
	 * Werten des Tages. Legende ab zwei Reihen. Für Screenreader steht
	 * dieselbe Information als Tabelle bereit.
	 */
	import { formatNumber } from '#lib/format.js';
	import { labelIndices, niceTicks, SERIES_COLORS } from './scale.js';

	/**
	 * @typedef {Object} LineSeries
	 * @property {string} key
	 * @property {string} label
	 * @property {import('./scale.js').SeriesColor} color
	 * @property {number[]} values gleiche Länge wie `keys`
	 */

	/**
	 * @type {{
	 *   keys: string[],
	 *   series: LineSeries[],
	 *   label: string,
	 *   height?: number,
	 *   formatKey: (key: string) => string,
	 *   formatKeyLong?: (key: string) => string,
	 *   formatValue?: (value: number) => string
	 * }}
	 */
	let {
		keys,
		series,
		label,
		height = 240,
		formatKey,
		formatKeyLong,
		formatValue = formatNumber
	} = $props();

	let width = $state(0);
	/** @type {number | null} */
	let active = $state(null);

	const PAD = { top: 12, right: 8, bottom: 26, left: 36 };

	const layout = $derived.by(() => {
		const innerWidth = Math.max(0, width - PAD.left - PAD.right);
		const innerHeight = height - PAD.top - PAD.bottom;
		const { max, ticks } = niceTicks(Math.max(0, ...series.flatMap((entry) => entry.values)));
		const step = keys.length > 1 ? innerWidth / (keys.length - 1) : 0;
		/** @param {number} index */
		const x = (index) => PAD.left + index * step;
		/** @param {number} value */
		const y = (value) => PAD.top + innerHeight - (value / max) * innerHeight;
		const lines = series.map((entry) => {
			const coords = entry.values.map((value, index) => [x(index), y(value)]);
			const line = coords
				.map(([cx, cy], index) => `${index === 0 ? 'M' : 'L'}${cx},${cy}`)
				.join(' ');
			const area =
				coords.length > 0
					? `${line} L${coords[coords.length - 1][0]},${y(0)} L${coords[0][0]},${y(0)} Z`
					: '';
			return { ...entry, coords, line, area };
		});
		return {
			innerHeight,
			step,
			x,
			lines,
			ticks: ticks.map((tick) => ({ value: tick, y: y(tick) })),
			labels: labelIndices(keys.length, Math.max(2, Math.floor(innerWidth / 64)))
		};
	});

	/**
	 * @param {PointerEvent} event
	 */
	function onMove(event) {
		const rect = /** @type {SVGElement} */ (event.currentTarget).getBoundingClientRect();
		const relative = event.clientX - rect.left - PAD.left;
		const index = layout.step > 0 ? Math.round(relative / layout.step) : 0;
		active = Math.max(0, Math.min(keys.length - 1, index));
	}
</script>

<div class="w-full">
	{#if series.length > 1}
		<ul class="m-0 mb-3 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 text-[13px] text-ink-700">
			{#each series as entry (entry.key)}
				<li class="flex items-center gap-1.5">
					<span
						class="inline-block h-[3px] w-3.5 rounded-full"
						style="background: {SERIES_COLORS[entry.color]}"
						aria-hidden="true"
					></span>
					{entry.label}
				</li>
			{/each}
		</ul>
	{/if}

	<div class="relative" bind:clientWidth={width}>
		{#if width > 0}
			<svg
				{width}
				{height}
				class="block touch-pan-y overflow-visible"
				aria-hidden="true"
				onpointermove={onMove}
				onpointerleave={() => (active = null)}
			>
				{#each layout.ticks as tick (tick.value)}
					<line
						x1={PAD.left}
						x2={width - PAD.right}
						y1={tick.y}
						y2={tick.y}
						stroke={tick.value === 0 ? 'var(--ink-200)' : 'var(--ink-100)'}
						stroke-width="1"
					/>
					<text
						x={PAD.left - 8}
						y={tick.y}
						dy="0.32em"
						text-anchor="end"
						class="tnum fill-ink-400 text-[11px]">{formatValue(tick.value)}</text
					>
				{/each}

				{#each keys as key, index (key)}
					{#if layout.labels.has(index)}
						<text
							x={layout.x(index)}
							y={height - 8}
							text-anchor={index === 0 ? 'start' : index === keys.length - 1 ? 'end' : 'middle'}
							class="fill-ink-500 text-[11px]">{formatKey(key)}</text
						>
					{/if}
				{/each}

				{#if layout.lines[0]?.area}
					<path
						d={layout.lines[0].area}
						fill={SERIES_COLORS[layout.lines[0].color]}
						opacity="0.08"
					/>
				{/if}

				{#if active !== null}
					<line
						x1={layout.x(active)}
						x2={layout.x(active)}
						y1={12}
						y2={12 + layout.innerHeight}
						stroke="var(--ink-300)"
						stroke-width="1"
					/>
				{/if}

				{#each layout.lines as line (line.key)}
					<path
						d={line.line}
						fill="none"
						stroke={SERIES_COLORS[line.color]}
						stroke-width="2"
						stroke-linejoin="round"
						stroke-linecap="round"
					/>
					{#if active !== null && line.coords[active]}
						<circle
							cx={line.coords[active][0]}
							cy={line.coords[active][1]}
							r="4.5"
							fill={SERIES_COLORS[line.color]}
							stroke="var(--white)"
							stroke-width="2"
						/>
					{/if}
				{/each}
			</svg>

			{#if active !== null}
				<div
					class="pointer-events-none absolute top-0 z-10 min-w-[150px] rounded-md bg-ink px-3 py-2 text-[12.5px] text-paper shadow-pop"
					style="left: {layout.x(active) > width / 2
						? layout.x(active) - 166
						: layout.x(active) + 16}px"
				>
					<p class="m-0 mb-1 text-ink-muted">{(formatKeyLong ?? formatKey)(keys[active])}</p>
					{#each series as entry (entry.key)}
						<p class="m-0 flex items-center justify-between gap-4">
							<span class="flex items-center gap-1.5">
								<span
									class="inline-block size-2 rounded-full"
									style="background: {SERIES_COLORS[entry.color]}"
								></span>
								{entry.label}
							</span>
							<span class="tnum font-semibold">{formatValue(entry.values[active] ?? 0)}</span>
						</p>
					{/each}
				</div>
			{/if}
		{:else}
			<div style="height: {height}px"></div>
		{/if}
	</div>

	<div class="sr-only">
		<table>
			<caption>{label}</caption>
			<thead>
				<tr>
					<th scope="col">Tag</th>
					{#each series as entry (entry.key)}<th scope="col">{entry.label}</th>{/each}
				</tr>
			</thead>
			<tbody>
				{#each keys as key, index (key)}
					<tr>
						<th scope="row">{(formatKeyLong ?? formatKey)(key)}</th>
						{#each series as entry (entry.key)}<td>{formatValue(entry.values[index] ?? 0)}</td
							>{/each}
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>
