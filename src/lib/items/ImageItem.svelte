<script lang="ts">
	import type { BoardItem } from './item-types.js';
	import { icons } from '$lib/ui/icons.js';

	let { item, onLoad }: { item: BoardItem; onLoad?: (width: number, height: number) => void } =
		$props();

	let loadError = $state(false);

	function handleLoad(e: Event) {
		const img = e.target as HTMLImageElement;
		loadError = false;
		if (img.naturalWidth && img.naturalHeight && onLoad) {
			onLoad(img.naturalWidth, img.naturalHeight);
		}
	}

	function handleError() {
		loadError = true;
		console.error('[AgentRef] Image failed to load:', item.url);
	}
</script>

{#if loadError}
	<div class="error-state">
		<span class="error-icon">{@html icons.warning}</span>
		<span>Failed to load image</span>
	</div>
{:else}
	<img
		src={item.url}
		alt=""
		draggable="false"
		loading="lazy"
		onload={handleLoad}
		onerror={handleError}
		style="width: 100%; height: 100%; object-fit: contain; pointer-events: none; user-select: none;"
	/>
{/if}

<style>
	.error-state {
		width: 100%;
		height: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 6px;
		background: #1a1a1a;
		color: #ff6b6b;
		font-size: 0.75rem;
		padding: 8px;
		text-align: center;
		user-select: none;
	}
	.error-icon {
		opacity: 0.7;
	}
</style>
