/**
 * Serialization — JSON serialize/deserialize with validation and migration.
 */

import type { ProjectData, BoardItem, TodoEntry } from '$lib/items/item-types.js';

const CURRENT_VERSION = 2;
export const FILE_EXTENSION = '.agentref';

/** Valid item types that the app understands. */
const VALID_ITEM_TYPES = new Set(['image', 'video', 'youtube', 'text', 'todo', 'link']);

/**
 * Check if a raw object looks like a valid BoardItem.
 * Filters out corrupted or incomplete items during load.
 */
function isValidItem(item: unknown): item is BoardItem {
	if (!item || typeof item !== 'object') return false;
	const it = item as Record<string, unknown>;
	return (
		typeof it.id === 'string' &&
		typeof it.type === 'string' &&
		VALID_ITEM_TYPES.has(it.type) &&
		typeof it.url === 'string' &&
		typeof it.x === 'number' &&
		typeof it.y === 'number' &&
		typeof it.width === 'number' &&
		typeof it.height === 'number' &&
		typeof it.zIndex === 'number'
	);
}

/**
 * Serialize a project to JSON string.
 * Strips blob: URLs (they won't survive reload).
 * Returns { json, strippedBlobCount } so callers can warn the user.
 */
export function serializeProject(project: ProjectData): { json: string; strippedBlobCount: number } {
	const sanitized = structuredClone(project);
	sanitized.modifiedAt = new Date().toISOString();

	let strippedBlobCount = 0;
	for (const board of sanitized.boards) {
		for (const item of board.items) {
			if (item.url.startsWith('blob:')) {
				item.url = '';
				strippedBlobCount++;
				console.warn(`[AgentRef] Blob URL stripped for item ${item.id} during save`);
			}
		}
	}

	return { json: JSON.stringify(sanitized, null, 2), strippedBlobCount };
}

/**
 * Deserialize a JSON string into a ProjectData object.
 * Handles version migrations and validation.
 */
export function deserializeProject(json: string): ProjectData {
	let data: ProjectData;
	try {
		data = JSON.parse(json) as ProjectData;
	} catch {
		throw new Error('Invalid project file: could not parse JSON');
	}

	if (!data || typeof data !== 'object') {
		throw new Error('Invalid project file: not an object');
	}

	// Version check: reject files from newer versions
	const version = (data as unknown as Record<string, unknown>).version;
	if (typeof version === 'number' && version > CURRENT_VERSION) {
		throw new Error(
			`Project file version ${version} is newer than this app supports (v${CURRENT_VERSION}). Please update AgentRef.`
		);
	}

	// Version migration
	if (version !== CURRENT_VERSION) {
		data = migrateProject(data, typeof version === 'number' ? version : 0);
	}

	// Validate on a clone so we don't mutate the parsed input
	return validateProject(structuredClone(data));
}

function migrateProject(data: ProjectData, fromVersion: number): ProjectData {
	// v0 → v1: no structural changes, just stamp the version
	if (fromVersion < 1) {
		data.version = 1;
	}
	if (fromVersion < 2) {
		const fallback = data.createdAt || new Date().toISOString();
		for (const board of data.boards ?? []) {
			board.connections = [];
			for (const item of board.items ?? []) {
				item.createdAt = item.createdAt || board.createdAt || fallback;
				item.updatedAt = item.updatedAt || item.createdAt;
			}
		}
		data.version = 2;
	}
	return data;
}

function validateProject(data: ProjectData): ProjectData {
	if (!data.boards || !Array.isArray(data.boards) || data.boards.length === 0) {
		throw new Error('Project contains no boards');
	}

	if (!data.activeBoardId || !data.boards.find((b) => b.id === data.activeBoardId)) {
		data.activeBoardId = data.boards[0].id;
	}

	// Ensure every board has required arrays
	for (const board of data.boards) {
		if (!Array.isArray(board.items)) board.items = [];
		if (!Array.isArray(board.groups)) board.groups = [];
		if (!Array.isArray(board.connections)) board.connections = [];
		if (!board.viewport) board.viewport = { x: 0, y: 0, scale: 1 };
		if (!board.createdAt) board.createdAt = new Date().toISOString();
		if (!board.modifiedAt) board.modifiedAt = board.createdAt;

		// Filter out invalid items (prevents runtime crashes from corrupted data)
		const originalCount = board.items.length;
		board.items = board.items.filter(isValidItem);
		if (board.items.length < originalCount) {
			console.warn(
				`[AgentRef] Filtered ${originalCount - board.items.length} invalid items from board "${board.name}"`
			);
		}

		// Ensure items have required fields (backcompat)
		for (const item of board.items) {
			if (!Array.isArray(item.tags)) item.tags = [];
			if (typeof item.rating !== 'number') item.rating = 0;
			if (!item.createdAt) item.createdAt = board.createdAt;
			if (!item.updatedAt) item.updatedAt = item.createdAt;
			if (item.type === 'todo') {
				if (!item.todoMeta || !Array.isArray(item.todoMeta.items)) {
					item.todoMeta = { title: item.url || 'To-do list', items: [] };
				}
				item.todoMeta.items = item.todoMeta.items.filter((entry: TodoEntry) =>
					Boolean(entry && typeof entry.id === 'string' && typeof entry.text === 'string')
				);
				for (const entry of item.todoMeta.items) {
					entry.createdAt ||= item.createdAt;
					entry.updatedAt ||= entry.createdAt;
					entry.completed = Boolean(entry.completed);
					entry.completedAt = entry.completed ? (entry.completedAt || entry.updatedAt) : null;
				}
			}
		}

		const itemIds = new Set(board.items.map((item) => item.id));
		const todoIds = new Map(board.items
			.filter((item) => item.type === 'todo')
			.map((item) => [item.id, new Set(item.todoMeta?.items.map((entry) => entry.id) ?? [])]));
		board.connections = board.connections.filter((connection) =>
			Boolean(
				connection && typeof connection.id === 'string' &&
				itemIds.has(connection.sourceItemId) && itemIds.has(connection.targetItemId) &&
				todoIds.get(connection.sourceItemId)?.has(connection.sourceTodoId) &&
				typeof connection.createdAt === 'string'
			)
		);
	}

	return data;
}
