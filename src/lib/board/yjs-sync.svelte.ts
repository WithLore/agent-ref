/**
 * Yjs sync bridge — P2P collaborative state via CRDT.
 *
 * Replaces the Phase 1 local $state board-store with a Yjs Y.Doc
 * backed by y-webrtc for peer-to-peer sync. Produces the same
 * { items, update() } BoardStore interface so board-actions.ts
 * works unchanged.
 *
 * Architecture:
 * - Y.Doc contains Y.Array<Y.Map> for items and groups per board
 * - Observations on Y.Array/Y.Map push changes into Svelte $state
 * - The update(fn) method applies mutations via ydoc.transact()
 * - WebRTC provider handles peer discovery and sync
 * - Awareness tracks cursor positions and peer presence
 */

import * as Y from 'yjs';
// @ts-ignore — y-webrtc has no types
import { WebrtcProvider } from 'y-webrtc';
import type { BoardItem, GroupData } from '$lib/items/item-types.js';

// --- Types ---

export interface PeerInfo {
	clientId: number;
	user: { name: string; color: string };
	cursor?: { x: number; y: number };
	activeBoardId?: string;
}

export interface CollabStatus {
	connected: boolean;
	peerCount: number;
	roomId: string;
}

// --- Helpers: BoardItem <-> Y.Map ---

const ITEM_FIELDS: (keyof BoardItem)[] = [
	'id', 'type', 'url', 'x', 'y', 'width', 'height',
	'zIndex', 'rotation', 'tags', 'rating', 'groupId'
];

const GROUP_FIELDS: (keyof GroupData)[] = [
	'id', 'label', 'color', 'x', 'y', 'width', 'height', 'zIndex', 'locked'
];

function itemToYMap(item: BoardItem, doc: Y.Doc): Y.Map<unknown> {
	const ymap = new Y.Map<unknown>();
	for (const key of ITEM_FIELDS) {
		const val = item[key];
		if (val !== undefined) {
			// Arrays need to be stored as Y.Array for proper merging
			if (key === 'tags' && Array.isArray(val)) {
				const yarr = new Y.Array<string>();
				yarr.push(val as string[]);
				ymap.set(key, yarr);
			} else {
				ymap.set(key, val);
			}
		}
	}
	// VideoMeta as nested Y.Map
	if (item.videoMeta) {
		const vm = new Y.Map<unknown>();
		vm.set('loopStart', item.videoMeta.loopStart);
		vm.set('loopEnd', item.videoMeta.loopEnd);
		vm.set('muted', item.videoMeta.muted);
		ymap.set('videoMeta', vm);
	}
	return ymap;
}

function ymapToItem(ymap: Y.Map<unknown>): BoardItem {
	const tagsVal = ymap.get('tags');
	let tags: string[] = [];
	if (tagsVal instanceof Y.Array) {
		tags = tagsVal.toArray() as string[];
	} else if (Array.isArray(tagsVal)) {
		tags = tagsVal;
	}

	const vmVal = ymap.get('videoMeta');
	let videoMeta: BoardItem['videoMeta'] | undefined;
	if (vmVal instanceof Y.Map) {
		videoMeta = {
			loopStart: (vmVal.get('loopStart') as number) ?? 0,
			loopEnd: (vmVal.get('loopEnd') as number) ?? 100,
			muted: (vmVal.get('muted') as boolean) ?? true
		};
	}

	return {
		id: ymap.get('id') as string,
		type: ymap.get('type') as BoardItem['type'],
		url: ymap.get('url') as string,
		x: (ymap.get('x') as number) ?? 0,
		y: (ymap.get('y') as number) ?? 0,
		width: (ymap.get('width') as number) ?? 300,
		height: (ymap.get('height') as number) ?? 200,
		zIndex: (ymap.get('zIndex') as number) ?? 0,
		rotation: (ymap.get('rotation') as number) ?? 0,
		tags,
		rating: (ymap.get('rating') as number) ?? 0,
		videoMeta,
		groupId: ymap.get('groupId') as string | undefined
	};
}

function groupToYMap(group: GroupData): Y.Map<unknown> {
	const ymap = new Y.Map<unknown>();
	for (const key of GROUP_FIELDS) {
		const val = group[key];
		if (val !== undefined) {
			ymap.set(key, val);
		}
	}
	return ymap;
}

function ymapToGroup(ymap: Y.Map<unknown>): GroupData {
	return {
		id: ymap.get('id') as string,
		label: (ymap.get('label') as string) ?? 'Group',
		color: (ymap.get('color') as string) ?? '#808080',
		x: (ymap.get('x') as number) ?? 0,
		y: (ymap.get('y') as number) ?? 0,
		width: (ymap.get('width') as number) ?? 200,
		height: (ymap.get('height') as number) ?? 200,
		zIndex: (ymap.get('zIndex') as number) ?? 0,
		locked: (ymap.get('locked') as boolean) ?? false
	};
}

// --- Main sync factory ---

export function createYjsSync(roomId: string, boardId: string) {
	const ydoc = new Y.Doc();

	// Shared types: items and groups per board
	const yitems = ydoc.getArray<Y.Map<unknown>>(`board-${boardId}-items`);
	const ygroups = ydoc.getArray<Y.Map<unknown>>(`board-${boardId}-groups`);

	// Reactive Svelte state mirroring the CRDT
	let items = $state<BoardItem[]>(readAllItems());
	let groups = $state<GroupData[]>(readAllGroups());
	let connected = $state(false);
	let peerCount = $state(0);

	// Suppress observer → $state feedback loop
	let suppressObserver = false;

	// --- Read all items/groups from CRDT ---

	function readAllItems(): BoardItem[] {
		return yitems.toArray().map(ymapToItem);
	}

	function readAllGroups(): GroupData[] {
		return ygroups.toArray().map(ymapToGroup);
	}

	// --- Observe CRDT changes → update Svelte $state ---

	yitems.observeDeep(() => {
		if (suppressObserver) return;
		items = readAllItems();
	});

	ygroups.observeDeep(() => {
		if (suppressObserver) return;
		groups = readAllGroups();
	});

	// --- WebRTC provider ---

	const provider = new WebrtcProvider(roomId, ydoc, {
		signaling: ['wss://signaling.yjs.dev', 'wss://y-webrtc-signaling-eu.herokuapp.com'],
		maxConns: 20,
		filterBcConns: true
	});

	provider.on('status', (event: { connected: boolean }) => {
		connected = event.connected;
	});

	provider.on('peers', (event: { webrtcPeers: string[] }) => {
		peerCount = event.webrtcPeers.length;
	});

	// --- Awareness ---

	const awareness = provider.awareness;

	function setLocalUser(name: string, color: string) {
		awareness.setLocalStateField('user', { name, color });
	}

	function setLocalCursor(x: number, y: number) {
		awareness.setLocalStateField('cursor', { x, y });
	}

	function setLocalBoard(activeBoardId: string) {
		awareness.setLocalStateField('activeBoardId', activeBoardId);
	}

	function getPeers(): PeerInfo[] {
		const result: PeerInfo[] = [];
		awareness.getStates().forEach((state: Record<string, unknown>, clientId: number) => {
			if (clientId === ydoc.clientID) return; // skip self
			if (state.user) {
				result.push({
					clientId,
					user: state.user as PeerInfo['user'],
					cursor: state.cursor as PeerInfo['cursor'],
					activeBoardId: state.activeBoardId as string | undefined
				});
			}
		});
		return result;
	}

	// --- BoardStore interface (same as Phase 1) ---

	const boardStore = {
		get items(): BoardItem[] {
			return items;
		},
		update(fn: (items: BoardItem[]) => BoardItem[]) {
			const currentItems = readAllItems();
			const nextItems = fn(currentItems);

			// Diff and apply changes inside a transaction
			ydoc.transact(() => {
				suppressObserver = true;

				// Build lookup of current CRDT items by id
				const currentMap = new Map<string, number>();
				for (let i = 0; i < yitems.length; i++) {
					const id = yitems.get(i).get('id') as string;
					currentMap.set(id, i);
				}

				// Determine which items to add, update, or remove
				const nextIds = new Set(nextItems.map((it) => it.id));

				// Remove items not in next (iterate backwards to preserve indices)
				const toRemove: number[] = [];
				currentMap.forEach((idx, id) => {
					if (!nextIds.has(id)) toRemove.push(idx);
				});
				toRemove.sort((a, b) => b - a);
				for (const idx of toRemove) {
					yitems.delete(idx, 1);
				}

				// Rebuild map after deletions
				const updatedMap = new Map<string, number>();
				for (let i = 0; i < yitems.length; i++) {
					const id = yitems.get(i).get('id') as string;
					updatedMap.set(id, i);
				}

				// Update existing and add new
				for (const item of nextItems) {
					const existingIdx = updatedMap.get(item.id);
					if (existingIdx !== undefined) {
						// Update in place — only change modified fields
						const ymap = yitems.get(existingIdx);
						applyItemDiff(ymap, item);
					} else {
						// New item — add to end
						yitems.push([itemToYMap(item, ydoc)]);
					}
				}

				suppressObserver = false;
			}, 'local');

			// Immediately reflect changes
			items = readAllItems();
		}
	};

	// --- GroupStore interface ---

	const groupStore = {
		get groups(): GroupData[] {
			return groups;
		},
		updateGroups(fn: (groups: GroupData[]) => GroupData[]) {
			const currentGroups = readAllGroups();
			const nextGroups = fn(currentGroups);

			ydoc.transact(() => {
				suppressObserver = true;

				const currentMap = new Map<string, number>();
				for (let i = 0; i < ygroups.length; i++) {
					const id = ygroups.get(i).get('id') as string;
					currentMap.set(id, i);
				}

				const nextIds = new Set(nextGroups.map((g) => g.id));

				// Remove
				const toRemove: number[] = [];
				currentMap.forEach((idx, id) => {
					if (!nextIds.has(id)) toRemove.push(idx);
				});
				toRemove.sort((a, b) => b - a);
				for (const idx of toRemove) {
					ygroups.delete(idx, 1);
				}

				// Rebuild map
				const updatedMap = new Map<string, number>();
				for (let i = 0; i < ygroups.length; i++) {
					const id = ygroups.get(i).get('id') as string;
					updatedMap.set(id, i);
				}

				for (const group of nextGroups) {
					const existingIdx = updatedMap.get(group.id);
					if (existingIdx !== undefined) {
						const ymap = ygroups.get(existingIdx);
						applyGroupDiff(ymap, group);
					} else {
						ygroups.push([groupToYMap(group)]);
					}
				}

				suppressObserver = false;
			}, 'local');

			groups = readAllGroups();
		}
	};

	// --- Atomic update (items + groups in one transaction) ---

	function updateBoardAndGroups(
		itemsFn: (items: BoardItem[]) => BoardItem[],
		groupsFn: (groups: GroupData[]) => GroupData[]
	) {
		ydoc.transact(() => {
			boardStore.update(itemsFn);
			groupStore.updateGroups(groupsFn);
		}, 'local');
	}

	// --- Diff helpers (minimize CRDT operations) ---

	function applyItemDiff(ymap: Y.Map<unknown>, item: BoardItem) {
		for (const key of ITEM_FIELDS) {
			if (key === 'tags') continue; // handled separately
			if (key === 'groupId') {
				const current = ymap.get('groupId');
				if (item.groupId !== current) {
					if (item.groupId !== undefined) {
						ymap.set('groupId', item.groupId);
					} else {
						ymap.delete('groupId');
					}
				}
				continue;
			}
			const current = ymap.get(key);
			const next = item[key];
			if (current !== next) {
				ymap.set(key, next);
			}
		}

		// Tags: diff the Y.Array
		const yTags = ymap.get('tags');
		if (yTags instanceof Y.Array) {
			const currentTags = yTags.toArray() as string[];
			const nextTags = item.tags;
			if (JSON.stringify(currentTags) !== JSON.stringify(nextTags)) {
				yTags.delete(0, yTags.length);
				if (nextTags.length > 0) {
					yTags.push(nextTags);
				}
			}
		}

		// VideoMeta
		if (item.videoMeta) {
			let vm = ymap.get('videoMeta') as Y.Map<unknown> | undefined;
			if (!(vm instanceof Y.Map)) {
				vm = new Y.Map<unknown>();
				ymap.set('videoMeta', vm);
			}
			if (vm.get('loopStart') !== item.videoMeta.loopStart) vm.set('loopStart', item.videoMeta.loopStart);
			if (vm.get('loopEnd') !== item.videoMeta.loopEnd) vm.set('loopEnd', item.videoMeta.loopEnd);
			if (vm.get('muted') !== item.videoMeta.muted) vm.set('muted', item.videoMeta.muted);
		}
	}

	function applyGroupDiff(ymap: Y.Map<unknown>, group: GroupData) {
		for (const key of GROUP_FIELDS) {
			const current = ymap.get(key);
			const next = group[key];
			if (current !== next) {
				ymap.set(key, next);
			}
		}
	}

	// --- Load existing project data into CRDT ---

	function loadItems(boardItems: BoardItem[]) {
		ydoc.transact(() => {
			suppressObserver = true;
			yitems.delete(0, yitems.length);
			const ymaps = boardItems.map((it) => itemToYMap(it, ydoc));
			if (ymaps.length > 0) yitems.push(ymaps);
			suppressObserver = false;
		}, 'local');
		items = readAllItems();
	}

	function loadGroups(boardGroups: GroupData[]) {
		ydoc.transact(() => {
			suppressObserver = true;
			ygroups.delete(0, ygroups.length);
			const ymaps = boardGroups.map(groupToYMap);
			if (ymaps.length > 0) ygroups.push(ymaps);
			suppressObserver = false;
		}, 'local');
		groups = readAllGroups();
	}

	// --- Undo Manager ---

	const undoManager = new Y.UndoManager([yitems, ygroups], {
		captureTimeout: 300,
		trackedOrigins: new Set(['local'])
	});

	// --- Cleanup ---

	function destroy() {
		provider.disconnect();
		provider.destroy();
		undoManager.destroy();
		ydoc.destroy();
	}

	// --- Switch to a different board's CRDT arrays ---
	// Note: This is called when switching boards. We need to
	// re-bind to different Y.Array instances.
	function switchBoard(newBoardId: string) {
		// The yitems/ygroups variable references are const, but we can
		// create a new sync instance. The caller should destroy this one
		// and create a new createYjsSync() for the new board.
		// This is a design limitation noted here — the caller handles it.
	}

	return {
		ydoc,
		provider,
		awareness,
		undoManager,
		boardStore,
		groupStore,
		updateBoardAndGroups,
		loadItems,
		loadGroups,
		setLocalUser,
		setLocalCursor,
		setLocalBoard,
		getPeers,
		get status(): CollabStatus {
			return { connected, peerCount, roomId };
		},
		destroy
	};
}
