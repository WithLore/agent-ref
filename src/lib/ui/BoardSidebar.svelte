<script lang="ts">
	import { icons } from './icons.js';

	interface BoardEntry {
		id: string;
		name: string;
		itemCount: number;
		modifiedAt: string;
	}

	let {
		boards,
		activeBoardId,
		projectName = 'Untitled Project',
		collapsed = true,
		onSwitchBoard,
		onAddBoard,
		onDeleteBoard,
		onRenameBoard,
		onDuplicateBoard,
		onToggleCollapse,
		onRenameProject
	}: {
		boards: BoardEntry[];
		activeBoardId: string;
		projectName?: string;
		collapsed?: boolean;
		onSwitchBoard: (id: string) => void;
		onAddBoard: () => void;
		onDeleteBoard: (id: string) => void;
		onRenameBoard: (id: string, name: string) => void;
		onDuplicateBoard: (id: string) => void;
		onToggleCollapse: () => void;
		onRenameProject: (name: string) => void;
	} = $props();

	let editingBoardId = $state<string | null>(null);
	let editValue = $state('');
	let editingProject = $state(false);
	let projectEditValue = $state('');

	function startRename(id: string, currentName: string) {
		editingBoardId = id;
		editValue = currentName;
	}

	function commitRename() {
		if (editingBoardId && editValue.trim()) {
			onRenameBoard(editingBoardId, editValue.trim());
		}
		editingBoardId = null;
	}

	function startProjectRename() {
		editingProject = true;
		projectEditValue = projectName;
	}

	function commitProjectRename() {
		if (projectEditValue.trim()) {
			onRenameProject(projectEditValue.trim());
		}
		editingProject = false;
	}

	function handleBoardKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') commitRename();
		if (e.key === 'Escape') { editingBoardId = null; }
	}

	function handleProjectKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') commitProjectRename();
		if (e.key === 'Escape') { editingProject = false; }
	}
</script>

{#if !collapsed}
	<aside class="sidebar">
		<div class="sidebar-header">
			{#if editingProject}
				<input
					class="project-name-input"
					bind:value={projectEditValue}
					onblur={commitProjectRename}
					onkeydown={handleProjectKeydown}
				/>
			{:else}
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<span
					class="project-name"
					ondblclick={startProjectRename}
					title="Double-click to rename"
				>
					{projectName}
				</span>
			{/if}
			<button
				class="icon-btn collapse-btn"
				onclick={onToggleCollapse}
				title="Collapse sidebar"
			>
				{@html icons.chevronLeft}
			</button>
		</div>

		<div class="board-list">
			{#each boards as board (board.id)}
				<div
					class="board-entry"
					class:active={board.id === activeBoardId}
				>
					{#if editingBoardId === board.id}
						<input
							class="board-name-input"
							bind:value={editValue}
							onblur={commitRename}
							onkeydown={handleBoardKeydown}
						/>
					{:else}
						<button
							class="board-btn"
							class:active={board.id === activeBoardId}
							onclick={() => onSwitchBoard(board.id)}
							ondblclick={() => startRename(board.id, board.name)}
							title="Click to switch, double-click to rename"
						>
							<span class="board-icon">{@html icons.board}</span>
							<span class="board-name">{board.name}</span>
							<span class="board-count">{board.itemCount}</span>
						</button>
						<div class="board-actions">
							<button
								class="icon-btn-sm"
								onclick={() => onDuplicateBoard(board.id)}
								title="Duplicate"
							>
								{@html icons.copy}
							</button>
							{#if boards.length > 1}
								<button
									class="icon-btn-sm danger"
									onclick={() => onDeleteBoard(board.id)}
									title="Delete"
								>
									{@html icons.trash}
								</button>
							{/if}
						</div>
					{/if}
				</div>
			{/each}
		</div>

		<button class="add-board-btn" onclick={onAddBoard}>
			<span class="add-icon">{@html icons.plus}</span>
			New Board
		</button>
	</aside>
{:else}
	<button
		class="expand-btn"
		onclick={onToggleCollapse}
		title="Show board sidebar"
	>
		{@html icons.chevronRight}
	</button>
{/if}

<style>
	.sidebar {
		position: fixed;
		left: 0;
		top: 0;
		bottom: 0;
		width: 220px;
		background: var(--bg-sidebar, #111827);
		border-right: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.06));
		display: flex;
		flex-direction: column;
		z-index: 100;
		font-size: 13px;
	}

	.sidebar-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 12px 12px 8px;
		border-bottom: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.06));
	}

	.project-name {
		font-size: 14px;
		font-weight: 600;
		color: var(--text-primary, #e0e0e0);
		cursor: default;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		flex: 1;
	}

	.project-name-input {
		flex: 1;
		font-size: 14px;
		font-weight: 600;
		color: var(--text-primary, #e0e0e0);
		background: rgba(255, 255, 255, 0.06);
		border: 1px solid var(--accent, #fff);
		border-radius: var(--radius-sm, 4px);
		padding: 2px 6px;
		outline: none;
		font-family: inherit;
	}

	.board-list {
		flex: 1;
		overflow-y: auto;
		padding: 8px 6px;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.board-entry {
		display: flex;
		align-items: center;
		border-radius: var(--radius-sm, 4px);
	}

	.board-entry:hover .board-actions {
		opacity: 1;
	}

	.board-btn {
		flex: 1;
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 6px 8px;
		border: none;
		background: none;
		color: var(--text-secondary, #888);
		font-size: 13px;
		font-family: inherit;
		cursor: pointer;
		border-radius: var(--radius-sm, 4px);
		text-align: left;
		overflow: hidden;
		transition: background var(--transition-fast, 120ms ease);
	}

	.board-btn:hover {
		background: rgba(255, 255, 255, 0.05);
		color: var(--text-primary, #e0e0e0);
	}

	.board-btn.active {
		background: rgba(255, 255, 255, 0.08);
		color: var(--accent, #fff);
	}

	.board-icon {
		display: flex;
		width: 16px;
		height: 16px;
		opacity: 0.6;
		flex-shrink: 0;
	}

	.board-name {
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.board-count {
		font-size: 11px;
		color: var(--text-muted, #555);
		opacity: 0.7;
	}

	.board-name-input {
		flex: 1;
		font-size: 13px;
		color: var(--text-primary, #e0e0e0);
		background: rgba(255, 255, 255, 0.06);
		border: 1px solid var(--accent, #fff);
		border-radius: var(--radius-sm, 4px);
		padding: 5px 8px;
		outline: none;
		font-family: inherit;
		margin: 0 6px;
	}

	.board-actions {
		display: flex;
		gap: 2px;
		opacity: 0;
		transition: opacity var(--transition-fast, 120ms ease);
		padding-right: 4px;
	}

	.icon-btn,
	.icon-btn-sm {
		display: flex;
		align-items: center;
		justify-content: center;
		border: none;
		background: none;
		color: var(--text-secondary, #888);
		cursor: pointer;
		border-radius: var(--radius-sm, 4px);
		transition: background var(--transition-fast, 120ms ease);
	}

	.icon-btn {
		width: 28px;
		height: 28px;
	}

	.icon-btn-sm {
		width: 24px;
		height: 24px;
	}

	.icon-btn:hover,
	.icon-btn-sm:hover {
		background: rgba(255, 255, 255, 0.08);
		color: var(--text-primary, #e0e0e0);
	}

	.icon-btn-sm.danger:hover {
		color: var(--danger, #ff4757);
		background: rgba(255, 71, 87, 0.12);
	}

	.add-board-btn {
		display: flex;
		align-items: center;
		gap: 8px;
		margin: 8px;
		padding: 8px 12px;
		border: 1px dashed var(--border-medium, rgba(255, 255, 255, 0.12));
		background: none;
		color: var(--text-secondary, #888);
		font-size: 13px;
		font-family: inherit;
		cursor: pointer;
		border-radius: var(--radius-sm, 4px);
		transition: all var(--transition-fast, 120ms ease);
	}

	.add-board-btn:hover {
		border-color: var(--accent, #fff);
		color: var(--accent, #fff);
		background: rgba(255, 255, 255, 0.04);
	}

	.add-icon {
		display: flex;
		width: 16px;
		height: 16px;
	}

	.expand-btn {
		position: fixed;
		left: 8px;
		top: 8px;
		width: 28px;
		height: 28px;
		display: flex;
		align-items: center;
		justify-content: center;
		border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.06));
		background: var(--bg-sidebar, #111827);
		color: var(--text-secondary, #888);
		cursor: pointer;
		border-radius: var(--radius-sm, 4px);
		z-index: 100;
		transition: all var(--transition-fast, 120ms ease);
	}

	.expand-btn:hover {
		color: var(--text-primary, #e0e0e0);
		background: var(--bg-menu, #1e293b);
	}

	.collapse-btn {
		flex-shrink: 0;
	}
</style>
