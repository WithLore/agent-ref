/**
 * Group actions — manipulate groups and their child items.
 *
 * Groups are spatial containers. Items reference groups via groupId.
 * Moving a group moves all its children.
 */

import type { BoardItem, GroupData } from '$lib/items/item-types.js';
import { createGroup } from '$lib/items/item-types.js';

export interface GroupStore {
	readonly groups: GroupData[];
	updateGroups(fn: (groups: GroupData[]) => GroupData[]): void;
}

export interface BoardStore {
	readonly items: BoardItem[];
	update(fn: (items: BoardItem[]) => BoardItem[]): void;
}

/** Optional atomic update function to avoid double renders. */
export interface AtomicUpdater {
	updateBoardAndGroups(
		itemsFn: (items: BoardItem[]) => BoardItem[],
		groupsFn: (groups: GroupData[]) => GroupData[]
	): void;
}

export function createGroupActions(groupStore: GroupStore, boardStore: BoardStore, atomic?: AtomicUpdater) {
	function addGroup(
		x: number,
		y: number,
		width: number,
		height: number,
		label?: string
	): string {
		const group = createGroup({ x, y, width, height, label });
		groupStore.updateGroups((groups) => [...groups, group]);
		return group.id;
	}

	/**
	 * Group selected items: compute bounding box, create frame, assign groupId.
	 */
	function groupSelectedItems(itemIds: Set<string>): string | null {
		const items = boardStore.items.filter((it) => itemIds.has(it.id));
		if (items.length === 0) return null;

		const padding = 20;
		const minX = Math.min(...items.map((it) => it.x)) - padding;
		const minY = Math.min(...items.map((it) => it.y)) - padding;
		const maxX = Math.max(...items.map((it) => it.x + it.width)) + padding;
		const maxY = Math.max(...items.map((it) => it.y + it.height)) + padding;

		// zIndex below the lowest item
		const minZ = Math.min(...items.map((it) => it.zIndex));
		const groupId = addGroup(minX, minY, maxX - minX, maxY - minY);

		// Set group z below items
		groupStore.updateGroups((groups) =>
			groups.map((g) => (g.id === groupId ? { ...g, zIndex: minZ - 1 } : g))
		);

		// Assign groupId to items
		boardStore.update((allItems) =>
			allItems.map((it) => (itemIds.has(it.id) ? { ...it, groupId } : it))
		);

		return groupId;
	}

	/**
	 * Ungroup: remove groupId from items, delete the group frame.
	 */
	function ungroupItems(groupId: string) {
		boardStore.update((items) =>
			items.map((it) => (it.groupId === groupId ? { ...it, groupId: undefined } : it))
		);
		groupStore.updateGroups((groups) => groups.filter((g) => g.id !== groupId));
	}

	/**
	 * Move group frame and all children by (dx, dy).
	 * Uses atomic update when available to avoid double render per frame.
	 */
	function moveGroup(groupId: string, dx: number, dy: number) {
		const itemsFn = (items: BoardItem[]) =>
			items.map((it) =>
				it.groupId === groupId ? { ...it, x: it.x + dx, y: it.y + dy } : it
			);
		const groupsFn = (groups: GroupData[]) =>
			groups.map((g) =>
				g.id === groupId ? { ...g, x: g.x + dx, y: g.y + dy } : g
			);

		if (atomic) {
			atomic.updateBoardAndGroups(itemsFn, groupsFn);
		} else {
			groupStore.updateGroups(groupsFn);
			boardStore.update(itemsFn);
		}
	}

	/**
	 * Resize group frame.
	 */
	function resizeGroup(
		groupId: string,
		width: number,
		height: number,
		opts?: { x?: number; y?: number }
	) {
		groupStore.updateGroups((groups) =>
			groups.map((g) => {
				if (g.id !== groupId) return g;
				return {
					...g,
					width,
					height,
					...(opts?.x !== undefined ? { x: opts.x } : {}),
					...(opts?.y !== undefined ? { y: opts.y } : {})
				};
			})
		);
	}

	/**
	 * Delete group. Optionally delete children or just ungroup them.
	 */
	function deleteGroup(groupId: string, deleteChildren = false): BoardItem[] {
		let deleted: BoardItem[] = [];
		if (deleteChildren) {
			boardStore.update((items) => {
				const kept: BoardItem[] = [];
				for (const it of items) {
					if (it.groupId === groupId) {
						deleted.push(it);
					} else {
						kept.push(it);
					}
				}
				return kept;
			});
		} else {
			// Just ungroup
			boardStore.update((items) =>
				items.map((it) => (it.groupId === groupId ? { ...it, groupId: undefined } : it))
			);
		}
		groupStore.updateGroups((groups) => groups.filter((g) => g.id !== groupId));
		return deleted;
	}

	/**
	 * Get all item IDs that belong to a group.
	 */
	function selectGroupItems(groupId: string): string[] {
		return boardStore.items.filter((it) => it.groupId === groupId).map((it) => it.id);
	}

	function renameGroup(groupId: string, label: string) {
		groupStore.updateGroups((groups) =>
			groups.map((g) => (g.id === groupId ? { ...g, label } : g))
		);
	}

	function setGroupColor(groupId: string, color: string) {
		groupStore.updateGroups((groups) =>
			groups.map((g) => (g.id === groupId ? { ...g, color } : g))
		);
	}

	function toggleGroupLock(groupId: string) {
		groupStore.updateGroups((groups) =>
			groups.map((g) => (g.id === groupId ? { ...g, locked: !g.locked } : g))
		);
	}

	/** Check if an item belongs to a locked group. */
	function isItemLocked(item: { groupId?: string }): boolean {
		if (!item.groupId) return false;
		const group = groupStore.groups.find((g) => g.id === item.groupId);
		return group?.locked ?? false;
	}

	return {
		addGroup,
		groupSelectedItems,
		ungroupItems,
		moveGroup,
		resizeGroup,
		deleteGroup,
		selectGroupItems,
		renameGroup,
		setGroupColor,
		toggleGroupLock,
		isItemLocked
	};
}
