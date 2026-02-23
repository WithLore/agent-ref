<script lang="ts">
	let {
		currentColor,
		onSelectColor
	}: {
		currentColor: string;
		onSelectColor: (color: string) => void;
	} = $props();

	const palette = [
		'#808080', // gray (default)
		'#6b7280', // cool gray
		'#ef4444', // red
		'#f97316', // orange
		'#eab308', // yellow
		'#22c55e', // green
		'#06b6d4', // cyan
		'#3b82f6', // blue
		'#8b5cf6', // purple
		'#ec4899'  // pink
	];
</script>

<div class="color-palette">
	{#each palette as color}
		<button
			class="color-swatch"
			class:active={color === currentColor}
			style:background={color}
			title={color}
			onclick={() => onSelectColor(color)}
		></button>
	{/each}
</div>

<style>
	.color-palette {
		display: flex;
		gap: 4px;
		padding: 6px 12px;
		flex-wrap: wrap;
	}

	.color-swatch {
		width: 18px;
		height: 18px;
		border-radius: 4px;
		border: 2px solid transparent;
		cursor: pointer;
		padding: 0;
		transition: border-color 120ms ease, transform 120ms ease;
	}

	.color-swatch:hover {
		transform: scale(1.15);
	}

	.color-swatch.active {
		border-color: #fff;
		box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.3);
	}
</style>
