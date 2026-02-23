/**
 * Board actions — imperative functions for manipulating items.
 *
 * Phase 1: operates on a plain array via callbacks.
 * Phase 3: swaps to Yjs ydoc.transact() calls — same interface.
 */

import type { BoardItem, ItemType, VideoMeta } from '$lib/items/item-types.js';
import { createItem } from '$lib/items/item-types.js';

export interface BoardStore {
	readonly items: BoardItem[];
	update(fn: (items: BoardItem[]) => BoardItem[]): void;
}

export function createBoardActions(store: BoardStore) {
	function addItem(props: {
		type: ItemType;
		url: string;
		x: number;
		y: number;
		width?: number;
		height?: number;
	}): string {
		const maxZ = store.items.reduce((max, it) => Math.max(max, it.zIndex), -1);
		const item = createItem({
			...props,
			width: props.width ?? 300,
			height: props.height ?? 200,
			zIndex: maxZ + 1
		});
		store.update((items) => [...items, item]);
		return item.id;
	}

	function moveItem(id: string, dx: number, dy: number) {
		store.update((items) =>
			items.map((it) => (it.id === id ? { ...it, x: it.x + dx, y: it.y + dy } : it))
		);
	}

	function moveItems(ids: Set<string>, dx: number, dy: number) {
		store.update((items) =>
			items.map((it) => (ids.has(it.id) ? { ...it, x: it.x + dx, y: it.y + dy } : it))
		);
	}

	function resizeItem(
		id: string,
		width: number,
		height: number,
		opts?: { x?: number; y?: number }
	) {
		store.update((items) =>
			items.map((it) => {
				if (it.id !== id) return it;
				return {
					...it,
					width,
					height,
					...(opts?.x !== undefined ? { x: opts.x } : {}),
					...(opts?.y !== undefined ? { y: opts.y } : {})
				};
			})
		);
	}

	function deleteItems(ids: Set<string>): BoardItem[] {
		const deleted: BoardItem[] = [];
		store.update((items) => {
			const kept: BoardItem[] = [];
			for (const it of items) {
				if (ids.has(it.id)) {
					deleted.push(it);
				} else {
					kept.push(it);
				}
			}
			return kept;
		});
		return deleted;
	}

	function bringToFront(id: string) {
		const target = store.items.find((it) => it.id === id);
		const maxZ = store.items.reduce((max, it) => Math.max(max, it.zIndex), 0);
		// Short-circuit: already at front — no state mutation
		if (target && target.zIndex >= maxZ) return;
		store.update((items) =>
			items.map((it) => (it.id === id ? { ...it, zIndex: maxZ + 1 } : it))
		);
	}

	function tagItem(id: string, tag: string) {
		store.update((items) =>
			items.map((it) => {
				if (it.id !== id) return it;
				if (it.tags.includes(tag)) return it;
				return { ...it, tags: [...it.tags, tag] };
			})
		);
	}

	function rateItem(id: string, rating: number) {
		store.update((items) =>
			items.map((it) => (it.id === id ? { ...it, rating } : it))
		);
	}

	function updateVideoMeta(id: string, meta: Partial<VideoMeta>) {
		store.update((items) =>
			items.map((it) => {
				if (it.id !== id) return it;
				return {
					...it,
					videoMeta: { ...(it.videoMeta ?? { loopStart: 0, loopEnd: 100, muted: true }), ...meta }
				};
			})
		);
	}

	function updateText(id: string, text: string) {
		store.update((items) =>
			items.map((it) => (it.id === id ? { ...it, url: text } : it))
		);
	}

	/** Batch-set positions for multiple items (alignment, distribution). */
	function setItemPositions(positions: Map<string, { x: number; y: number }>) {
		store.update((items) =>
			items.map((it) => {
				const pos = positions.get(it.id);
				return pos ? { ...it, x: pos.x, y: pos.y } : it;
			})
		);
	}

	/** Set absolute rotation in degrees. */
	function rotateItem(id: string, rotation: number) {
		store.update((items) =>
			items.map((it) => (it.id === id ? { ...it, rotation } : it))
		);
	}

	/** Remove a specific tag from an item. */
	function removeTag(id: string, tag: string) {
		store.update((items) =>
			items.map((it) => {
				if (it.id !== id) return it;
				return { ...it, tags: it.tags.filter((t) => t !== tag) };
			})
		);
	}

	/** Re-add previously deleted items (for undo). */
	function restoreItems(items: BoardItem[]) {
		store.update((current) => [...current, ...items]);
	}

	return {
		addItem,
		moveItem,
		moveItems,
		resizeItem,
		deleteItems,
		bringToFront,
		tagItem,
		rateItem,
		updateVideoMeta,
		updateText,
		setItemPositions,
		rotateItem,
		removeTag,
		restoreItems
	};
}
