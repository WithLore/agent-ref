/**
 * Project store — multi-board state management.
 *
 * Wraps multiple boards and exposes the active board's store via the same
 * { items, update(fn) } interface that createBoardActions() expects.
 * This means board-actions.ts works without any changes.
 */

import type { BoardData, BoardItem, GroupData, ProjectData } from '$lib/items/item-types.js';
import { createBoard, createProject } from '$lib/items/item-types.js';

export function createProjectStore() {
	let project = $state<ProjectData>(createProject());

	// --- Active board (derived) ---

	const activeBoard = $derived(
		project.boards.find((b) => b.id === project.activeBoardId) ?? project.boards[0]
	);

	// --- Board store interface (same as createBoardStore) ---
	// This lets createBoardActions() work unchanged.

	const boardStore = {
		get items(): BoardItem[] {
			return activeBoard.items;
		},
		update(fn: (items: BoardItem[]) => BoardItem[]) {
			const now = new Date().toISOString();
			project = {
				...project,
				modifiedAt: now,
				boards: project.boards.map((b) =>
					b.id === project.activeBoardId
						? { ...b, items: fn(b.items), modifiedAt: now }
						: b
				)
			};
		}
	};

	// --- Group store ---

	const groupStore = {
		get groups(): GroupData[] {
			return activeBoard.groups;
		},
		updateGroups(fn: (groups: GroupData[]) => GroupData[]) {
			const now = new Date().toISOString();
			project = {
				...project,
				modifiedAt: now,
				boards: project.boards.map((b) =>
					b.id === project.activeBoardId
						? { ...b, groups: fn(b.groups), modifiedAt: now }
						: b
				)
			};
		}
	};

	/**
	 * Atomic update: modify both items and groups in a single state assignment.
	 * Halves render count during operations like group drag.
	 */
	function updateBoardAndGroups(
		itemsFn: (items: BoardItem[]) => BoardItem[],
		groupsFn: (groups: GroupData[]) => GroupData[]
	) {
		const now = new Date().toISOString();
		project = {
			...project,
			modifiedAt: now,
			boards: project.boards.map((b) =>
				b.id === project.activeBoardId
					? { ...b, items: itemsFn(b.items), groups: groupsFn(b.groups), modifiedAt: now }
					: b
			)
		};
	}

	// --- Board management ---

	function addBoard(name?: string): string {
		const board = createBoard(name ?? `Board ${project.boards.length + 1}`);
		project = {
			...project,
			boards: [...project.boards, board],
			modifiedAt: new Date().toISOString()
		};
		return board.id;
	}

	function deleteBoard(id: string) {
		if (project.boards.length <= 1) return; // never delete last board
		const remaining = project.boards.filter((b) => b.id !== id);
		const needSwitch = project.activeBoardId === id;
		project = {
			...project,
			boards: remaining,
			activeBoardId: needSwitch ? remaining[0].id : project.activeBoardId,
			modifiedAt: new Date().toISOString()
		};
	}

	function renameBoard(id: string, name: string) {
		project = {
			...project,
			boards: project.boards.map((b) => (b.id === id ? { ...b, name } : b)),
			modifiedAt: new Date().toISOString()
		};
	}

	function switchBoard(id: string) {
		if (!project.boards.find((b) => b.id === id)) return;
		project = { ...project, activeBoardId: id };
	}

	function duplicateBoard(id: string): string {
		const source = project.boards.find((b) => b.id === id);
		if (!source) return id;
		const now = new Date().toISOString();
		const newBoard: BoardData = {
			...structuredClone(source),
			id: crypto.randomUUID(),
			name: `${source.name} (copy)`,
			createdAt: now,
			modifiedAt: now
		};
		project = {
			...project,
			boards: [...project.boards, newBoard],
			modifiedAt: now
		};
		return newBoard.id;
	}

	// --- Viewport per board ---

	function saveViewport(x: number, y: number, scale: number) {
		project = {
			...project,
			boards: project.boards.map((b) =>
				b.id === project.activeBoardId ? { ...b, viewport: { x, y, scale } } : b
			)
		};
	}

	function getViewport(): { x: number; y: number; scale: number } {
		return activeBoard.viewport;
	}

	// --- Serialization ---

	function getProjectData(): ProjectData {
		return project;
	}

	function loadProjectData(data: ProjectData) {
		project = data;
	}

	function renameProject(name: string) {
		project = { ...project, name, modifiedAt: new Date().toISOString() };
	}

	return {
		get project() {
			return project;
		},
		get activeBoard() {
			return activeBoard;
		},
		get boardList() {
			return project.boards.map((b) => ({
				id: b.id,
				name: b.name,
				itemCount: b.items.length,
				modifiedAt: b.modifiedAt
			}));
		},
		boardStore,
		groupStore,
		updateBoardAndGroups,
		addBoard,
		deleteBoard,
		renameBoard,
		switchBoard,
		duplicateBoard,
		saveViewport,
		getViewport,
		getProjectData,
		loadProjectData,
		renameProject
	};
}
