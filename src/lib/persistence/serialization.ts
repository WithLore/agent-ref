/**
 * Serialization — JSON serialize/deserialize with validation and migration.
 */

import type { ProjectData, BoardItem } from '$lib/items/item-types.js';

const CURRENT_VERSION = 1;
export const FILE_EXTENSION = '.agentref';

/** Valid item types that the app understands. */
const VALID_ITEM_TYPES = new Set(['image', 'video', 'youtube', 'text']);

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
		data.version = CURRENT_VERSION;
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
		}
	}

	return data;
}
