<script>
	/**
	 * Säulen für eine Tages- oder Wochenreihe (eine Reihe). Säulen höchstens
	 * 24 px breit mit 4 px runder Oberkante, 2 px Luft dazwischen, ruhiges
	 * Raster. Hover und Tastatur zeigen den genauen Wert.
	 */
	import { formatNumber } from '#lib/format.js';
	import { labelIndices, niceTicks, SERIES_COLORS } from './scale.js';

	/**
	 * @type {{
	 *   points: { key: string, value: number }[],
	 *   label: string,
	 *   color?: import('./scale.js').SeriesColor,
	 *   height?: number,
	 *   unit?: string,
	 *   formatKey: (key: string) => string,
	 *   formatKeyLong?: (key: string) => string,
	 *   formatValue?: (value: number) => string,
	 *   highlightLast?: boolean
	 * }}
	 */
	let {
		points,
		label,
		color = 'ink',
		height = 220,
		unit = '',
		formatKey,
		formatKeyLong,
		formatValue = formatNumber,
		highlightLast = false
	} = $props();

	let width = $state(0);
	/** @type {number | null} */
	let active = $state(null);

	const PAD = { top: 12, right: 4, bottom: 26, left: 36 };

	const layout = $derived.by(() => {
		const innerWidth = Math.max(0, width - PAD.left - PAD.right);
		const innerHeight = height - PAD.top - PAD.bottom;
		const { max, ticks } = niceTicks(Math.max(...points.map((point) => point.value), 0));
		const slot = points.length > 0 ? innerWidth / points.length : 0;
		const barWidth = Math.max(2, Math.min(24, slot - 2));
		const bars = points.map((point, index) => {
			const barHeight = (point.value / max) * innerHeight;
			return {
				...point,
				x: PAD.left + index * slot + (slot - barWidth) / 2,
				slotX: PAD.left + index * slot,
				y: PAD.top + innerHeight - barHeight,
				height: barHeight
			};
		});
		return {
			innerHeight,
			slot,
			barWidth,
			bars,
			ticks: ticks.map((tick) => ({
				value: tick,
				y: PAD.top + innerHeight - (tick / max) * innerHeight
			})),
			labels: labelIndices(points.length, Math.max(2, Math.floor(innerWidth / 64)))
		};
	});

	/**
	 * Pfad mit 4 px runder Oberkante und gerader Basis.
	 *
	 * @param {number} x
	 * @param {number} y
	 * @param {number} w
	 * @param {number} h
	 */
	function barPath(x, y, w, h) {
		if (h <= 0) return '';
		const r = Math.min(4, w / 2, h);
		return `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`;
	}

	const activeBar = $derived(active === null ? null : layout.bars[active]);
	const total = $derived(points.reduce((sum, point) => sum + point.value, 0));
</script>

<div class="relative w-full" bind:clientWidth={width}>
	{#if width > 0}
		<svg
			{width}
			{height}
			role="img"
			aria-label="{label}: insgesamt {formatValue(total)}{unit ? ` ${unit}` : ''}"
			class="block overflow-visible"
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

			{#each layout.bars as bar, index (bar.key)}
				<path
					d={barPath(bar.x, bar.y, layout.barWidth, bar.height)}
					fill={SERIES_COLORS[highlightLast && index === layout.bars.length - 1 ? 'violet' : color]}
					opacity={active === null || active === index ? 1 : 0.45}
					class="transition-opacity duration-150"
				/>
				{#if layout.labels.has(index)}
					<text
						x={bar.slotX + layout.slot / 2}
						y={height - 8}
						text-anchor="middle"
						class="fill-ink-500 text-[11px]">{formatKey(bar.key)}</text
					>
				{/if}
				<!-- Trefferfläche über die ganze Höhe des Slots. -->
				<rect
					x={bar.slotX}
					y={PAD.top}
					width={layout.slot}
					height={layout.innerHeight}
					fill="transparent"
					role="presentation"
					onpointerenter={() => (active = index)}
					onpointerleave={() => (active = null)}
				/>
			{/each}
		</svg>

		{#if activeBar}
			<div
				class="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-md bg-ink px-2.5 py-1.5 text-[12.5px] whitespace-nowrap text-paper shadow-pop"
				style="left: {Math.min(
					Math.max(activeBar.x + layout.barWidth / 2, 60),
					width - 60
				)}px; top: {Math.max(activeBar.y - 6, 24)}px"
			>
				<span class="text-ink-muted">{(formatKeyLong ?? formatKey)(activeBar.key)}</span>
				<span class="tnum ml-2 font-semibold"
					>{formatValue(activeBar.value)}{unit ? ` ${unit}` : ''}</span
				>
			</div>
		{/if}
	{:else}
		<div style="height: {height}px"></div>
	{/if}
</div>
