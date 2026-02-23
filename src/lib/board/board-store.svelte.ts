/**
 * Board store — Phase 1 local implementation.
 *
 * Simple $state array of BoardItems. In Phase 3 this gets replaced
 * by a Yjs sync-bridge that produces the same interface.
 */

import type { BoardItem } from '$lib/items/item-types.js';

export function createBoardStore() {
	let items = $state<BoardItem[]>([]);

	return {
		get items() {
			return items;
		},
		update(fn: (items: BoardItem[]) => BoardItem[]) {
			items = fn(items);
		}
	};
}
