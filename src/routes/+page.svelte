<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import Canvas from '$lib/canvas/Canvas.svelte';
	import BoardSidebar from '$lib/ui/BoardSidebar.svelte';
	import ContextMenu from '$lib/ui/ContextMenu.svelte';
	import SelectionToolbar from '$lib/ui/SelectionToolbar.svelte';
	import ConnectionIndicator from '$lib/ui/ConnectionIndicator.svelte';
	import PeerCursors from '$lib/canvas/PeerCursors.svelte';
	import { createViewport } from '$lib/canvas/viewport.svelte.js';
	import { createSelection } from '$lib/canvas/selection.svelte.js';
	import { createProjectStore } from '$lib/board/project-store.svelte.js';
	import { createBoardActions } from '$lib/board/board-actions.js';
	import { createGroupActions } from '$lib/board/group-actions.js';
	import { createHistoryStore } from '$lib/board/history-store.svelte.js';
	import { createYjsSync, type PeerInfo, type CollabStatus } from '$lib/board/yjs-sync.svelte.js';
	import { createContextMenuState } from '$lib/ui/context-menu.svelte.js';
	import { screenToCanvas, canvasToScreen } from '$lib/canvas/coordinates.js';
	import { computeAlignment, computeDistribution } from '$lib/board/alignment.js';
	import type { AlignDirection, DistributeDirection } from '$lib/board/alignment.js';
	import { isYoutubeUrl, isVideoUrl, isImageUrl } from '$lib/items/item-types.js';
	import type { BoardItem, VideoMeta, GroupData, ProjectData } from '$lib/items/item-types.js';
	import { saveProject, saveProjectAs, saveProjectSilent, loadProject, getCurrentFilePath } from '$lib/persistence/file-io.js';
	import { exportPackageToFile, importPackageFromFile } from '$lib/persistence/packaging.js';
	import { icons } from '$lib/ui/icons.js';
	import {
		isTauri,
		setupTauriFileDrop,
		filePathToUrl,
		detectFileTypeFromPath
	} from '$lib/tauri-bridge.js';
	import logo from '$lib/assets/logo.svg';
	import { generateRoomCode, roomCodeToId, isValidRoomCode } from '$lib/board/room-code.js';

	// --- State modules ---
	const projectStore = createProjectStore();
	const viewport = createViewport();
	const selection = createSelection();
	const contextMenu = createContextMenuState();
	const history = createHistoryStore();
	const actions = createBoardActions(projectStore.boardStore);
	const groupActions = createGroupActions(projectStore.groupStore, projectStore.boardStore, projectStore);

	let sidebarCollapsed = $state(true);

	// --- P2P Collaborative sync ---
	let yjsSync = $state<ReturnType<typeof createYjsSync> | null>(null);
	let collabPeers = $state<PeerInfo[]>([]);
	let collabStatus = $state<CollabStatus | null>(null);

	// Random user color for awareness
	const userColors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899'];
	const myColor = userColors[Math.floor(Math.random() * userColors.length)];
	const myName = `User ${Math.floor(Math.random() * 9000 + 1000)}`;

	let activeRoomCode = $state<string | null>(null);
	let collabRole = $state<'host' | 'joiner' | null>(null);
	// Snapshot of local project state before joining — restored on disconnect for joiners
	let preJoinSnapshot: ProjectData | null = null;

	function syncHostCollabStateToProjectStore(sync: ReturnType<typeof createYjsSync> | null = yjsSync) {
		if (!sync || collabRole !== 'host') return;
		projectStore.boardStore.update(() => structuredClone(sync.boardStore.items));
		projectStore.groupStore.updateGroups(() => structuredClone(sync.groupStore.groups));
	}

	function getPersistableProjectData(): ProjectData {
		syncHostCollabStateToProjectStore();
		return projectStore.getProjectData();
	}

	function canPersistProjectData(action: 'save' | 'export'): boolean {
		if (collabRole !== 'joiner') return true;
		console.warn(`[AgentRef] Cannot ${action} while in a collab room as a guest. Disconnect first.`);
		return false;
	}

	async function runSave(saveAs = false) {
		if (!canPersistProjectData('save')) return;
		const saveFn = saveAs ? saveProjectAs : saveProject;
		const { strippedBlobCount } = await saveFn(getPersistableProjectData());
		if (strippedBlobCount > 0) {
			console.warn(
				`[AgentRef] ${strippedBlobCount} items with temporary blob URLs were saved without media. ` +
				`Use Export Package (Ctrl+Shift+E) to bundle media files.`
			);
		}
	}

	async function runExportPackage() {
		if (!canPersistProjectData('export')) return;
		await exportPackageToFile(getPersistableProjectData());
	}

	function canLoadOrImportProject(): boolean {
		if (!yjsSync) return true;
		console.warn('[AgentRef] Disconnect from the collab room before opening or importing another project.');
		return false;
	}

	function applyLoadedProject(data: ProjectData) {
		projectStore.loadProjectData(data);
		const vp = projectStore.getViewport();
		viewport.setTo(vp.x, vp.y, vp.scale);
		selection.clear();
		history.clear();
	}

	function createCollabRoom(): string {
		if (yjsSync) return activeRoomCode ?? '';
		const code = generateRoomCode();
		const roomId = roomCodeToId(code);
		const sync = createYjsSync(roomId, projectStore.activeBoard.id);

		// Host loads current board data into CRDT
		sync.loadItems(projectStore.boardStore.items);
		sync.loadGroups(projectStore.groupStore.groups);

		sync.setLocalUser(myName, myColor);
		sync.setLocalBoard(projectStore.activeBoard.id);

		yjsSync = sync;
		activeRoomCode = code;
		collabRole = 'host';
		preJoinSnapshot = null;
		rebindToSync(sync);
		return code;
	}

	function joinCollabRoom(code: string) {
		if (yjsSync) return;
		const normalizedCode = code.toUpperCase().trim();
		if (!isValidRoomCode(normalizedCode)) return;

		// Snapshot local state so we can restore it when leaving the room
		preJoinSnapshot = structuredClone(projectStore.getProjectData());

		const roomId = roomCodeToId(normalizedCode);
		const sync = createYjsSync(roomId, projectStore.activeBoard.id);

		// Joiner does NOT load items - CRDT syncs from host automatically
		sync.setLocalUser(myName, myColor);
		sync.setLocalBoard(projectStore.activeBoard.id);

		yjsSync = sync;
		activeRoomCode = normalizedCode;
		collabRole = 'joiner';
		rebindToSync(sync);
	}

	function stopCollabSession() {
		if (!yjsSync) return;
		const role = collabRole;
		if (role === 'host') {
			// Host keeps collaborative edits in local project state when leaving.
			syncHostCollabStateToProjectStore(yjsSync);
		}
		yjsSync.destroy();
		yjsSync = null;
		collabPeers = [];
		collabStatus = null;
		activeRoomCode = null;
		collabRole = null;

		if (role === 'joiner' && preJoinSnapshot) {
			// Joiner restores the pre-join local project snapshot.
			projectStore.loadProjectData(preJoinSnapshot);
			const vp = projectStore.getViewport();
			viewport.setTo(vp.x, vp.y, vp.scale);
		}
		preJoinSnapshot = null;
		selection.clear();
		history.clear();

		// Rebind actions to local stores
		rebindToLocal();
	}

	// Re-create board actions pointing at sync's stores
	function rebindToSync(sync: ReturnType<typeof createYjsSync>) {
		const newActions = createBoardActions(sync.boardStore);
		const newGroupActions = createGroupActions(sync.groupStore, sync.boardStore, sync);
		Object.assign(actions, newActions);
		Object.assign(groupActions, newGroupActions);
	}

	function rebindToLocal() {
		const newActions = createBoardActions(projectStore.boardStore);
		const newGroupActions = createGroupActions(projectStore.groupStore, projectStore.boardStore, projectStore);
		Object.assign(actions, newActions);
		Object.assign(groupActions, newGroupActions);
	}

	// --- Active stores: route to Yjs CRDT when in collab mode, else local ---
	let activeItems = $derived(yjsSync ? yjsSync.boardStore.items : projectStore.boardStore.items);
	let activeGroups = $derived(yjsSync ? yjsSync.groupStore.groups : projectStore.groupStore.groups);

	// Poll peers and status from awareness (reactive via $effect)
	$effect(() => {
		if (!yjsSync) {
			collabPeers = [];
			collabStatus = null;
			return;
		}
		const sync = yjsSync;
		const interval = setInterval(() => {
			collabPeers = sync.getPeers();
			collabStatus = sync.status;
		}, 500);
		return () => clearInterval(interval);
	});

	// Send local cursor position to peers (debounced via pointermove)
	function handlePointerMoveForAwareness(e: PointerEvent) {
		if (!yjsSync) return;
		const canvasPos = screenToCanvas(e.clientX, e.clientY, viewport.x, viewport.y, viewport.scale);
		yjsSync.setLocalCursor(canvasPos.x, canvasPos.y);
	}

	// --- Clipboard buffer for item copy/paste ---
	let clipboardBuffer: BoardItem[] = [];

	// --- Auto-save (30s debounce, only when a file path exists) ---
	let autoSaveTimer: ReturnType<typeof setTimeout> | null = null;
	let autoSaveDirty = false;
	let autoSavePrimed = false;

	let autoSaveSignature = $derived.by(() =>
		JSON.stringify({
			boardId: projectStore.activeBoard.id,
			items: activeItems.map((it) => ({
				id: it.id,
				type: it.type,
				url: it.url,
				x: it.x,
				y: it.y,
				width: it.width,
				height: it.height,
				zIndex: it.zIndex,
				rotation: it.rotation,
				groupId: it.groupId ?? null,
				rating: it.rating,
				tags: it.tags,
				videoMeta: it.videoMeta ?? null
			})),
			groups: activeGroups.map((g) => ({
				id: g.id,
				label: g.label,
				color: g.color,
				x: g.x,
				y: g.y,
				width: g.width,
				height: g.height,
				zIndex: g.zIndex,
				locked: g.locked
			}))
		})
	);

	function markDirty() {
		// Never auto-save while in a collab room as a joiner — would overwrite local file with host's data
		if (collabRole === 'joiner') return;
		autoSaveDirty = true;
		if (autoSaveTimer) clearTimeout(autoSaveTimer);
		autoSaveTimer = setTimeout(async () => {
			if (autoSaveDirty && collabRole !== 'joiner') {
				const saved = await saveProjectSilent(getPersistableProjectData());
				if (saved) {
					autoSaveDirty = false;
					console.log('[AgentRef] Auto-saved');
				}
			}
		}, 30_000);
	}

	// Mark dirty on any board/group mutation.
	$effect(() => {
		void autoSaveSignature;
		if (!autoSavePrimed) {
			autoSavePrimed = true;
			return;
		}
		markDirty();
	});

	// --- Undo/redo: drag/resize coalescing ---
	// Snapshot item positions/dimensions at start of drag/resize, commit on end.
	let dragSnapshots = new Map<string, { x: number; y: number }>();
	let resizeSnapshot: { id: string; x: number; y: number; w: number; h: number } | null = null;
	let rotateSnapshot: { id: string; rotation: number } | null = null;

	// --- Object URL tracking for cleanup ---
	const objectUrls = new Set<string>();

	function trackObjectUrl(url: string): string {
		objectUrls.add(url);
		return url;
	}

	function revokeObjectUrls(urls: string[]) {
		for (const url of urls) {
			if (objectUrls.has(url)) {
				URL.revokeObjectURL(url);
				objectUrls.delete(url);
			}
		}
	}

	// --- Tauri file drop listener cleanup ---
	let unlistenTauriDrop: (() => void) | null = null;

	let unlistenMcpReload: (() => void) | null = null;

	onMount(async () => {
		if (isTauri) {
			unlistenTauriDrop = await setupTauriFileDrop(handleTauriDrop);
			console.log('[AgentRef] Tauri file drop listener active');

			// Listen for MCP-triggered project changes (agent wrote to the file)
			const { listen } = await import('@tauri-apps/api/event');
			unlistenMcpReload = await listen<string>('mcp:project-changed', async (event) => {
				const changedPath = event.payload;
				const currentPath = getCurrentFilePath();
				if (currentPath && changedPath === currentPath && !yjsSync) {
					// Reload the project from disk
					try {
						const { readTextFile } = await import('@tauri-apps/plugin-fs');
						const json = await readTextFile(currentPath);
						const data = JSON.parse(json) as ProjectData;
						projectStore.loadProjectData(data);
						console.log('[AgentRef] Reloaded project from MCP change');
					} catch (err) {
						console.warn('[AgentRef] Failed to reload project from MCP change:', err);
					}
				}
			});
		} else {
			console.log('[AgentRef] Running in browser mode');
		}
	});

	onDestroy(() => {
		for (const url of objectUrls) {
			URL.revokeObjectURL(url);
		}
		objectUrls.clear();
		unlistenTauriDrop?.();
		unlistenMcpReload?.();
		if (yjsSync && collabRole === 'host') {
			syncHostCollabStateToProjectStore(yjsSync);
		}
		yjsSync?.destroy();
		preJoinSnapshot = null;
		if (autoSaveTimer) clearTimeout(autoSaveTimer);
	});

	// --- MCP live state bridge ---
	let liveStateTimer: ReturnType<typeof setTimeout> | null = null;

	async function writeLiveState(selectedIds: Set<string>, activeBoardId: string) {
		if (!isTauri) return;
		try {
			const { homeDir, join } = await import('@tauri-apps/api/path');
			const { mkdir, writeTextFile } = await import('@tauri-apps/plugin-fs');

			const home = await homeDir();
			const dir = await join(home, '.agentref');
			const filePath = await join(dir, 'live-state.json');

			const state = {
				selectedIds: Array.from(selectedIds),
				activeBoardId,
				projectPath: getCurrentFilePath(),
				timestamp: new Date().toISOString()
			};

			await mkdir(dir, { recursive: true });
			await writeTextFile(filePath, JSON.stringify(state));
		} catch {
			// Silent fail — MCP bridge is best-effort
		}
	}

	$effect(() => {
		const ids = selection.ids;
		const boardId = projectStore.activeBoard.id;
		if (liveStateTimer) clearTimeout(liveStateTimer);
		liveStateTimer = setTimeout(() => writeLiveState(ids, boardId), 200);
	});

	// --- Selection toolbar positioning ---
	let selectedItem = $derived.by((): BoardItem | null => {
		if (selection.ids.size !== 1) return null;
		const id = [...selection.ids][0];
		return activeItems.find((it) => it.id === id) ?? null;
	});

	let toolbarPos = $derived.by(() => {
		if (!selectedItem) return null;
		const pos = canvasToScreen(
			selectedItem.x,
			selectedItem.y + selectedItem.height / 2,
			viewport.x, viewport.y, viewport.scale
		);
		return { x: pos.x - 12, y: pos.y };
	});

	// --- Context menu group info ---
	let contextGroupInfo = $derived.by(() => {
		if (contextMenu.target !== 'group' || !contextMenu.targetId) {
			return { locked: false, color: '#808080' };
		}
		const group = activeGroups.find((g) => g.id === contextMenu.targetId);
		return { locked: group?.locked ?? false, color: group?.color ?? '#808080' };
	});

	// --- Global keyboard shortcuts ---

	function isEditableElement(target: EventTarget | null): boolean {
		const el = target as HTMLElement;
		if (!el) return false;
		const tag = el.tagName;
		if (tag === 'INPUT' || tag === 'TEXTAREA') return true;
		if (el.isContentEditable) return true;
		return false;
	}

	function isEditableTarget(e: KeyboardEvent): boolean {
		return isEditableElement(e.target);
	}

	function handleGlobalKeyDown(e: KeyboardEvent) {
		const isCtrlCombo = e.ctrlKey || e.metaKey;

		if (!isCtrlCombo && isEditableTarget(e)) return;

		// Undo: Ctrl+Z
		if (isCtrlCombo && e.key === 'z' && !e.shiftKey) {
			e.preventDefault();
			history.undo();
			return;
		}
		// Redo: Ctrl+Shift+Z or Ctrl+Y
		if (isCtrlCombo && (e.key === 'Z' || (e.key === 'z' && e.shiftKey) || e.key === 'y')) {
			e.preventDefault();
			history.redo();
			return;
		}
		// Save: Ctrl+S
		if (isCtrlCombo && e.key === 's') {
			e.preventDefault();
			void runSave(e.shiftKey);
			return;
		}
		// Export Package: Ctrl+Shift+E
		if (isCtrlCombo && e.shiftKey && e.key === 'E') {
			e.preventDefault();
			void runExportPackage();
			return;
		}
		// Open: Ctrl+O
		if (isCtrlCombo && e.key === 'o') {
			e.preventDefault();
			if (!canLoadOrImportProject()) return;
			loadProject().then((data) => {
				if (data) {
					applyLoadedProject(data);
				}
			});
			return;
		}
		// Select All: Ctrl+A
		if (isCtrlCombo && e.key === 'a') {
			e.preventDefault();
			selection.selectAll(activeItems.map((it) => it.id));
			return;
		}
		// Copy: Ctrl+C — copy selected items to internal clipboard
		if (isCtrlCombo && e.key === 'c' && !e.shiftKey) {
			if (selection.ids.size > 0) {
				e.preventDefault();
				clipboardBuffer = activeItems.filter((it) => selection.ids.has(it.id)).map((it) => ({ ...it }));
			}
			return;
		}
		// Paste: Ctrl+V (items from internal clipboard — only if buffer has items)
		if (isCtrlCombo && e.key === 'v' && clipboardBuffer.length > 0) {
			e.preventDefault();
			const newIds: string[] = [];
			for (const item of clipboardBuffer) {
				const newId = actions.addItem({
					type: item.type,
					url: item.url,
					x: item.x + 30,
					y: item.y + 30,
					width: item.width,
					height: item.height
				});
				newIds.push(newId);
			}
			// Move clipboard offset for subsequent pastes
			clipboardBuffer = clipboardBuffer.map((it) => ({ ...it, x: it.x + 30, y: it.y + 30 }));
			selection.selectAll(newIds);
			history.push({
				label: newIds.length > 1 ? `Paste ${newIds.length} items` : 'Paste item',
				undo: () => { actions.deleteItems(new Set(newIds)); },
				redo: () => {
					for (const item of clipboardBuffer) {
						actions.addItem({
							type: item.type, url: item.url,
							x: item.x, y: item.y,
							width: item.width, height: item.height
						});
					}
				}
			});
			return;
		}
		// Duplicate: Ctrl+D
		if (isCtrlCombo && e.key === 'd') {
			e.preventDefault();
			if (selection.ids.size === 0) return;
			const selectedItems = activeItems.filter((it) => selection.ids.has(it.id));
			const newIds: string[] = [];
			for (const item of selectedItems) {
				const newId = actions.addItem({
					type: item.type,
					url: item.url,
					x: item.x + 20,
					y: item.y + 20,
					width: item.width,
					height: item.height
				});
				newIds.push(newId);
			}
			selection.selectAll(newIds);
			history.push({
				label: newIds.length > 1 ? `Duplicate ${newIds.length} items` : 'Duplicate item',
				undo: () => { actions.deleteItems(new Set(newIds)); },
				redo: () => {
					for (const item of selectedItems) {
						actions.addItem({
							type: item.type, url: item.url,
							x: item.x + 20, y: item.y + 20,
							width: item.width, height: item.height
						});
					}
				}
			});
			return;
		}
		// Zoom to Fit: Ctrl+0 or Ctrl+1 to reset
		if (isCtrlCombo && (e.key === '0' || e.key === '1')) {
			e.preventDefault();
			if (e.key === '0') {
				// Zoom to fit all content
				const items = activeItems;
				if (items.length === 0) {
					viewport.reset();
					return;
				}
				let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
				for (const it of items) {
					minX = Math.min(minX, it.x);
					minY = Math.min(minY, it.y);
					maxX = Math.max(maxX, it.x + it.width);
					maxY = Math.max(maxY, it.y + it.height);
				}
				viewport.zoomToFit({ minX, minY, maxX, maxY }, window.innerWidth, window.innerHeight);
			} else {
				// Ctrl+1: reset to 100%
				viewport.reset();
			}
			return;
		}
		// Arrow key nudging (non-Ctrl, non-editable)
		if (!isCtrlCombo && !isEditableTarget(e) && selection.ids.size > 0) {
			const step = e.shiftKey ? 10 : 1;
			let dx = 0, dy = 0;
			switch (e.key) {
				case 'ArrowLeft': dx = -step; break;
				case 'ArrowRight': dx = step; break;
				case 'ArrowUp': dy = -step; break;
				case 'ArrowDown': dy = step; break;
			}
			if (dx !== 0 || dy !== 0) {
				e.preventDefault();
				// Snapshot for undo (first press in a series)
				if (dragSnapshots.size === 0) {
					for (const it of activeItems) {
						if (selection.ids.has(it.id)) {
							dragSnapshots.set(it.id, { x: it.x, y: it.y });
						}
					}
					// Commit undo after 500ms of no further nudges
					if (nudgeUndoTimer) clearTimeout(nudgeUndoTimer);
					nudgeUndoTimer = setTimeout(() => commitNudgeUndo(), 500);
				} else {
					// Reset the commit timer on each new nudge
					if (nudgeUndoTimer) clearTimeout(nudgeUndoTimer);
					nudgeUndoTimer = setTimeout(() => commitNudgeUndo(), 500);
				}
				actions.moveItems(selection.ids, dx, dy);
				return;
			}
		}
	}

	// --- Nudge undo coalescing ---
	let nudgeUndoTimer: ReturnType<typeof setTimeout> | null = null;

	function commitNudgeUndo() {
		if (dragSnapshots.size === 0) return;
		const before = new Map(dragSnapshots);
		const after = new Map<string, { x: number; y: number }>();
		for (const [itemId] of before) {
			const it = activeItems.find((i) => i.id === itemId);
			if (it) after.set(itemId, { x: it.x, y: it.y });
		}
		history.push({
			label: before.size > 1 ? `Nudge ${before.size} items` : 'Nudge item',
			undo: () => actions.setItemPositions(before),
			redo: () => actions.setItemPositions(after)
		});
		dragSnapshots.clear();
	}

	// --- Canvas event handlers ---

	function handleZoom(delta: number, clientX: number, clientY: number) {
		viewport.zoomByDelta(delta, clientX, clientY);
	}

	function handlePan(dx: number, dy: number) {
		viewport.pan(dx, dy);
	}

	function handleSelect(id: string, multi: boolean) {
		selection.select(id, multi);
	}

	function handleClearSelection() {
		selection.clear();
		contextMenu.hide();
	}

	// --- Move with undo support ---

	function handleMoveStart(id: string) {
		// Snapshot positions of all selected items (or just the one)
		dragSnapshots.clear();
		const currentItems = activeItems;
		if (selection.ids.size > 1 && selection.ids.has(id)) {
			for (const it of currentItems) {
				if (selection.ids.has(it.id)) {
					dragSnapshots.set(it.id, { x: it.x, y: it.y });
				}
			}
		} else {
			const it = currentItems.find((i) => i.id === id);
			if (it) dragSnapshots.set(it.id, { x: it.x, y: it.y });
		}
	}

	function handleMoveItem(id: string, dx: number, dy: number) {
		actions.moveItem(id, dx, dy);
	}

	function handleMoveItems(ids: Set<string>, dx: number, dy: number) {
		actions.moveItems(ids, dx, dy);
	}

	function handleMoveEnd(id: string) {
		if (dragSnapshots.size === 0) return;
		const before = new Map(dragSnapshots);
		const after = new Map<string, { x: number; y: number }>();
		for (const [itemId] of before) {
			const it = activeItems.find((i) => i.id === itemId);
			if (it) after.set(itemId, { x: it.x, y: it.y });
		}
		// Skip if nothing moved
		const moved = [...before.entries()].some(([id, pos]) => {
			const a = after.get(id);
			return a && (Math.abs(a.x - pos.x) > 0.5 || Math.abs(a.y - pos.y) > 0.5);
		});
		if (!moved) { dragSnapshots.clear(); return; }

		const label = before.size > 1 ? `Move ${before.size} items` : 'Move item';
		history.push({
			label,
			undo: () => actions.setItemPositions(before),
			redo: () => actions.setItemPositions(after)
		});
		dragSnapshots.clear();
	}

	// --- Resize with undo support ---

	function handleResizeItem(id: string, width: number, height: number, absX: number, absY: number) {
		if (!resizeSnapshot) {
			const it = activeItems.find((i) => i.id === id);
			if (it) resizeSnapshot = { id, x: it.x, y: it.y, w: it.width, h: it.height };
		}
		actions.resizeItem(id, width, height, { x: absX, y: absY });
	}

	function handleResizeEnd(id: string) {
		if (!resizeSnapshot) return;
		const before = { ...resizeSnapshot };
		const it = activeItems.find((i) => i.id === id);
		if (!it) { resizeSnapshot = null; return; }
		const after = { id, x: it.x, y: it.y, w: it.width, h: it.height };
		history.push({
			label: 'Resize item',
			undo: () => actions.resizeItem(before.id, before.w, before.h, { x: before.x, y: before.y }),
			redo: () => actions.resizeItem(after.id, after.w, after.h, { x: after.x, y: after.y })
		});
		resizeSnapshot = null;
	}

	// --- Rotation with undo support ---

	function handleRotateItem(id: string, rotation: number) {
		if (!rotateSnapshot) {
			const it = activeItems.find((i) => i.id === id);
			if (it) rotateSnapshot = { id, rotation: it.rotation };
		}
		actions.rotateItem(id, rotation);
	}

	function handleRotateEnd(id: string) {
		if (!rotateSnapshot) return;
		const before = { ...rotateSnapshot };
		const it = activeItems.find((i) => i.id === id);
		if (!it) { rotateSnapshot = null; return; }
		const after = { id, rotation: it.rotation };
		history.push({
			label: 'Rotate item',
			undo: () => actions.rotateItem(before.id, before.rotation),
			redo: () => actions.rotateItem(after.id, after.rotation)
		});
		rotateSnapshot = null;
	}

	function handleBringToFront(id: string) {
		actions.bringToFront(id);
	}

	function handleDeleteSelected() {
		const ids = selection.deleteSelected();
		if (ids.length > 0) {
			const deleted = actions.deleteItems(new Set(ids));
			// Undo for delete
			history.push({
				label: deleted.length > 1 ? `Delete ${deleted.length} items` : 'Delete item',
				undo: () => actions.restoreItems(deleted),
				redo: () => {
					actions.deleteItems(new Set(deleted.map((it) => it.id)));
				}
			});
			revokeObjectUrls(deleted.map((it) => it.url));
		}
	}

	function handleMediaLoad(id: string, naturalWidth: number, naturalHeight: number) {
		const item = activeItems.find((it) => it.id === id);
		if (!item || (item.width !== 300 && item.height !== 200)) return;

		const maxDim = 600;
		let w = naturalWidth;
		let h = naturalHeight;
		if (w > maxDim || h > maxDim) {
			const ratio = Math.min(maxDim / w, maxDim / h);
			w = w * ratio;
			h = h * ratio;
		}
		actions.resizeItem(id, w, h);
	}

	function handleUpdateVideoMeta(id: string, meta: Partial<VideoMeta>) {
		actions.updateVideoMeta(id, meta);
	}

	function handleUpdateText(id: string, text: string) {
		const item = activeItems.find((it) => it.id === id);
		const oldText = item?.url ?? '';
		actions.updateText(id, text);
		history.push({
			label: 'Edit text',
			undo: () => actions.updateText(id, oldText),
			redo: () => actions.updateText(id, text)
		});
	}

	// --- Rating/tag handlers ---

	function handleRate(id: string, rating: number) {
		const item = activeItems.find((it) => it.id === id);
		const oldRating = item?.rating ?? 0;
		actions.rateItem(id, rating);
		history.push({
			label: 'Rate item',
			undo: () => actions.rateItem(id, oldRating),
			redo: () => actions.rateItem(id, rating)
		});
	}

	function handleAddTag(id: string, tag: string) {
		actions.tagItem(id, tag);
		history.push({
			label: 'Add tag',
			undo: () => actions.removeTag(id, tag),
			redo: () => actions.tagItem(id, tag)
		});
	}

	function handleRemoveTag(id: string, tag: string) {
		actions.removeTag(id, tag);
		history.push({
			label: 'Remove tag',
			undo: () => actions.tagItem(id, tag),
			redo: () => actions.removeTag(id, tag)
		});
	}

	// --- Group handlers ---

	function handleMoveGroup(id: string, dx: number, dy: number) {
		groupActions.moveGroup(id, dx, dy);
	}

	function handleSelectGroup(id: string, multi: boolean) {
		const itemIds = groupActions.selectGroupItems(id);
		if (!multi) selection.clear();
		for (const itemId of itemIds) {
			selection.select(itemId, true);
		}
	}

	// --- Marquee selection ---

	let marqueeBaseSelection: string[] = [];

	function handleMarqueeSelect(ids: string[], additive: boolean) {
		if (additive) {
			// Combine base selection with new marquee selection
			const combined = new Set([...marqueeBaseSelection, ...ids]);
			selection.selectAll(Array.from(combined));
		} else {
			selection.selectAll(ids);
		}
	}

	// --- Board switching ---

	function handleSwitchBoard(boardId: string) {
		projectStore.saveViewport(viewport.x, viewport.y, viewport.scale);
		const previousSync = yjsSync;
		const previousRoomCode = activeRoomCode;
		const previousRole = collabRole;
		if (previousSync && previousRole === 'host') {
			syncHostCollabStateToProjectStore(previousSync);
		}
		if (previousSync) {
			previousSync.destroy();
			yjsSync = null;
			collabPeers = [];
			collabStatus = null;
		}

		projectStore.switchBoard(boardId);
		const vp = projectStore.getViewport();
		viewport.setTo(vp.x, vp.y, vp.scale);
		selection.clear();
		history.clear();

		// If in collab mode, reconnect to the new board's CRDT arrays
		if (previousRoomCode && previousRole) {
			const roomId = roomCodeToId(previousRoomCode);
			const sync = createYjsSync(roomId, projectStore.activeBoard.id);
			if (previousRole === 'host') {
				sync.loadItems(projectStore.boardStore.items);
				sync.loadGroups(projectStore.groupStore.groups);
			}
			sync.setLocalUser(myName, myColor);
			sync.setLocalBoard(projectStore.activeBoard.id);
			yjsSync = sync;
			activeRoomCode = previousRoomCode;
			collabRole = previousRole;
			rebindToSync(sync);
		} else {
			activeRoomCode = null;
			collabRole = null;
			rebindToLocal();
		}
	}

	// --- Context menu ---

	function handleContextMenu(x: number, y: number, target: string, id?: string) {
		contextMenu.show(x, y, target as any, id);
	}

	function handleContextAction(action: string, targetId?: string) {
		const canvasCenter = screenToCanvas(
			window.innerWidth / 2,
			window.innerHeight / 2,
			viewport.x,
			viewport.y,
			viewport.scale
		);

		// Handle color palette action prefix
		if (action.startsWith('setColor:') && targetId) {
			const color = action.slice('setColor:'.length);
			groupActions.setGroupColor(targetId, color);
			return;
		}

		switch (action) {
			case 'delete':
				if (targetId) {
					const deleted = actions.deleteItems(new Set([targetId]));
					if (deleted.length) {
						history.push({
							label: 'Delete item',
							undo: () => actions.restoreItems(deleted),
							redo: () => { actions.deleteItems(new Set([targetId])); }
						});
					}
					revokeObjectUrls(deleted.map((it) => it.url));
					selection.clear();
				}
				break;

			case 'deleteAll':
				handleDeleteSelected();
				break;

			case 'duplicate':
				if (targetId) {
					const item = activeItems.find((it) => it.id === targetId);
					if (item) {
						const newId = actions.addItem({
							type: item.type,
							url: item.url,
							x: item.x + 20,
							y: item.y + 20,
							width: item.width,
							height: item.height
						});
						history.push({
							label: 'Duplicate item',
							undo: () => { actions.deleteItems(new Set([newId])); },
							redo: () => {
								actions.addItem({
									type: item.type, url: item.url,
									x: item.x + 20, y: item.y + 20,
									width: item.width, height: item.height
								});
							}
						});
					}
				}
				break;

			case 'duplicateAll': {
				const selectedItems = activeItems.filter((it) =>
					selection.ids.has(it.id)
				);
				const newIds: string[] = [];
				for (const item of selectedItems) {
					const newId = actions.addItem({
						type: item.type,
						url: item.url,
						x: item.x + 20,
						y: item.y + 20,
						width: item.width,
						height: item.height
					});
					newIds.push(newId);
				}
				break;
			}

			case 'bringToFront':
				if (targetId) actions.bringToFront(targetId);
				break;

			case 'addText': {
				const newId = actions.addItem({
					type: 'text',
					url: 'New note',
					x: canvasCenter.x - 100,
					y: canvasCenter.y - 30,
					width: 200,
					height: 60
				});
				history.push({
					label: 'Add text note',
					undo: () => { actions.deleteItems(new Set([newId])); },
					redo: () => {
						actions.addItem({
							type: 'text', url: 'New note',
							x: canvasCenter.x - 100, y: canvasCenter.y - 30,
							width: 200, height: 60
						});
					}
				});
				break;
			}

			case 'paste':
				document.execCommand('paste');
				break;

			case 'zoomFit': {
				const fitItems = activeItems;
				if (fitItems.length === 0) { viewport.reset(); break; }
				let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
				for (const it of fitItems) {
					minX = Math.min(minX, it.x);
					minY = Math.min(minY, it.y);
					maxX = Math.max(maxX, it.x + it.width);
					maxY = Math.max(maxY, it.y + it.height);
				}
				viewport.zoomToFit({ minX, minY, maxX, maxY }, window.innerWidth, window.innerHeight);
				break;
			}

			case 'zoomReset':
				viewport.reset();
				break;

			case 'groupSelected':
			case 'groupSingle': {
				const ids = action === 'groupSingle' && targetId
					? new Set([targetId])
					: selection.ids;
				if (ids.size > 0) {
					groupActions.groupSelectedItems(ids);
				}
				break;
			}

			case 'ungroup':
				if (targetId) groupActions.ungroupItems(targetId);
				break;

			case 'toggleLock':
				if (targetId) groupActions.toggleGroupLock(targetId);
				break;

			case 'deleteGroup':
				if (targetId) {
					const deleted = groupActions.deleteGroup(targetId, false);
					revokeObjectUrls(deleted.map((it) => it.url));
				}
				break;

			case 'selectGroup':
				if (targetId) handleSelectGroup(targetId, false);
				break;

			case 'renameGroup':
				if (targetId) {
					const group = activeGroups.find((g) => g.id === targetId);
					const newName = prompt('Group name:', group?.label ?? 'Group');
					if (newName) groupActions.renameGroup(targetId, newName);
				}
				break;

			case 'save':
				void runSave(false);
				break;

			case 'saveAs':
				void runSave(true);
				break;

			case 'open':
				if (!canLoadOrImportProject()) break;
				loadProject().then((data) => {
					if (data) {
						applyLoadedProject(data);
					}
				});
				break;

			case 'exportPackage':
				void runExportPackage();
				break;

			case 'importPackage':
				if (!canLoadOrImportProject()) break;
				importPackageFromFile().then((result) => {
					if (result) {
						for (const blobUrl of result.blobUrls) {
							trackObjectUrl(blobUrl);
						}
						applyLoadedProject(result.project);
					}
				});
				break;

			// Alignment actions
			case 'alignLeft': case 'alignRight': case 'alignTop':
			case 'alignBottom': case 'alignCenterH': case 'alignCenterV': {
				const selected = activeItems.filter((it) => selection.ids.has(it.id));
				if (selected.length < 2) break;
				// Map action name to direction
				const dirMap: Record<string, AlignDirection> = {
					alignLeft: 'left', alignRight: 'right',
					alignTop: 'top', alignBottom: 'bottom',
					alignCenterH: 'center-h', alignCenterV: 'center-v'
				};
				const positions = computeAlignment(selected, dirMap[action]);
				const beforePositions = new Map(selected.map((it) => [it.id, { x: it.x, y: it.y }]));
				actions.setItemPositions(positions);
				history.push({
					label: `Align ${dirMap[action]}`,
					undo: () => actions.setItemPositions(beforePositions),
					redo: () => actions.setItemPositions(positions)
				});
				break;
			}

			case 'distributeH': case 'distributeV': {
				const selected = activeItems.filter((it) => selection.ids.has(it.id));
				if (selected.length < 3) break;
				const dir: DistributeDirection = action === 'distributeH' ? 'horizontal' : 'vertical';
				const positions = computeDistribution(selected, dir);
				const beforePositions = new Map(selected.map((it) => [it.id, { x: it.x, y: it.y }]));
				actions.setItemPositions(positions);
				history.push({
					label: `Distribute ${dir}`,
					undo: () => actions.setItemPositions(beforePositions),
					redo: () => actions.setItemPositions(positions)
				});
				break;
			}
		}
	}

	// --- Detect file type from MIME or extension ---

	function detectFileType(file: File): 'image' | 'video' | null {
		if (file.type.startsWith('image/')) return 'image';
		if (file.type.startsWith('video/')) return 'video';
		if (isImageUrl(file.name)) return 'image';
		if (isVideoUrl(file.name)) return 'video';
		return null;
	}

	// --- Tauri native file drop ---

	async function handleTauriDrop(paths: string[], position: { x: number; y: number }) {
		const canvasPos = screenToCanvas(
			position.x,
			position.y,
			viewport.x,
			viewport.y,
			viewport.scale
		);

		for (let i = 0; i < paths.length; i++) {
			const filePath = paths[i];
			const fileType = detectFileTypeFromPath(filePath);
			if (!fileType) continue;

			const url = await filePathToUrl(filePath);
			actions.addItem({
				type: fileType,
				url,
				x: canvasPos.x + i * 20,
				y: canvasPos.y + i * 20,
				width: fileType === 'video' ? 480 : 300,
				height: fileType === 'video' ? 270 : 200
			});
		}
	}

	// --- Browser HTML5 file drop ---

	function handleBrowserDrop(files: FileList, clientX: number, clientY: number) {
		const canvasPos = screenToCanvas(clientX, clientY, viewport.x, viewport.y, viewport.scale);

		for (let i = 0; i < files.length; i++) {
			const file = files[i];
			const fileType = detectFileType(file);
			if (!fileType) continue;

			const url = trackObjectUrl(URL.createObjectURL(file));
			actions.addItem({
				type: fileType,
				url,
				x: canvasPos.x + i * 20,
				y: canvasPos.y + i * 20,
				width: fileType === 'video' ? 480 : 300,
				height: fileType === 'video' ? 270 : 200
			});
		}
	}

	// --- Clipboard paste ---

	function handlePaste(e: ClipboardEvent) {
		if (isEditableElement(e.target)) return;
		e.preventDefault();

		const clipItems = e.clipboardData?.items;
		if (!clipItems) return;

		const canvasCenter = screenToCanvas(
			window.innerWidth / 2,
			window.innerHeight / 2,
			viewport.x,
			viewport.y,
			viewport.scale
		);

		for (let i = 0; i < clipItems.length; i++) {
			const clipItem = clipItems[i];

			if (clipItem.type.startsWith('image/')) {
				const file = clipItem.getAsFile();
				if (!file) continue;
				const url = trackObjectUrl(URL.createObjectURL(file));
				actions.addItem({
					type: 'image',
					url,
					x: canvasCenter.x - 150,
					y: canvasCenter.y - 100
				});
			} else if (clipItem.type === 'text/plain') {
				clipItem.getAsString((text) => {
					const trimmed = text.trim();
					if (!trimmed) return;

					const isDataUri = /^data:image\//i.test(trimmed);

					if (isYoutubeUrl(trimmed)) {
						actions.addItem({
							type: 'youtube',
							url: trimmed,
							x: canvasCenter.x - 240,
							y: canvasCenter.y - 135,
							width: 480,
							height: 270
						});
					} else if (isVideoUrl(trimmed)) {
						actions.addItem({
							type: 'video',
							url: trimmed,
							x: canvasCenter.x - 240,
							y: canvasCenter.y - 135,
							width: 480,
							height: 270
						});
					} else if (isImageUrl(trimmed) || isDataUri) {
						actions.addItem({
							type: 'image',
							url: trimmed,
							x: canvasCenter.x - 150,
							y: canvasCenter.y - 100
						});
					} else if (/^https?:\/\//i.test(trimmed)) {
						actions.addItem({
							type: 'image',
							url: trimmed,
							x: canvasCenter.x - 150,
							y: canvasCenter.y - 100
						});
					} else {
						actions.addItem({
							type: 'text',
							url: trimmed,
							x: canvasCenter.x - 150,
							y: canvasCenter.y - 40,
							width: 300,
							height: 80
						});
					}
				});
			}
		}
	}
</script>

<svelte:window onkeydown={handleGlobalKeyDown} onpointermove={handlePointerMoveForAwareness} />

<div class="app-layout">
	<BoardSidebar
		boards={projectStore.boardList}
		activeBoardId={projectStore.activeBoard.id}
		projectName={projectStore.project.name}
		collapsed={sidebarCollapsed}
		onSwitchBoard={handleSwitchBoard}
		onAddBoard={() => projectStore.addBoard()}
		onDeleteBoard={(id) => projectStore.deleteBoard(id)}
		onRenameBoard={(id, name) => projectStore.renameBoard(id, name)}
		onDuplicateBoard={(id) => projectStore.duplicateBoard(id)}
		onToggleCollapse={() => (sidebarCollapsed = !sidebarCollapsed)}
		onRenameProject={(name) => projectStore.renameProject(name)}
	/>

	<Canvas
		items={activeItems}
		groups={activeGroups}
		viewportTransform={viewport.transform}
		viewportX={viewport.x}
		viewportY={viewport.y}
		viewportScale={viewport.scale}
		selectedIds={selection.ids}
		isItemLocked={(item) => groupActions.isItemLocked(item)}
		onZoom={handleZoom}
		onPan={handlePan}
		onSelect={handleSelect}
		onClearSelection={handleClearSelection}
		onMoveStart={handleMoveStart}
		onMoveItem={handleMoveItem}
		onMoveItems={handleMoveItems}
		onMoveEnd={handleMoveEnd}
		onResizeItem={handleResizeItem}
		onResizeEnd={handleResizeEnd}
		onRotateItem={handleRotateItem}
		onRotateEnd={handleRotateEnd}
		onDrop={handleBrowserDrop}
		onPaste={handlePaste}
		onDeleteSelected={handleDeleteSelected}
		onBringToFront={handleBringToFront}
		onMediaLoad={handleMediaLoad}
		onUpdateVideoMeta={handleUpdateVideoMeta}
		onUpdateText={handleUpdateText}
		onMoveGroup={handleMoveGroup}
		onSelectGroup={handleSelectGroup}
		onContextMenu={handleContextMenu}
		onMarqueeSelect={handleMarqueeSelect}
	/>

	{#if contextMenu.visible}
		<ContextMenu
			x={contextMenu.x}
			y={contextMenu.y}
			target={contextMenu.target}
			targetId={contextMenu.targetId}
			hasSelection={selection.ids.size > 0}
			selectionCount={selection.ids.size}
			groupLocked={contextGroupInfo.locked}
			groupColor={contextGroupInfo.color}
			onAction={handleContextAction}
			onClose={() => contextMenu.hide()}
		/>
	{/if}

	<!-- Floating selection toolbar (rating/tags) -->
	{#if toolbarPos && selectedItem}
		<SelectionToolbar
			item={selectedItem}
			screenX={toolbarPos.x}
			screenY={toolbarPos.y}
			onRate={handleRate}
			onAddTag={handleAddTag}
			onRemoveTag={handleRemoveTag}
		/>
	{/if}

	<!-- Peer cursors overlay (P2P collab) -->
	{#if yjsSync && collabPeers.length > 0}
		<PeerCursors
			peers={collabPeers.filter((p) => p.activeBoardId === projectStore.activeBoard.id)}
			viewportX={viewport.x}
			viewportY={viewport.y}
			viewportScale={viewport.scale}
		/>
	{/if}

	<!-- P2P connection indicator -->
	<ConnectionIndicator
		status={collabStatus}
		peers={collabPeers}
		onCreate={createCollabRoom}
		onJoin={joinCollabRoom}
		onDisconnect={stopCollabSession}
	/>

	<!-- Undo/redo buttons -->
	<div class="undo-controls">
		<button
			class="undo-btn"
			class:active={history.canUndo}
			disabled={!history.canUndo}
			onclick={() => history.undo()}
			title={history.canUndo ? `Undo: ${history.undoLabel}` : 'Nothing to undo'}
		>
			{@html icons.undo}
		</button>
		<button
			class="undo-btn"
			class:active={history.canRedo}
			disabled={!history.canRedo}
			onclick={() => history.redo()}
			title={history.canRedo ? `Redo: ${history.redoLabel}` : 'Nothing to redo'}
		>
			{@html icons.redo}
		</button>
	</div>

	<!-- App logo (bottom-left) -->
	<div class="app-logo">
		<img src={logo} alt="AgentRef" />
	</div>
</div>

<style>
	.app-layout {
		position: fixed;
		inset: 0;
	}

	.undo-controls {
		position: fixed;
		bottom: 16px;
		right: 16px;
		display: flex;
		gap: 4px;
		z-index: 8000;
	}

	.undo-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		background: rgba(30, 41, 59, 0.8);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 6px;
		color: #555;
		cursor: default;
		padding: 0;
		transition: color 120ms ease, background 120ms ease, border-color 120ms ease;
	}

	.undo-btn.active {
		color: #aaa;
		cursor: pointer;
	}

	.undo-btn.active:hover {
		color: #fff;
		background: rgba(30, 41, 59, 1);
		border-color: rgba(255, 255, 255, 0.2);
	}

	.app-logo {
		position: fixed;
		bottom: 16px;
		left: 16px;
		z-index: 8000;
		opacity: 0.9;
		transition: opacity 200ms ease;
	}

	.app-logo:hover {
		opacity: 1;
	}

	.app-logo img {
		height: 32px;
		width: auto;
		display: block;
		filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.3));
	}
</style>

