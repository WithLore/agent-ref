<script lang="ts">
	import type { BoardItem } from '$lib/items/item-types.js';
	import { icons } from './icons.js';

	let {
		item,
		screenX,
		screenY,
		onRate,
		onAddTag,
		onRemoveTag
	}: {
		item: BoardItem;
		screenX: number;
		screenY: number;
		onRate: (id: string, rating: number) => void;
		onAddTag: (id: string, tag: string) => void;
		onRemoveTag: (id: string, tag: string) => void;
	} = $props();

	let showTagInput = $state(false);
	let tagInput = $state('');

	const ratingLabels = ['—', '🗑', '✓', '★'];
	const ratingColors = ['#555', '#ef4444', '#22c55e', '#fbbf24'];

	function cycleRating() {
		const next = (item.rating + 1) % 4;
		onRate(item.id, next);
	}

	function handleTagKeydown(e: KeyboardEvent) {
		e.stopPropagation();
		if (e.key === 'Enter' && tagInput.trim()) {
			onAddTag(item.id, tagInput.trim());
			tagInput = '';
		}
		if (e.key === 'Escape') {
			showTagInput = false;
			tagInput = '';
		}
	}

	function handleTagInputBlur() {
		if (tagInput.trim()) {
			onAddTag(item.id, tagInput.trim());
		}
		tagInput = '';
		showTagInput = false;
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="selection-toolbar"
	style:left="{screenX}px"
	style:top="{screenY}px"
	onpointerdown={(e) => e.stopPropagation()}
>
	<!-- Compact rating button: click to cycle through 0/1/2/3 -->
	<button
		class="rate-btn"
		style:color={ratingColors[item.rating]}
		onclick={cycleRating}
		title="Rating: {ratingLabels[item.rating]} (click to cycle)"
	>
		{ratingLabels[item.rating]}
	</button>

	<!-- Existing tags -->
	{#each item.tags as tag}
		<span class="tag-chip">
			{tag}
			<button class="tag-remove" onclick={() => onRemoveTag(item.id, tag)}>×</button>
		</span>
	{/each}

	<!-- Add tag: inline input or + button -->
	{#if showTagInput}
		<!-- svelte-ignore a11y_autofocus -->
		<input
			class="tag-input"
			type="text"
			placeholder="tag"
			bind:value={tagInput}
			onkeydown={handleTagKeydown}
			onblur={handleTagInputBlur}
			autofocus
		/>
	{:else}
		<button class="add-tag-btn" onclick={() => { showTagInput = true; }} title="Add tag">+</button>
	{/if}
</div>

<style>
	.selection-toolbar {
		position: fixed;
		transform: translate(-100%, -50%);
		background: var(--bg-menu, #1e293b);
		border: 1px solid var(--border-medium, rgba(255, 255, 255, 0.12));
		border-radius: 6px;
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
		padding: 4px;
		display: flex;
		flex-direction: column;
		align-items: stretch;
		gap: 2px;
		z-index: 9000;
		min-width: 36px;
		max-width: 140px;
	}

	.rate-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 24px;
		background: rgba(255, 255, 255, 0.04);
		border: none;
		border-radius: 4px;
		font-size: 13px;
		cursor: pointer;
		padding: 0;
		transition: background 120ms ease;
	}

	.rate-btn:hover {
		background: rgba(255, 255, 255, 0.1);
	}

	.tag-chip {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 2px;
		background: rgba(255, 255, 255, 0.06);
		color: var(--text-primary, #e0e0e0);
		font-size: 10px;
		padding: 2px 5px;
		border-radius: 3px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.tag-remove {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: none;
		border: none;
		color: #666;
		cursor: pointer;
		padding: 0;
		font-size: 11px;
		width: 12px;
		height: 12px;
		line-height: 1;
	}

	.tag-remove:hover {
		color: #ff4757;
	}

	.tag-input {
		background: rgba(255, 255, 255, 0.06);
		border: 1px solid rgba(255, 255, 255, 0.15);
		color: var(--text-primary, #e0e0e0);
		font-size: 10px;
		padding: 2px 5px;
		border-radius: 3px;
		outline: none;
		width: 100%;
		font-family: inherit;
		box-sizing: border-box;
	}

	.tag-input:focus {
		border-color: rgba(255, 255, 255, 0.3);
	}

	.add-tag-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 20px;
		background: none;
		border: 1px dashed rgba(255, 255, 255, 0.08);
		color: #555;
		font-size: 12px;
		cursor: pointer;
		border-radius: 3px;
		padding: 0;
		transition: color 120ms ease, border-color 120ms ease;
	}

	.add-tag-btn:hover {
		color: #aaa;
		border-color: rgba(255, 255, 255, 0.2);
	}
</style>
