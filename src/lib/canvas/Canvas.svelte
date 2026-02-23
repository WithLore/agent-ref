<script lang="ts">
	import type { BoardItem, GroupData, VideoMeta } from '$lib/items/item-types.js';
	import ItemWrapper from '$lib/items/ItemWrapper.svelte';
	import ImageItem from '$lib/items/ImageItem.svelte';
	import VideoItem from '$lib/items/VideoItem.svelte';
	import YouTubeItem from '$lib/items/YouTubeItem.svelte';
	import TextItem from '$lib/items/TextItem.svelte';
	import GroupFrame from '$lib/canvas/GroupFrame.svelte';
	import MarqueeRect from '$lib/canvas/MarqueeRect.svelte';
	import { screenToCanvas } from '$lib/canvas/coordinates.js';
	import { icons } from '$lib/ui/icons.js';

	let {
		items,
		groups = [],
		viewportTransform,
		viewportX,
		viewportY,
		viewportScale,
		selectedIds,
		isItemLocked,
		onZoom,
		onPan,
		onSelect,
		onClearSelection,
		onMoveStart,
		onMoveItem,
		onMoveItems,
		onMoveEnd,
		onResizeItem,
		onResizeEnd,
		onRotateItem,
		onRotateEnd,
		onDrop,
		onPaste,
		onDeleteSelected,
		onBringToFront,
		onMediaLoad,
		onUpdateVideoMeta,
		onUpdateText,
		onMoveGroup,
		onSelectGroup,
		onContextMenu,
		onMarqueeSelect
	}: {
		items: BoardItem[];
		groups?: GroupData[];
		viewportTransform: string;
		viewportX: number;
		viewportY: number;
		viewportScale: number;
		selectedIds: Set<string>;
		isItemLocked?: (item: BoardItem) => boolean;
		onZoom: (delta: number, clientX: number, clientY: number) => void;
		onPan: (dx: number, dy: number) => void;
		onSelect: (id: string, multi: boolean) => void;
		onClearSelection: () => void;
		onMoveStart?: (id: string) => void;
		onMoveItem: (id: string, dx: number, dy: number) => void;
		onMoveItems: (ids: Set<string>, dx: number, dy: number) => void;
		onMoveEnd?: (id: string) => void;
		onResizeItem: (id: string, width: number, height: number, absX: number, absY: number) => void;
		onResizeEnd?: (id: string) => void;
		onRotateItem?: (id: string, rotation: number) => void;
		onRotateEnd?: (id: string) => void;
		onDrop: (files: FileList, x: number, y: number) => void;
		onPaste: (e: ClipboardEvent) => void;
		onDeleteSelected: () => void;
		onBringToFront: (id: string) => void;
		onMediaLoad: (id: string, naturalWidth: number, naturalHeight: number) => void;
		onUpdateVideoMeta: (id: string, meta: Partial<VideoMeta>) => void;
		onUpdateText: (id: string, text: string) => void;
		onMoveGroup?: (id: string, dx: number, dy: number) => void;
		onSelectGroup?: (id: string, multi: boolean) => void;
		onContextMenu?: (x: number, y: number, target: string, id?: string) => void;
		onMarqueeSelect?: (ids: string[], additive: boolean) => void;
	} = $props();

	let canvasRoot: HTMLDivElement;
	let isPanning = $state(false);
	let spaceHeld = $state(false);

	// --- Text editing state (managed here because ItemWrapper steals dblclick via pointer capture) ---
	let editingItemId = $state<string | null>(null);

	function handleItemDblClick(id: string) {
		// Only enter edit mode for text items
		const item = items.find((it) => it.id === id);
		if (item?.type === 'text') {
			editingItemId = id;
		}
	}

	// Clear editing when selection changes away from the editing item
	$effect(() => {
		if (editingItemId && !selectedIds.has(editingItemId)) {
			editingItemId = null;
		}
	});

	// --- Marquee selection ---
	let marqueeActive = $state(false);
	let marqueeStartX = $state(0);
	let marqueeStartY = $state(0);
	let marqueeEndX = $state(0);
	let marqueeEndY = $state(0);
	let marqueeAdditive = false; // shift-held at start

	let marqueeRect = $derived.by(() => {
		const x = Math.min(marqueeStartX, marqueeEndX);
		const y = Math.min(marqueeStartY, marqueeEndY);
		const w = Math.abs(marqueeEndX - marqueeStartX);
		const h = Math.abs(marqueeEndY - marqueeStartY);
		return { x, y, width: w, height: h };
	});

	// Sort items and groups by zIndex for rendering order
	let sortedItems = $derived([...items].sort((a, b) => a.zIndex - b.zIndex));
	let sortedGroups = $derived([...groups].sort((a, b) => a.zIndex - b.zIndex));

	// --- Dot grid that pans/zooms with the viewport ---
	const GRID_STEP = 40; // px in canvas-space
	const MAJOR_EVERY = 5; // every 5th line is brighter

	let gridStyle = $derived.by(() => {
		const s = viewportScale;
		const minor = GRID_STEP * s;
		const major = GRID_STEP * MAJOR_EVERY * s;
		const ox = viewportX;
		const oy = viewportY;
		return (
			`background-size: ${minor}px ${minor}px, ${major}px ${major}px;` +
			`background-position: ${ox}px ${oy}px, ${ox}px ${oy}px;`
		);
	});

	// --- Wheel zoom ---
	function handleWheel(e: WheelEvent) {
		e.preventDefault();
		onZoom(e.deltaY, e.clientX, e.clientY);
	}

	// --- Keyboard ---

	/** Check if the active element is an editable field (input, textarea, contentEditable). */
	function isEditableTarget(e: KeyboardEvent): boolean {
		const el = e.target as HTMLElement;
		if (!el) return false;
		const tag = el.tagName;
		if (tag === 'INPUT' || tag === 'TEXTAREA') return true;
		if (el.isContentEditable) return true;
		return false;
	}

	function handleKeyDown(e: KeyboardEvent) {
		// Never intercept keys when user is typing in an editable field
		if (isEditableTarget(e)) return;

		if (e.key === ' ') {
			e.preventDefault();
			spaceHeld = true;
		}
		if ((e.key === 'Delete' || e.key === 'Backspace') && !e.ctrlKey && !e.metaKey && !e.altKey) {
			onDeleteSelected();
		}
	}

	function handleKeyUp(e: KeyboardEvent) {
		if (e.key === ' ') {
			spaceHeld = false;
			isPanning = false;
		}
	}

	// --- Pointer (pan + marquee + background click to deselect) ---
	function handlePointerDown(e: PointerEvent) {
		if (e.button === 0 && spaceHeld) {
			isPanning = true;
			canvasRoot.setPointerCapture(e.pointerId);
		} else if (e.button === 1) {
			isPanning = true;
			canvasRoot.setPointerCapture(e.pointerId);
		} else if (e.button === 0) {
			if (e.target === canvasRoot || e.target === canvasRoot.querySelector('.canvas-layer')) {
				// Start marquee selection
				marqueeAdditive = e.shiftKey;
				if (!e.shiftKey) onClearSelection();
				marqueeActive = true;
				marqueeStartX = e.clientX;
				marqueeStartY = e.clientY;
				marqueeEndX = e.clientX;
				marqueeEndY = e.clientY;
				canvasRoot.setPointerCapture(e.pointerId);
			}
		}
	}

	function handlePointerMove(e: PointerEvent) {
		if (isPanning) {
			onPan(e.movementX, e.movementY);
			return;
		}
		if (marqueeActive) {
			marqueeEndX = e.clientX;
			marqueeEndY = e.clientY;

			// Convert screen rect to canvas rect and find intersecting items
			const topLeft = screenToCanvas(
				Math.min(marqueeStartX, marqueeEndX),
				Math.min(marqueeStartY, marqueeEndY),
				viewportX, viewportY, viewportScale
			);
			const bottomRight = screenToCanvas(
				Math.max(marqueeStartX, marqueeEndX),
				Math.max(marqueeStartY, marqueeEndY),
				viewportX, viewportY, viewportScale
			);

			const intersecting = items.filter((item) =>
				item.x + item.width > topLeft.x &&
				item.x < bottomRight.x &&
				item.y + item.height > topLeft.y &&
				item.y < bottomRight.y
			);

			onMarqueeSelect?.(intersecting.map((it) => it.id), marqueeAdditive);
			return;
		}
	}

	function handlePointerUp(e: PointerEvent) {
		if (isPanning) {
			isPanning = false;
			canvasRoot.releasePointerCapture(e.pointerId);
			return;
		}
		if (marqueeActive) {
			marqueeActive = false;
			canvasRoot.releasePointerCapture(e.pointerId);
			return;
		}
	}

	function handlePointerCancel() {
		isPanning = false;
		marqueeActive = false;
	}

	// --- Drag & drop files ---
	function handleDragOver(e: DragEvent) {
		e.preventDefault();
		if (e.dataTransfer) {
			e.dataTransfer.dropEffect = 'copy';
		}
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		if (e.dataTransfer?.files?.length) {
			onDrop(e.dataTransfer.files, e.clientX, e.clientY);
		}
	}

	// --- Handle select + bring to front ---
	function handleSelect(id: string, multi: boolean) {
		const wasSelected = selectedIds.has(id);
		onSelect(id, multi);
		// Only bring to front on initial selection, not re-clicks
		// (re-clicks cause state churn that breaks double-click detection)
		if (!multi && !wasSelected) {
			onBringToFront(id);
		}
	}

	// --- Handle move (supports multi-select drag) ---
	function handleMove(id: string, dx: number, dy: number) {
		if (selectedIds.size > 1 && selectedIds.has(id)) {
			onMoveItems(selectedIds, dx, dy);
		} else {
			onMoveItem(id, dx, dy);
		}
	}

	// --- Context menu ---
	function handleCanvasContextMenu(e: MouseEvent) {
		e.preventDefault();
		if (e.target === canvasRoot || e.target === canvasRoot.querySelector('.canvas-layer')) {
			onContextMenu?.(e.clientX, e.clientY, 'canvas');
		}
	}

	function handleItemContextMenu(id: string, x: number, y: number) {
		if (selectedIds.size > 1 && selectedIds.has(id)) {
			onContextMenu?.(x, y, 'multi', id);
		} else {
			onSelect(id, false);
			onContextMenu?.(x, y, 'item', id);
		}
	}

	function handleGroupContextMenu(id: string, x: number, y: number) {
		onContextMenu?.(x, y, 'group', id);
	}
</script>

<svelte:window onkeydown={handleKeyDown} onkeyup={handleKeyUp} onpaste={onPaste} />

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="canvas-root"
	class:panning={isPanning || spaceHeld}
	bind:this={canvasRoot}
	style={gridStyle}
	onwheel={handleWheel}
	onpointerdown={handlePointerDown}
	onpointermove={handlePointerMove}
	onpointerup={handlePointerUp}
	onpointercancel={handlePointerCancel}
	onlostpointercapture={handlePointerCancel}
	ondragover={handleDragOver}
	ondrop={handleDrop}
	oncontextmenu={handleCanvasContextMenu}
	tabindex="-1"
>
	<div class="canvas-layer" style:transform={viewportTransform} style:transform-origin="0 0">
		<!-- Groups render below items -->
		{#each sortedGroups as group (group.id)}
			<GroupFrame
				{group}
				scale={viewportScale}
				{spaceHeld}
				onSelect={(id, multi) => onSelectGroup?.(id, multi)}
				onMove={(id, dx, dy) => onMoveGroup?.(id, dx, dy)}
				onPan={onPan}
				onContextMenu={handleGroupContextMenu}
			/>
		{/each}

		<!-- Items -->
		{#each sortedItems as item (item.id)}
			<ItemWrapper
				{item}
				scale={viewportScale}
				selected={selectedIds.has(item.id)}
				locked={isItemLocked?.(item) ?? false}
				{spaceHeld}
				onSelect={handleSelect}
				onMoveStart={onMoveStart}
				onMove={handleMove}
				onMoveEnd={onMoveEnd}
				onResize={onResizeItem}
				onResizeEnd={onResizeEnd}
				onRotate={onRotateItem}
				onRotateEnd={onRotateEnd}
				onMoveGroup={(groupId, dx, dy) => onMoveGroup?.(groupId, dx, dy)}
				onDblClick={handleItemDblClick}
				onPan={onPan}
				onContextMenu={handleItemContextMenu}
			>
				{#if item.type === 'image'}
					<ImageItem
						{item}
						onLoad={(w, h) => onMediaLoad(item.id, w, h)}
					/>
				{:else if item.type === 'video'}
					<VideoItem
						{item}
						selected={selectedIds.has(item.id)}
						onLoad={(w, h) => onMediaLoad(item.id, w, h)}
						onUpdateMeta={onUpdateVideoMeta}
					/>
				{:else if item.type === 'youtube'}
					<YouTubeItem
						{item}
						selected={selectedIds.has(item.id)}
					/>
				{:else if item.type === 'text'}
					<TextItem
						{item}
						selected={selectedIds.has(item.id)}
						editing={editingItemId === item.id}
						onUpdateText={onUpdateText}
						onFinishEdit={() => { editingItemId = null; }}
					/>
				{/if}
			</ItemWrapper>
		{/each}
	</div>

	{#if items.length === 0 && groups.length === 0}
		<div class="empty-state">
			<div class="empty-icon">{@html icons.dropzone}</div>
			<div class="empty-title">Drop references here</div>
			<div class="empty-hint">
				Images, videos, YouTube links, or text — drag, drop, or Ctrl+V
			</div>
		</div>
	{/if}
</div>

<!-- Marquee overlay (screen-space) -->
{#if marqueeActive && marqueeRect.width > 2}
	<MarqueeRect
		x={marqueeRect.x}
		y={marqueeRect.y}
		width={marqueeRect.width}
		height={marqueeRect.height}
	/>
{/if}

<style>
	.canvas-root {
		position: fixed;
		inset: 0;
		overflow: hidden;
		background-color: var(--bg-canvas, #0a0a0a);
		background-image:
			radial-gradient(circle, var(--grid-color, rgba(255,255,255,0.06)) 1px, transparent 1px),
			radial-gradient(circle, var(--grid-color-major, rgba(255,255,255,0.12)) 1px, transparent 1px);
		cursor: default;
		outline: none;
	}

	.canvas-root.panning {
		cursor: grab;
	}

	.canvas-layer {
		position: absolute;
		top: 0;
		left: 0;
		width: 0;
		height: 0;
	}

	.empty-state {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		color: #666;
		pointer-events: none;
		user-select: none;
	}

	.empty-icon {
		margin-bottom: 1.5rem;
		opacity: 0.15;
		color: var(--text-muted, #484848);
	}

	.empty-title {
		font-size: 1.3rem;
		font-weight: 600;
		margin-bottom: 0.5rem;
		color: var(--text-secondary, #808080);
		letter-spacing: 0.02em;
	}

	.empty-hint {
		font-size: 0.85rem;
		color: var(--text-muted, #484848);
	}
</style>
