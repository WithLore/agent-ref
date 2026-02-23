<script lang="ts">
	import type { BoardItem } from './item-types.js';

	let {
		item,
		selected = false,
		editing = false,
		onUpdateText,
		onFinishEdit
	}: {
		item: BoardItem;
		selected?: boolean;
		editing?: boolean;
		onUpdateText?: (id: string, text: string) => void;
		onFinishEdit?: () => void;
	} = $props();

	let textEl = $state<HTMLDivElement>();

	// When editing prop becomes true, initialize and focus the contenteditable
	$effect(() => {
		if (editing && textEl) {
			// Set initial text imperatively (NOT via Svelte text node — that conflicts with contenteditable)
			textEl.innerText = item.url;
			requestAnimationFrame(() => {
				if (!textEl) return;
				textEl.focus();
				// Select all text
				const range = document.createRange();
				range.selectNodeContents(textEl);
				const sel = window.getSelection();
				sel?.removeAllRanges();
				sel?.addRange(range);
			});
		}
	});

	function finishEdit() {
		if (!editing) return;
		const newText = textEl?.innerText?.trim() || '';
		if (newText && newText !== item.url) {
			onUpdateText?.(item.id, newText);
		}
		onFinishEdit?.();
	}

	function handleKeyDown(e: KeyboardEvent) {
		if (editing) {
			e.stopPropagation(); // Don't let Delete/Backspace/arrow keys bubble to canvas
			if (e.key === 'Escape') {
				// Cancel without saving
				onFinishEdit?.();
			} else if (e.key === 'Enter' && !e.shiftKey) {
				e.preventDefault();
				finishEdit();
			}
		}
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="text-container"
	class:editing
	class:selected
	onkeydown={handleKeyDown}
>
	{#if editing}
		<!-- Editing mode: contenteditable div, text set imperatively to avoid Svelte reactivity conflicts -->
		<!-- svelte-ignore a11y_interactive_supports_focus -->
		<div
			bind:this={textEl}
			class="text-content editing-content"
			contenteditable="true"
			role="textbox"
			spellcheck="true"
			onblur={finishEdit}
			onkeydown={handleKeyDown}
			onpointerdown={(e) => e.stopPropagation()}
		></div>
	{:else}
		<!-- Display mode: Svelte manages the text reactively -->
		<div class="text-content">{item.url}</div>
		{#if selected}
			<div class="edit-hint">Double-click to edit</div>
		{/if}
	{/if}
</div>

<style>
	.text-container {
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		position: relative;
		user-select: none;
	}

	.text-container.editing {
		user-select: text;
	}

	.text-content {
		color: #e0e0e0;
		font-size: clamp(14px, 3vw, 48px);
		line-height: 1.3;
		padding: 8px 12px;
		width: 100%;
		height: 100%;
		overflow: hidden;
		word-wrap: break-word;
		white-space: pre-wrap;
		outline: none;
		display: flex;
		align-items: center;
	}

	.editing-content {
		background: rgba(255, 255, 255, 0.08);
		border-radius: 4px;
		cursor: text;
	}

	.edit-hint {
		position: absolute;
		bottom: -20px;
		left: 50%;
		transform: translateX(-50%);
		font-size: 10px;
		color: #666;
		white-space: nowrap;
		pointer-events: none;
	}
</style>
