<script lang="ts">
	import type { BoardItem, TodoEntry } from './item-types.js';

	let {
		item,
		onUpdateTitle,
		onAddEntry,
		onUpdateEntry,
		onToggleEntry,
		onDeleteEntry,
		onStartConnection
	}: {
		item: BoardItem;
		onUpdateTitle: (itemId: string, title: string) => void;
		onAddEntry: (itemId: string, text: string) => void;
		onUpdateEntry: (itemId: string, todoId: string, text: string) => void;
		onToggleEntry: (itemId: string, todoId: string) => void;
		onDeleteEntry: (itemId: string, todoId: string) => void;
		onStartConnection: (itemId: string, todoId: string, event: PointerEvent) => void;
	} = $props();

	let draft = $state('');
	let entries = $derived(item.todoMeta?.items ?? []);

	function formatTimestamp(value: string): string {
		const date = new Date(value);
		if (Number.isNaN(date.getTime())) return value;
		return new Intl.DateTimeFormat(undefined, {
			month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
		}).format(date);
	}

	function commitTitle(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const next = input.value.trim() || 'To-do list';
		if (next !== item.todoMeta?.title) onUpdateTitle(item.id, next);
	}

	function commitEntry(entry: TodoEntry, event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const next = input.value.trim();
		if (next && next !== entry.text) onUpdateEntry(item.id, entry.id, next);
		if (!next) input.value = entry.text;
	}

	function blurOnEnter(event: KeyboardEvent) {
		if (event.key === 'Enter') (event.currentTarget as HTMLInputElement).blur();
	}

	function addEntry() {
		const text = draft.trim();
		if (!text) return;
		onAddEntry(item.id, text);
		draft = '';
	}
</script>

<section class="todo-card" aria-label={item.todoMeta?.title ?? 'To-do list'}>
	<header class="todo-header">
		<div class="title-wrap">
			<input
				class="title-input"
				value={item.todoMeta?.title ?? 'To-do list'}
				aria-label="To-do list title"
				onpointerdown={(event) => event.stopPropagation()}
				onblur={commitTitle}
				onkeydown={blurOnEnter}
			/>
			<span class="list-time">Created {formatTimestamp(item.createdAt)}</span>
		</div>
	</header>

	<div class="todo-rows">
		{#each entries as entry (entry.id)}
			<div class:complete={entry.completed} class="todo-row">
				<button
					class="check"
					class:checked={entry.completed}
					aria-label={entry.completed ? `Mark ${entry.text} incomplete` : `Complete ${entry.text}`}
					aria-pressed={entry.completed}
					onpointerdown={(event) => event.stopPropagation()}
					onclick={() => onToggleEntry(item.id, entry.id)}
				>{entry.completed ? '✓' : ''}</button>
				<div class="entry-content">
					<input
						class="entry-input"
						value={entry.text}
						aria-label="To-do item"
						onpointerdown={(event) => event.stopPropagation()}
						onblur={(event) => commitEntry(entry, event)}
						onkeydown={blurOnEnter}
					/>
					<div class="timestamps">
						<span>Created {formatTimestamp(entry.createdAt)}</span>
						{#if entry.completedAt}<span class="completed-time">Completed {formatTimestamp(entry.completedAt)}</span>{/if}
					</div>
				</div>
				<button
					class="delete-entry"
					aria-label={`Delete ${entry.text}`}
					title="Delete item"
					onpointerdown={(event) => event.stopPropagation()}
					onclick={() => onDeleteEntry(item.id, entry.id)}
				>×</button>
				<button
					class="port"
					aria-label={`Connect ${entry.text} to a reference`}
					title="Drag to connect"
					onpointerdown={(event) => onStartConnection(item.id, entry.id, event)}
				></button>
			</div>
		{/each}
	</div>

	<form class="add-row" onsubmit={(event) => { event.preventDefault(); addEntry(); }} onpointerdown={(event) => event.stopPropagation()}>
		<span aria-hidden="true">+</span>
		<label class="sr-only" for={`todo-add-${item.id}`}>Add a to-do item</label>
		<input id={`todo-add-${item.id}`} bind:value={draft} placeholder="Add item" autocomplete="off" />
	</form>
</section>

<style>
	.todo-card {
		width: 100%;
		height: 100%;
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		background: var(--bg-surface, #111);
		border: 1px solid var(--border-medium, #2a2a2a);
		border-radius: var(--radius-sm, 4px);
		color: var(--text-primary, #e8e8e8);
		overflow: visible;
	}

	.todo-header {
		height: 58px;
		flex: 0 0 58px;
		box-sizing: border-box;
		display: flex;
		align-items: center;
		padding: 9px 14px;
		border-bottom: 1px solid var(--border-subtle, #222);
		cursor: grab;
	}

	.title-wrap,
	.entry-content { min-width: 0; flex: 1; }

	.title-input,
	.entry-input,
	.add-row input {
		width: 100%;
		box-sizing: border-box;
		border: 0;
		background: transparent;
		color: inherit;
		font: inherit;
		outline: none;
	}

	.title-input { font-size: 15px; line-height: 20px; font-weight: 600; padding: 0; }
	.list-time,
	.timestamps { color: var(--text-secondary, #808080); font-size: 10px; line-height: 14px; font-variant-numeric: tabular-nums; }
	.todo-rows { min-height: 0; flex: 1 1 auto; display: flex; flex-direction: column; }

	.todo-row {
		position: relative;
		height: auto;
		min-height: 48px;
		flex: 1 1 64px;
		box-sizing: border-box;
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 8px 22px 8px 12px;
		border-bottom: 1px solid var(--border-subtle, #222);
	}

	.check {
		width: 22px;
		height: 22px;
		flex: 0 0 22px;
		border: 1px solid #707070;
		border-radius: 3px;
		background: transparent;
		color: #0a0a0a;
		font-size: 15px;
		line-height: 18px;
		cursor: pointer;
		padding: 0;
	}

	.check.checked { background: var(--success, #2ed573); border-color: var(--success, #2ed573); }
	.check:focus-visible,
	.entry-input:focus-visible,
	.title-input:focus-visible,
	.add-row input:focus-visible,
	.delete-entry:focus-visible,
	.port:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }

	.entry-input { font-size: 13px; line-height: 18px; padding: 0; }
	.complete .entry-input { color: #808080; text-decoration: line-through; }
	.timestamps { display: flex; flex-wrap: wrap; column-gap: 7px; row-gap: 0; }
	.completed-time { color: var(--success, #2ed573); }

	.delete-entry {
		position: absolute;
		right: 17px;
		top: 5px;
		width: 20px;
		height: 20px;
		border: 0;
		background: transparent;
		color: #707070;
		font: inherit;
		font-size: 15px;
		cursor: pointer;
		opacity: 0;
	}

	.todo-row:hover .delete-entry,
	.delete-entry:focus-visible { opacity: 1; }

	.port {
		position: absolute;
		right: -7px;
		top: 50%;
		width: 14px;
		height: 14px;
		transform: translateY(-50%);
		border: 2px solid #808080;
		border-radius: 50%;
		background: #0a0a0a;
		cursor: crosshair;
		padding: 0;
	}

	.port::before { content: ''; position: absolute; inset: -12px; }
	.port:hover,
	.port:focus-visible { border-color: #fff; }

	.add-row {
		height: 42px;
		flex: 0 0 42px;
		box-sizing: border-box;
		display: flex;
		align-items: center;
		gap: 9px;
		padding: 0 13px;
		color: #808080;
	}

	.add-row input { font-size: 12px; }
	.add-row input::placeholder { color: #707070; }
	.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }

	@media (prefers-reduced-motion: reduce) {
		* { transition: none !important; }
	}
</style>
