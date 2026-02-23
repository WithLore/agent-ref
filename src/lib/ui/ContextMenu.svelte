<script lang="ts">
	import type { ContextTarget } from './context-menu.svelte.js';
	import { icons } from './icons.js';
	import ColorPalette from './ColorPalette.svelte';

	let {
		x,
		y,
		target,
		targetId,
		hasSelection = false,
		selectionCount = 0,
		groupLocked = false,
		groupColor = '#808080',
		onAction,
		onClose
	}: {
		x: number;
		y: number;
		target: ContextTarget;
		targetId?: string;
		hasSelection?: boolean;
		selectionCount?: number;
		groupLocked?: boolean;
		groupColor?: string;
		onAction: (action: string, id?: string) => void;
		onClose: () => void;
	} = $props();

	function handleAction(action: string) {
		onAction(action, targetId);
		onClose();
	}

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) {
			onClose();
		}
	}

	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			onClose();
		}
	}

	interface MenuItem {
		label: string;
		icon: string;
		action: string;
		danger?: boolean;
		separator?: boolean;
		hint?: string;
	}

	const canvasItems: MenuItem[] = [
		// File operations — most important, at the top
		{ label: 'Save Project', icon: icons.save, action: 'save', hint: 'Ctrl+S' },
		{ label: 'Save As…', icon: icons.save, action: 'saveAs', hint: 'Ctrl+Shift+S' },
		{ label: 'Open Project…', icon: icons.folder, action: 'open', hint: 'Ctrl+O' },
		// Canvas editing
		{ label: 'Add Text Note', icon: icons.text, action: 'addText', separator: true },
		{ label: 'Paste', icon: icons.paste, action: 'paste', hint: 'Ctrl+V' },
		// Package operations (with media bundling)
		{ label: 'Export with Media…', icon: icons.package, action: 'exportPackage', separator: true, hint: 'Ctrl+Shift+E' },
		{ label: 'Import from Package…', icon: icons.import, action: 'importPackage' },
		// View controls
		{ label: 'Zoom to Fit', icon: icons.zoomFit, action: 'zoomFit', separator: true, hint: 'Ctrl+0' },
		{ label: 'Reset Zoom', icon: icons.zoomReset, action: 'zoomReset', hint: 'Ctrl+1' }
	];

	const itemActions: MenuItem[] = [
		{ label: 'Duplicate', icon: icons.copy, action: 'duplicate' },
		{ label: 'Bring to Front', icon: icons.bringToFront, action: 'bringToFront' },
		{ label: 'Group', icon: icons.group, action: 'groupSingle', separator: true },
		{ label: 'Delete', icon: icons.trash, action: 'delete', danger: true }
	];

	const multiActions = $derived.by((): MenuItem[] => {
		const base: MenuItem[] = [
			{ label: 'Group Selected', icon: icons.group, action: 'groupSelected' },
			{ label: 'Duplicate All', icon: icons.copy, action: 'duplicateAll' },
			// Alignment
			{ label: 'Align Left', icon: icons.alignLeft, action: 'alignLeft', separator: true },
			{ label: 'Align Center', icon: icons.alignCenterH, action: 'alignCenterH' },
			{ label: 'Align Right', icon: icons.alignRight, action: 'alignRight' },
			{ label: 'Align Top', icon: icons.alignTop, action: 'alignTop' },
			{ label: 'Align Middle', icon: icons.alignCenterV, action: 'alignCenterV' },
			{ label: 'Align Bottom', icon: icons.alignBottom, action: 'alignBottom' }
		];
		// Distribution only makes sense with 3+ items
		if (selectionCount >= 3) {
			base.push(
				{ label: 'Distribute H', icon: icons.distributeH, action: 'distributeH', separator: true },
				{ label: 'Distribute V', icon: icons.distributeV, action: 'distributeV' }
			);
		}
		base.push(
			{ label: 'Delete All', icon: icons.trash, action: 'deleteAll', danger: true, separator: true }
		);
		return base;
	});

	const groupMenuItems = $derived.by((): MenuItem[] => [
		{ label: 'Select All in Group', icon: icons.zoomFit, action: 'selectGroup' },
		{ label: 'Rename Group', icon: icons.rename, action: 'renameGroup' },
		{ label: groupLocked ? 'Unlock Group' : 'Lock Group', icon: groupLocked ? icons.lockOpen : icons.lock, action: 'toggleLock' },
		{ label: 'Ungroup', icon: icons.ungroup, action: 'ungroup', separator: true },
		{ label: 'Delete Group', icon: icons.trash, action: 'deleteGroup', danger: true }
	]);

	const menuItems = $derived.by(() => {
		switch (target) {
			case 'item': return itemActions;
			case 'multi': return multiActions;
			case 'group': return groupMenuItems;
			case 'canvas':
			default: return canvasItems;
		}
	});
</script>

<svelte:window onkeydown={handleKeyDown} />

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div class="context-backdrop" onclick={handleBackdropClick}>
	<div
		class="context-menu"
		style:left="{x}px"
		style:top="{y}px"
		role="menu"
	>
		{#each menuItems as item}
			{#if item.separator}
				<div class="separator"></div>
			{/if}
			<button
				class="menu-item"
				class:danger={item.danger}
				onclick={() => handleAction(item.action)}
				role="menuitem"
			>
				<span class="menu-icon">{@html item.icon}</span>
				<span class="menu-label">{item.label}</span>
				{#if item.hint}
					<span class="menu-hint">{item.hint}</span>
				{/if}
			</button>
		{/each}

		<!-- Color palette for groups -->
		{#if target === 'group'}
			<div class="separator"></div>
			<ColorPalette
				currentColor={groupColor}
				onSelectColor={(color) => {
					onAction(`setColor:${color}`, targetId);
					onClose();
				}}
			/>
		{/if}
	</div>
</div>

<style>
	.context-backdrop {
		position: fixed;
		inset: 0;
		z-index: 10000;
	}

	.context-menu {
		position: fixed;
		min-width: 180px;
		max-height: calc(100vh - 40px);
		overflow-y: auto;
		background: var(--bg-menu, #1e293b);
		border: 1px solid var(--border-medium, rgba(255, 255, 255, 0.12));
		border-radius: var(--radius-md, 8px);
		box-shadow: var(--shadow-menu, 0 4px 24px rgba(0, 0, 0, 0.5));
		padding: 4px;
		display: flex;
		flex-direction: column;
		gap: 1px;
	}

	.separator {
		height: 1px;
		background: var(--border-subtle, rgba(255, 255, 255, 0.06));
		margin: 3px 8px;
	}

	.menu-item {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 7px 12px;
		border: none;
		background: none;
		color: var(--text-primary, #e0e0e0);
		font-size: 13px;
		font-family: inherit;
		cursor: pointer;
		border-radius: var(--radius-sm, 4px);
		transition: background var(--transition-fast, 120ms ease);
		text-align: left;
		white-space: nowrap;
	}

	.menu-item:hover {
		background: rgba(255, 255, 255, 0.08);
	}

	.menu-item.danger {
		color: var(--danger, #ff4757);
	}

	.menu-item.danger:hover {
		background: rgba(255, 71, 87, 0.12);
	}

	.menu-icon {
		display: flex;
		align-items: center;
		width: 16px;
		height: 16px;
		opacity: 0.7;
		flex-shrink: 0;
	}

	.menu-label {
		flex: 1;
	}

	.menu-hint {
		font-size: 11px;
		color: var(--text-muted, #484848);
		margin-left: 16px;
		font-family: inherit;
	}
</style>
