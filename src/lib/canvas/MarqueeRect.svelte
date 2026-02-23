<script lang="ts">
	let { x, y, width, height }: {
		x: number;
		y: number;
		width: number;
		height: number;
	} = $props();
</script>

<div
	class="marquee"
	style:left="{x}px"
	style:top="{y}px"
	style:width="{width}px"
	style:height="{height}px"
></div>

<style>
	.marquee {
		position: fixed;
		border: 1.5px solid rgba(255, 255, 255, 0.5);
		background: rgba(255, 255, 255, 0.04);
		pointer-events: none;
		z-index: 9999;
	}
</style>
