import { describe, it, expect, beforeEach } from 'vitest';
import { createBoardActions, type BoardStore } from './board-actions.js';
import type { BoardItem } from '$lib/items/item-types.js';

/** Minimal in-memory BoardStore for testing. */
function createTestStore(initial: BoardItem[] = []): BoardStore {
	let items = [...initial];
	return {
		get items() {
			return items;
		},
		update(fn: (items: BoardItem[]) => BoardItem[]) {
			items = fn(items);
		}
	};
}

function makeItem(overrides: Partial<BoardItem> = {}): BoardItem {
	return {
		id: overrides.id ?? crypto.randomUUID(),
		type: 'image',
		url: 'test.png',
		x: 0,
		y: 0,
		width: 100,
		height: 100,
		zIndex: 0,
		rotation: 0,
		tags: [],
		rating: 0,
		...overrides
	};
}

describe('createBoardActions', () => {
	let store: BoardStore;
	let actions: ReturnType<typeof createBoardActions>;

	beforeEach(() => {
		store = createTestStore();
		actions = createBoardActions(store);
	});

	describe('addItem', () => {
		it('adds an item to an empty store', () => {
			const id = actions.addItem({ type: 'image', url: 'test.png', x: 10, y: 20 });
			expect(store.items).toHaveLength(1);
			expect(store.items[0].id).toBe(id);
			expect(store.items[0].x).toBe(10);
			expect(store.items[0].y).toBe(20);
		});

		it('assigns default dimensions if not provided', () => {
			actions.addItem({ type: 'image', url: 'test.png', x: 0, y: 0 });
			expect(store.items[0].width).toBe(300);
			expect(store.items[0].height).toBe(200);
		});

		it('uses provided dimensions', () => {
			actions.addItem({ type: 'image', url: 'test.png', x: 0, y: 0, width: 50, height: 75 });
			expect(store.items[0].width).toBe(50);
			expect(store.items[0].height).toBe(75);
		});

		it('stacks items at increasing zIndex', () => {
			actions.addItem({ type: 'image', url: 'a.png', x: 0, y: 0 });
			actions.addItem({ type: 'image', url: 'b.png', x: 0, y: 0 });
			actions.addItem({ type: 'image', url: 'c.png', x: 0, y: 0 });
			expect(store.items[0].zIndex).toBe(0);
			expect(store.items[1].zIndex).toBe(1);
			expect(store.items[2].zIndex).toBe(2);
		});

		it('returns unique IDs', () => {
			const ids = new Set<string>();
			for (let i = 0; i < 50; i++) {
				ids.add(actions.addItem({ type: 'text', url: 'hi', x: 0, y: 0 }));
			}
			expect(ids.size).toBe(50);
		});
	});

	describe('moveItem', () => {
		it('moves a single item by delta', () => {
			const id = actions.addItem({ type: 'image', url: 'test.png', x: 100, y: 200 });
			actions.moveItem(id, 15, -30);
			expect(store.items[0].x).toBe(115);
			expect(store.items[0].y).toBe(170);
		});

		it('does not affect other items', () => {
			const id1 = actions.addItem({ type: 'image', url: 'a.png', x: 0, y: 0 });
			actions.addItem({ type: 'image', url: 'b.png', x: 50, y: 50 });
			actions.moveItem(id1, 10, 10);
			expect(store.items[0].x).toBe(10);
			expect(store.items[1].x).toBe(50); // unchanged
		});
	});

	describe('moveItems', () => {
		it('moves multiple items by the same delta', () => {
			const id1 = actions.addItem({ type: 'image', url: 'a.png', x: 0, y: 0 });
			const id2 = actions.addItem({ type: 'image', url: 'b.png', x: 100, y: 100 });
			actions.addItem({ type: 'image', url: 'c.png', x: 200, y: 200 });

			actions.moveItems(new Set([id1, id2]), 5, -5);
			expect(store.items[0].x).toBe(5);
			expect(store.items[0].y).toBe(-5);
			expect(store.items[1].x).toBe(105);
			expect(store.items[1].y).toBe(95);
			expect(store.items[2].x).toBe(200); // not in set, unchanged
		});
	});

	describe('resizeItem', () => {
		it('changes width and height', () => {
			const id = actions.addItem({ type: 'image', url: 'test.png', x: 0, y: 0 });
			actions.resizeItem(id, 500, 300);
			expect(store.items[0].width).toBe(500);
			expect(store.items[0].height).toBe(300);
		});

		it('can optionally set position too', () => {
			const id = actions.addItem({ type: 'image', url: 'test.png', x: 10, y: 20 });
			actions.resizeItem(id, 500, 300, { x: 5, y: 15 });
			expect(store.items[0].x).toBe(5);
			expect(store.items[0].y).toBe(15);
			expect(store.items[0].width).toBe(500);
		});

		it('preserves position when opts not provided', () => {
			const id = actions.addItem({ type: 'image', url: 'test.png', x: 10, y: 20 });
			actions.resizeItem(id, 500, 300);
			expect(store.items[0].x).toBe(10);
			expect(store.items[0].y).toBe(20);
		});
	});

	describe('deleteItems', () => {
		it('removes items by ID set', () => {
			const id1 = actions.addItem({ type: 'image', url: 'a.png', x: 0, y: 0 });
			const id2 = actions.addItem({ type: 'image', url: 'b.png', x: 0, y: 0 });
			actions.addItem({ type: 'image', url: 'c.png', x: 0, y: 0 });

			actions.deleteItems(new Set([id1, id2]));
			expect(store.items).toHaveLength(1);
			expect(store.items[0].url).toBe('c.png');
		});

		it('returns the deleted items for undo', () => {
			const id1 = actions.addItem({ type: 'image', url: 'a.png', x: 0, y: 0 });
			actions.addItem({ type: 'image', url: 'b.png', x: 0, y: 0 });

			const deleted = actions.deleteItems(new Set([id1]));
			expect(deleted).toHaveLength(1);
			expect(deleted[0].id).toBe(id1);
			expect(deleted[0].url).toBe('a.png');
		});

		it('returns empty array when no items match', () => {
			actions.addItem({ type: 'image', url: 'a.png', x: 0, y: 0 });
			const deleted = actions.deleteItems(new Set(['nonexistent']));
			expect(deleted).toHaveLength(0);
			expect(store.items).toHaveLength(1);
		});
	});

	describe('restoreItems', () => {
		it('adds previously deleted items back', () => {
			const id = actions.addItem({ type: 'image', url: 'a.png', x: 10, y: 20 });
			const deleted = actions.deleteItems(new Set([id]));
			expect(store.items).toHaveLength(0);

			actions.restoreItems(deleted);
			expect(store.items).toHaveLength(1);
			expect(store.items[0].id).toBe(id);
			expect(store.items[0].x).toBe(10);
		});
	});

	describe('bringToFront', () => {
		it('sets zIndex to max + 1', () => {
			const id1 = actions.addItem({ type: 'image', url: 'a.png', x: 0, y: 0 }); // z=0
			const id2 = actions.addItem({ type: 'image', url: 'b.png', x: 0, y: 0 }); // z=1

			actions.bringToFront(id1);
			expect(store.items[0].zIndex).toBe(2); // was 0, now 2
			expect(store.items[1].zIndex).toBe(1); // unchanged
		});

		it('short-circuits when item is already at front', () => {
			const id1 = actions.addItem({ type: 'image', url: 'a.png', x: 0, y: 0 });
			const id2 = actions.addItem({ type: 'image', url: 'b.png', x: 0, y: 0 }); // z=1, already at front

			const before = [...store.items];
			actions.bringToFront(id2);
			// Items should be reference-equal (no update called)
			expect(store.items[0]).toEqual(before[0]);
			expect(store.items[1]).toEqual(before[1]);
		});
	});

	describe('tagItem', () => {
		it('adds a tag to an item', () => {
			const id = actions.addItem({ type: 'image', url: 'a.png', x: 0, y: 0 });
			actions.tagItem(id, 'reference');
			expect(store.items[0].tags).toEqual(['reference']);
		});

		it('does not add duplicate tags', () => {
			const id = actions.addItem({ type: 'image', url: 'a.png', x: 0, y: 0 });
			actions.tagItem(id, 'ref');
			actions.tagItem(id, 'ref');
			expect(store.items[0].tags).toEqual(['ref']);
		});

		it('supports multiple different tags', () => {
			const id = actions.addItem({ type: 'image', url: 'a.png', x: 0, y: 0 });
			actions.tagItem(id, 'character');
			actions.tagItem(id, 'pose');
			expect(store.items[0].tags).toEqual(['character', 'pose']);
		});
	});

	describe('removeTag', () => {
		it('removes a specific tag', () => {
			const id = actions.addItem({ type: 'image', url: 'a.png', x: 0, y: 0 });
			actions.tagItem(id, 'a');
			actions.tagItem(id, 'b');
			actions.tagItem(id, 'c');
			actions.removeTag(id, 'b');
			expect(store.items[0].tags).toEqual(['a', 'c']);
		});

		it('is a no-op for non-existent tags', () => {
			const id = actions.addItem({ type: 'image', url: 'a.png', x: 0, y: 0 });
			actions.tagItem(id, 'a');
			actions.removeTag(id, 'x');
			expect(store.items[0].tags).toEqual(['a']);
		});
	});

	describe('rateItem', () => {
		it('sets rating 0-3', () => {
			const id = actions.addItem({ type: 'image', url: 'a.png', x: 0, y: 0 });
			actions.rateItem(id, 3);
			expect(store.items[0].rating).toBe(3);
			actions.rateItem(id, 0);
			expect(store.items[0].rating).toBe(0);
		});
	});

	describe('updateText', () => {
		it('sets the url field (used as text content for text items)', () => {
			const id = actions.addItem({ type: 'text', url: 'Hello', x: 0, y: 0 });
			actions.updateText(id, 'World');
			expect(store.items[0].url).toBe('World');
		});
	});

	describe('rotateItem', () => {
		it('sets absolute rotation in degrees', () => {
			const id = actions.addItem({ type: 'image', url: 'a.png', x: 0, y: 0 });
			actions.rotateItem(id, 45);
			expect(store.items[0].rotation).toBe(45);
		});

		it('supports negative rotation', () => {
			const id = actions.addItem({ type: 'image', url: 'a.png', x: 0, y: 0 });
			actions.rotateItem(id, -30);
			expect(store.items[0].rotation).toBe(-30);
		});
	});

	describe('setItemPositions', () => {
		it('batch-sets positions from a map', () => {
			const id1 = actions.addItem({ type: 'image', url: 'a.png', x: 0, y: 0 });
			const id2 = actions.addItem({ type: 'image', url: 'b.png', x: 50, y: 50 });
			const id3 = actions.addItem({ type: 'image', url: 'c.png', x: 100, y: 100 });

			const positions = new Map([
				[id1, { x: 10, y: 10 }],
				[id3, { x: 10, y: 200 }]
			]);
			actions.setItemPositions(positions);

			expect(store.items[0].x).toBe(10);
			expect(store.items[0].y).toBe(10);
			expect(store.items[1].x).toBe(50); // not in map, unchanged
			expect(store.items[2].x).toBe(10);
			expect(store.items[2].y).toBe(200);
		});
	});

	describe('updateVideoMeta', () => {
		it('sets video metadata', () => {
			const id = actions.addItem({ type: 'video', url: 'vid.mp4', x: 0, y: 0 });
			actions.updateVideoMeta(id, { muted: false, loopStart: 10 });
			expect(store.items[0].videoMeta?.muted).toBe(false);
			expect(store.items[0].videoMeta?.loopStart).toBe(10);
		});

		it('preserves existing videoMeta fields', () => {
			const id = actions.addItem({ type: 'video', url: 'vid.mp4', x: 0, y: 0 });
			// createItem sets default videoMeta for video type
			actions.updateVideoMeta(id, { muted: false });
			expect(store.items[0].videoMeta?.loopStart).toBe(0);
			expect(store.items[0].videoMeta?.loopEnd).toBe(100);
		});
	});

	describe('delete + restore roundtrip (undo pattern)', () => {
		it('restores exact item state after delete', () => {
			const id = actions.addItem({ type: 'image', url: 'test.png', x: 42, y: 99 });
			actions.tagItem(id, 'hero');
			actions.rateItem(id, 3);
			actions.rotateItem(id, 15);

			const before = { ...store.items[0] };
			const deleted = actions.deleteItems(new Set([id]));
			expect(store.items).toHaveLength(0);

			actions.restoreItems(deleted);
			expect(store.items).toHaveLength(1);
			expect(store.items[0]).toEqual(before);
		});
	});
});
