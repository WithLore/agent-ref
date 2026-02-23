<script lang="ts">
	import type { GroupData } from '$lib/items/item-types.js';
	import { icons } from '$lib/ui/icons.js';

	let {
		group,
		scale,
		selected = false,
		spaceHeld = false,
		onSelect,
		onMove,
		onPan,
		onContextMenu
	}: {
		group: GroupData;
		scale: number;
		selected?: boolean;
		spaceHeld?: boolean;
		onSelect: (id: string, multi: boolean) => void;
		onMove: (id: string, dx: number, dy: number) => void;
		onPan?: (dx: number, dy: number) => void;
		onContextMenu?: (id: string, x: number, y: number) => void;
	} = $props();

	let dragging = $state(false);
	let didDrag = $state(false);
	let panning = $state(false);

	function onPointerDown(e: PointerEvent) {
		if (e.button !== 0) return;

		if (spaceHeld) {
			panning = true;
			(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
			e.stopPropagation();
			return;
		}

		e.stopPropagation();

		if (!selected) {
			onSelect(group.id, e.shiftKey);
		}

		dragging = true;
		didDrag = false;
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
	}

	function onPointerMove(e: PointerEvent) {
		if (panning) {
			onPan?.(e.movementX, e.movementY);
			return;
		}
		if (!dragging) return;
		didDrag = true;
		onMove(group.id, e.movementX / scale, e.movementY / scale);
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

		if (!didDrag && selected) {
			onSelect(group.id, false);
		}
	}

	function onPointerCancel() {
		dragging = false;
		panning = false;
		didDrag = false;
	}

	function handleContextMenu(e: MouseEvent) {
		e.preventDefault();
		e.stopPropagation();
		onContextMenu?.(group.id, e.clientX, e.clientY);
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="group-frame"
	class:selected
	class:dragging
	style:transform="translate({group.x}px, {group.y}px)"
	style:width="{group.width}px"
	style:height="{group.height}px"
	style:z-index={group.zIndex}
	style:--group-color={group.color}
	style:--inv-scale={1 / scale}
	onpointerdown={onPointerDown}
	onpointermove={onPointerMove}
	onpointerup={onPointerUp}
	onpointercancel={onPointerCancel}
	onlostpointercapture={onPointerCancel}
	oncontextmenu={handleContextMenu}
>
	<div class="group-header">
		{#if group.locked}
			<span class="lock-icon">{@html icons.lock}</span>
		{/if}
		<span class="group-label">{group.label}</span>
	</div>
</div>

<style>
	.group-frame {
		position: absolute;
		border: calc(1.5px * var(--inv-scale)) dashed var(--group-color, #808080);
		background: color-mix(in srgb, var(--group-color, #808080) 5%, transparent);
		border-radius: calc(6px * var(--inv-scale));
		cursor: grab;
		touch-action: none;
		box-sizing: border-box;
	}

	.group-frame.dragging {
		cursor: grabbing;
	}

	.group-frame.selected {
		border-style: solid;
		border-width: calc(2px * var(--inv-scale));
		background: color-mix(in srgb, var(--group-color, #808080) 8%, transparent);
	}

	.group-header {
		position: absolute;
		top: calc(-22px * var(--inv-scale));
		left: 0;
		padding: calc(2px * var(--inv-scale)) calc(8px * var(--inv-scale));
		background: var(--group-color, #808080);
		border-radius: calc(4px * var(--inv-scale)) calc(4px * var(--inv-scale)) 0 0;
		pointer-events: none;
	}

	.group-label {
		font-size: calc(11px * var(--inv-scale));
		color: #fff;
		font-weight: 500;
		white-space: nowrap;
		user-select: none;
	}

	.lock-icon {
		display: inline-flex;
		align-items: center;
		opacity: 0.8;
		margin-right: calc(3px * var(--inv-scale));
	}

	.lock-icon :global(svg) {
		width: calc(10px * var(--inv-scale));
		height: calc(10px * var(--inv-scale));
	}
</style>
