<script>
	/**
	 * Mini-Verlauf in einer Kennzahl-Kachel: Linie in der zurückgenommenen
	 * Farbe, der aktuelle Punkt im Akzent.
	 *
	 * @type {{ values: number[], width?: number, height?: number, label?: string, class?: string }}
	 */
	let { values, width = 88, height = 30, label = 'Verlauf', class: className = '' } = $props();

	const geometry = $derived.by(() => {
		const max = Math.max(...values, 1);
		const step = values.length > 1 ? (width - 6) / (values.length - 1) : 0;
		const points = values.map((value, index) => ({
			x: 3 + index * step,
			y: height - 3 - (value / max) * (height - 6)
		}));
		return { points, last: points[points.length - 1] };
	});
</script>

<svg
	{width}
	{height}
	viewBox="0 0 {width} {height}"
	class={className}
	role="img"
	aria-label={label}
>
	<polyline
		points={geometry.points.map((point) => `${point.x},${point.y}`).join(' ')}
		fill="none"
		stroke="var(--ink-300)"
		stroke-width="2"
		stroke-linejoin="round"
		stroke-linecap="round"
	/>
	{#if geometry.last}
		<circle
			cx={geometry.last.x}
			cy={geometry.last.y}
			r="3.5"
			fill="var(--violet-700)"
			stroke="var(--white)"
			stroke-width="2"
		/>
	{/if}
</svg>
