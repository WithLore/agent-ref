<script lang="ts">
	import { onDestroy } from 'svelte';
	import type { Snippet } from 'svelte';
	import type { BoardItem } from './item-types.js';
	import { icons } from '$lib/ui/icons.js';

	let {
		item,
		scale,
		selected = false,
		spaceHeld = false,
		locked = false,
		onSelect,
		onMoveStart,
		onMove,
		onMoveEnd,
		onResize,
		onResizeEnd,
		onRotate,
		onRotateEnd,
		onMoveGroup,
		onDblClick,
		onPan,
		onContextMenu,
		children
	}: {
		item: BoardItem;
		scale: number;
		selected?: boolean;
		spaceHeld?: boolean;
		locked?: boolean;
		onSelect: (id: string, multi: boolean) => void;
		onMoveStart?: (id: string) => void;
		onMove: (id: string, dx: number, dy: number) => void;
		onMoveEnd?: (id: string) => void;
		onResize: (id: string, width: number, height: number, absX: number, absY: number) => void;
		onResizeEnd?: (id: string) => void;
		onRotate?: (id: string, rotation: number) => void;
		onRotateEnd?: (id: string) => void;
		onMoveGroup?: (groupId: string, dx: number, dy: number) => void;
		onDblClick?: (id: string) => void;
		onPan?: (dx: number, dy: number) => void;
		onContextMenu?: (id: string, x: number, y: number) => void;
		children: Snippet;
	} = $props();

	let dragging = $state(false);
	let didDrag = $state(false);
	let panning = $state(false);
	let resizing = $state(false);

	// Double-click detection (since setPointerCapture steals click/dblclick from children)
	let lastClickTime = 0;
	let lastClickId = '';
	let resizeStartX = 0;
	let resizeStartY = 0;
	let resizeStartW = 0;
	let resizeStartH = 0;
	let aspectRatio = 1;

	// --- Drag ---

	function onPointerDown(e: PointerEvent) {
		if (e.button !== 0) return;

		// If space is held, pass through to canvas for panning
		if (spaceHeld) {
			panning = true;
			(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
			e.stopPropagation();
			return;
		}

		e.stopPropagation();

		// If already selected (part of multi-select), don't reset selection on pointerdown.
		// We'll handle selection change on pointerup if there was no drag.
		if (!selected) {
			onSelect(item.id, e.shiftKey);
		} else if (e.shiftKey) {
			// Shift+click on already-selected item: toggle it off
			onSelect(item.id, true);
			return; // Don't start drag after deselecting
		}

		dragging = true;
		didDrag = false;
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		onMoveStart?.(item.id);
	}

	function onPointerMove(e: PointerEvent) {
		if (panning) {
			onPan?.(e.movementX, e.movementY);
			return;
		}
		if (!dragging) return;
		didDrag = true;
		const dx = e.movementX / scale;
		const dy = e.movementY / scale;

		// If locked in a group, redirect drag to group move
		if (locked && item.groupId) {
			onMoveGroup?.(item.groupId, dx, dy);
			return;
		}

		// Scale-aware: divide screen movement by canvas scale
		onMove(item.id, dx, dy);
	}

	function onPointerUp(e: PointerEvent) {
		if (panning) {
			panning = false;
			(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
			return;
		}
		if (!dragging) return;
		dragging = false;
		(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);

		// If we didn't drag, this was a click — check for double-click
		if (!didDrag) {
			const now = Date.now();
			if (now - lastClickTime < 400 && lastClickId === item.id) {
				// Double-click detected!
				lastClickTime = 0;
				onDblClick?.(item.id);
			} else {
				lastClickTime = now;
				lastClickId = item.id;
				if (selected) {
					onSelect(item.id, false); // Collapse to single selection on click
				}
			}
		}

		onMoveEnd?.(item.id);
	}

	function onPointerCancel(e: PointerEvent) {
		dragging = false;
		panning = false;
		didDrag = false;
	}

	function onLostPointerCapture(e: PointerEvent) {
		dragging = false;
		panning = false;
		didDrag = false;
	}

	// --- Resize ---

	let resizeCorner: 'se' | 'ne' | 'sw' | 'nw' = 'se';
	let resizeStartItemX = 0;
	let resizeStartItemY = 0;

	function startResize(corner: 'se' | 'ne' | 'sw' | 'nw', e: PointerEvent) {
		e.stopPropagation();
		e.preventDefault();
		resizing = true;
		resizeCorner = corner;
		resizeStartX = e.clientX;
		resizeStartY = e.clientY;
		resizeStartW = item.width;
		resizeStartH = item.height;
		resizeStartItemX = item.x;
		resizeStartItemY = item.y;
		aspectRatio = item.width / item.height;
		window.addEventListener('pointermove', onResizePointerMove);
		window.addEventListener('pointerup', onResizePointerUp);
		window.addEventListener('pointercancel', onResizePointerUp);
	}

	function onResizePointerMove(e: PointerEvent) {
		if (!resizing) return;

		// Project screen deltas onto item's local axes for rotation support
		const angle = -(item.rotation * Math.PI) / 180;
		const cos = Math.cos(angle);
		const sin = Math.sin(angle);
		const screenDx = (e.clientX - resizeStartX) / scale;
		const screenDy = (e.clientY - resizeStartY) / scale;
		const rawDx = screenDx * cos - screenDy * sin;
		const rawDy = screenDx * sin + screenDy * cos;

		let newWidth: number;
		let targetX = resizeStartItemX;
		let targetY = resizeStartItemY;

		// Compute size delta based on which corner is being dragged
		switch (resizeCorner) {
			case 'se': {
				// SE: grow right and down — anchor is top-left, no position change
				const delta = Math.abs(rawDx) > Math.abs(rawDy) ? rawDx : rawDy * aspectRatio;
				newWidth = Math.max(20, resizeStartW + delta);
				break;
			}
			case 'ne': {
				// NE: grow right and up — anchor is bottom-left, move Y
				const delta = Math.abs(rawDx) > Math.abs(rawDy) ? rawDx : -rawDy * aspectRatio;
				newWidth = Math.max(20, resizeStartW + delta);
				const newHeight = newWidth / aspectRatio;
				targetY = resizeStartItemY + (resizeStartH - newHeight);
				break;
			}
			case 'sw': {
				// SW: grow left and down — anchor is top-right, move X
				const delta = Math.abs(rawDx) > Math.abs(rawDy) ? -rawDx : rawDy * aspectRatio;
				newWidth = Math.max(20, resizeStartW + delta);
				targetX = resizeStartItemX + (resizeStartW - newWidth);
				break;
			}
			case 'nw': {
				// NW: grow left and up — anchor is bottom-right, move both
				const delta = Math.abs(rawDx) > Math.abs(rawDy) ? -rawDx : -rawDy * aspectRatio;
				newWidth = Math.max(20, resizeStartW + delta);
				const newHeight = newWidth / aspectRatio;
				targetX = resizeStartItemX + (resizeStartW - newWidth);
				targetY = resizeStartItemY + (resizeStartH - newHeight);
				break;
			}
		}

		const newHeight = newWidth / aspectRatio;
		onResize(item.id, newWidth, newHeight, targetX, targetY);
	}

	function handleContextMenu(e: MouseEvent) {
		e.preventDefault();
		e.stopPropagation();
		onContextMenu?.(item.id, e.clientX, e.clientY);
	}

	function onResizePointerUp() {
		resizing = false;
		cleanupResizeListeners();
		onResizeEnd?.(item.id);
	}

	function cleanupResizeListeners() {
		window.removeEventListener('pointermove', onResizePointerMove);
		window.removeEventListener('pointerup', onResizePointerUp);
		window.removeEventListener('pointercancel', onResizePointerUp);
	}

	// --- Rotation ---

	let rotating = $state(false);
	let rotateStartAngle = 0;
	let rotateStartItemRotation = 0;
	let rotateCenterX = 0;
	let rotateCenterY = 0;

	function startRotation(e: PointerEvent) {
		e.stopPropagation();
		e.preventDefault();
		rotating = true;

		// Compute center of item in screen space from the wrapper's bounding rect
		const wrapper = (e.currentTarget as HTMLElement).closest('.item-wrapper');
		if (!wrapper) return;
		const rect = wrapper.getBoundingClientRect();
		rotateCenterX = rect.left + rect.width / 2;
		rotateCenterY = rect.top + rect.height / 2;

		rotateStartAngle = Math.atan2(e.clientY - rotateCenterY, e.clientX - rotateCenterX);
		rotateStartItemRotation = item.rotation;

		window.addEventListener('pointermove', onRotatePointerMove);
		window.addEventListener('pointerup', onRotatePointerUp);
		window.addEventListener('pointercancel', onRotatePointerUp);
	}

	function onRotatePointerMove(e: PointerEvent) {
		if (!rotating) return;
		const currentAngle = Math.atan2(e.clientY - rotateCenterY, e.clientX - rotateCenterX);
		let deltaDeg = ((currentAngle - rotateStartAngle) * 180) / Math.PI;
		let newRotation = rotateStartItemRotation + deltaDeg;

		// Shift = snap to 15 degree increments
		if (e.shiftKey) {
			newRotation = Math.round(newRotation / 15) * 15;
		}

		onRotate?.(item.id, newRotation);
	}

	function onRotatePointerUp() {
		rotating = false;
		window.removeEventListener('pointermove', onRotatePointerMove);
		window.removeEventListener('pointerup', onRotatePointerUp);
		window.removeEventListener('pointercancel', onRotatePointerUp);
		onRotateEnd?.(item.id);
	}

	// Clean up window-level listeners if component destroyed mid-interaction
	onDestroy(() => {
		if (resizing) cleanupResizeListeners();
		if (rotating) {
			window.removeEventListener('pointermove', onRotatePointerMove);
			window.removeEventListener('pointerup', onRotatePointerUp);
			window.removeEventListener('pointercancel', onRotatePointerUp);
		}
	});
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="item-wrapper"
	class:selected
	class:dragging
	style:transform="translate({item.x}px, {item.y}px) rotate({item.rotation}deg)"
	style:width="{item.width}px"
	style:height="{item.height}px"
	style:z-index={item.zIndex}
	style:--inv-scale={1 / scale}
	onpointerdown={onPointerDown}
	onpointermove={onPointerMove}
	onpointerup={onPointerUp}
	onpointercancel={onPointerCancel}
	onlostpointercapture={onLostPointerCapture}
	oncontextmenu={handleContextMenu}
>
	{@render children()}

	<!-- Rating/tag badges (always visible, subtle) -->
	{#if item.rating > 0}
		<div class="badge rating-badge">
			{@html icons.starFilled}
			<span>{item.rating}</span>
		</div>
	{/if}
	{#if item.tags.length > 0}
		<div class="badge tag-badge">
			{@html icons.tag}
			<span>{item.tags.length}</span>
		</div>
	{/if}

	{#if selected}
		<!-- Rotation handle -->
		<div class="rotation-line"></div>
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="rotation-handle" onpointerdown={startRotation}></div>

		<!-- Resize handles -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="resize-handle se" onpointerdown={(e) => startResize('se', e)}></div>
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="resize-handle ne" onpointerdown={(e) => startResize('ne', e)}></div>
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="resize-handle sw" onpointerdown={(e) => startResize('sw', e)}></div>
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="resize-handle nw" onpointerdown={(e) => startResize('nw', e)}></div>
	{/if}
</div>

<style>
	.item-wrapper {
		position: absolute;
		cursor: grab;
		box-sizing: border-box;
		touch-action: none;
	}

	.item-wrapper.dragging {
		cursor: grabbing;
	}

	.item-wrapper.selected {
		outline: calc(1.5px * var(--inv-scale)) solid var(--selection, #fff);
		outline-offset: calc(2px * var(--inv-scale));
	}

	/* --- Badges --- */

	.badge {
		position: absolute;
		display: flex;
		align-items: center;
		gap: calc(2px * var(--inv-scale));
		padding: calc(2px * var(--inv-scale)) calc(4px * var(--inv-scale));
		background: rgba(0, 0, 0, 0.6);
		border-radius: calc(4px * var(--inv-scale));
		pointer-events: none;
		font-size: calc(9px * var(--inv-scale));
		color: #ccc;
		line-height: 1;
	}

	.badge :global(svg) {
		width: calc(10px * var(--inv-scale));
		height: calc(10px * var(--inv-scale));
	}

	.rating-badge {
		top: calc(4px * var(--inv-scale));
		right: calc(4px * var(--inv-scale));
		color: #fbbf24;
	}

	.tag-badge {
		top: calc(4px * var(--inv-scale));
		left: calc(4px * var(--inv-scale));
		color: #94a3b8;
	}

	/* --- Rotation handle --- */

	.rotation-line {
		position: absolute;
		top: calc(-25px * var(--inv-scale));
		left: 50%;
		width: calc(1px * var(--inv-scale));
		height: calc(20px * var(--inv-scale));
		background: var(--selection, #fff);
		transform: translateX(-50%);
		pointer-events: none;
		opacity: 0.6;
	}

	.rotation-handle {
		position: absolute;
		top: calc(-32px * var(--inv-scale));
		left: 50%;
		width: calc(10px * var(--inv-scale));
		height: calc(10px * var(--inv-scale));
		border-radius: 50%;
		background: var(--selection, #fff);
		border: calc(1px * var(--inv-scale)) solid var(--bg-canvas, #0a0a0a);
		transform: translateX(-50%);
		cursor: grab;
		touch-action: none;
	}

	.rotation-handle:hover {
		background: #a5b4fc;
	}

	/* --- Resize handles --- */

	.resize-handle {
		position: absolute;
		width: calc(10px * var(--inv-scale));
		height: calc(10px * var(--inv-scale));
		background: var(--selection, #fff);
		border: calc(1px * var(--inv-scale)) solid var(--bg-canvas, #0a0a0a);
		border-radius: calc(2px * var(--inv-scale));
		cursor: nwse-resize;
		touch-action: none;
	}

	.resize-handle.se {
		bottom: calc(-5px * var(--inv-scale));
		right: calc(-5px * var(--inv-scale));
	}

	.resize-handle.ne {
		top: calc(-5px * var(--inv-scale));
		right: calc(-5px * var(--inv-scale));
	}

	.resize-handle.sw {
		bottom: calc(-5px * var(--inv-scale));
		left: calc(-5px * var(--inv-scale));
	}

	.resize-handle.nw {
		top: calc(-5px * var(--inv-scale));
		left: calc(-5px * var(--inv-scale));
	}
</style>
