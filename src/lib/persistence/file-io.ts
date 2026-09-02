/**
 * File I/O — save/load projects.
 * Dual-mode: uses Tauri dialog+fs plugins when available, falls back to browser APIs.
 */

import { isTauri } from '$lib/tauri-bridge.js';
import { serializeProject, deserializeProject, FILE_EXTENSION } from './serialization.js';
import type { ProjectData } from '$lib/items/item-types.js';

let currentFilePath: string | null = null;
let recoveryFilePath: string | null = null;

const RECOVERY_STORAGE_KEY = 'agentref:recovery:v1';
const RECOVERY_FILE_NAME = 'autosave.json';
const LEGACY_RECOVERY_FILE_NAME = 'autosave.agentref';

export function getCurrentFilePath(): string | null {
	return currentFilePath;
}

/**
 * Path agents should use for the live project. Unsaved projects use the
 * continuously maintained recovery file instead of having no path at all.
 */
export function getLiveProjectPath(): string | null {
	return currentFilePath ?? recoveryFilePath;
}

export function getFileName(): string | null {
	if (!currentFilePath) return null;
	const parts = currentFilePath.replace(/\\/g, '/').split('/');
	return parts[parts.length - 1] ?? null;
}

/**
 * Save project (reuse last path, or prompt if first save).
 * Returns { success, strippedBlobCount } so callers can warn the user.
 */
export async function saveProject(project: ProjectData): Promise<{ success: boolean; strippedBlobCount: number }> {
	const { json, strippedBlobCount } = serializeProject(project);
	let success: boolean;
	if (isTauri) {
		success = await saveProjectTauri(json, false);
	} else {
		success = saveProjectBrowser(json, project.name);
	}
	if (success) await saveRecoveryJson(json);
	return { success, strippedBlobCount };
}

/**
 * Save As — always prompt for path.
 */
export async function saveProjectAs(project: ProjectData): Promise<{ success: boolean; strippedBlobCount: number }> {
	const { json, strippedBlobCount } = serializeProject(project);
	let success: boolean;
	if (isTauri) {
		success = await saveProjectTauri(json, true);
	} else {
		success = saveProjectBrowser(json, project.name);
	}
	if (success) await saveRecoveryJson(json);
	return { success, strippedBlobCount };
}

/**
 * Load project from file.
 */
export async function loadProject(): Promise<ProjectData | null> {
	if (isTauri) {
		return loadProjectTauri();
	}
	return loadProjectBrowser();
}

/**
 * Write the latest project to recovery storage and, when one has been chosen,
 * the user's project file. Never prompts.
 */
export async function saveProjectSilent(project: ProjectData): Promise<boolean> {
	const { json } = serializeProject(project);
	const recoverySaved = await saveRecoveryJson(json);

	if (!isTauri || !currentFilePath) return recoverySaved;
	try {
		const { writeTextFile } = await import('@tauri-apps/plugin-fs');
		await writeTextFile(currentFilePath, json);
		return true;
	} catch (err) {
		console.error('[AgentRef] Auto-save failed:', err);
		return recoverySaved;
	}
}

/**
 * Synchronous crash/quit safety net. Web views may be torn down before an
 * asynchronous file write finishes, so keep the same project JSON locally too.
 */
export function saveProjectRecoverySync(project: ProjectData): boolean {
	try {
		return writeRecoveryToLocalStorage(serializeProject(project).json);
	} catch (err) {
		console.error('[AgentRef] Recovery checkpoint failed:', err);
		return false;
	}
}

/** Load the newest valid automatic recovery snapshot, if one exists. */
export async function loadProjectRecovery(): Promise<ProjectData | null> {
	const candidates: Array<string | null> = [readRecoveryFromLocalStorage()];
	let legacyRecovery: string | null = null;
	let hasModernDiskRecovery = false;

	if (isTauri) {
		try {
			const path = await resolveRecoveryFilePath();
			const { exists, readTextFile } = await import('@tauri-apps/plugin-fs');
			if (await exists(path)) {
				hasModernDiskRecovery = true;
				candidates.push(await readTextFile(path));
			}
		} catch (err) {
			console.warn('[AgentRef] Could not read disk recovery:', err);
		}

		try {
			const { homeDir, join } = await import('@tauri-apps/api/path');
			const { exists, readTextFile } = await import('@tauri-apps/plugin-fs');
			const home = await homeDir();
			const legacyPath = await join(home, '.agentref', LEGACY_RECOVERY_FILE_NAME);
			if (await exists(legacyPath)) {
				legacyRecovery = await readTextFile(legacyPath);
				candidates.push(legacyRecovery);
			}

			const liveStatePath = await join(home, '.agentref', 'live-state.json');
			if (await exists(liveStatePath)) {
				const liveState = JSON.parse(await readTextFile(liveStatePath)) as { project?: unknown };
				if (liveState.project) {
					hasModernDiskRecovery = true;
					candidates.push(JSON.stringify(liveState.project));
				}
			}
		} catch (err) {
			console.warn('[AgentRef] Could not read live project recovery:', err);
		}
	}

	// One-time migration: prefer the old disk recovery over a newer blank
	// webview snapshot until the first modern disk/live-state copy exists.
	if (!hasModernDiskRecovery && legacyRecovery) {
		try {
			return deserializeProject(legacyRecovery);
		} catch {
			// Fall through to the other valid candidates.
		}
	}

	return selectNewestRecovery(candidates);
}

/** Pure candidate selection, exported so recovery behavior can be tested. */
export function selectNewestRecovery(candidates: Array<string | null | undefined>): ProjectData | null {
	let newest: ProjectData | null = null;
	let newestTime = Number.NEGATIVE_INFINITY;

	for (const json of candidates) {
		if (!json) continue;
		try {
			const project = deserializeProject(json);
			const timestamp = Date.parse(project.modifiedAt || project.createdAt);
			const time = Number.isNaN(timestamp) ? 0 : timestamp;
			if (!newest || time > newestTime) {
				newest = project;
				newestTime = time;
			}
		} catch {
			// Ignore a corrupted candidate and continue to the other recovery copy.
		}
	}

	return newest;
}

async function resolveRecoveryFilePath(): Promise<string> {
	if (recoveryFilePath) return recoveryFilePath;
	const { homeDir, join } = await import('@tauri-apps/api/path');
	const home = await homeDir();
	recoveryFilePath = await join(home, '.agentref', RECOVERY_FILE_NAME);
	return recoveryFilePath;
}

async function saveRecoveryJson(json: string): Promise<boolean> {
	const localSaved = writeRecoveryToLocalStorage(json);
	if (!isTauri) return localSaved;

	try {
		const { writeTextFile } = await import('@tauri-apps/plugin-fs');
		await writeTextFile(await resolveRecoveryFilePath(), json);
		return true;
	} catch (err) {
		console.error('[AgentRef] Disk recovery save failed:', err);
		return localSaved;
	}
}

function writeRecoveryToLocalStorage(json: string): boolean {
	if (typeof window === 'undefined') return false;
	try {
		window.localStorage.setItem(RECOVERY_STORAGE_KEY, json);
		return true;
	} catch (err) {
		console.warn('[AgentRef] Local recovery save failed:', err);
		return false;
	}
}

function readRecoveryFromLocalStorage(): string | null {
	if (typeof window === 'undefined') return null;
	try {
		return window.localStorage.getItem(RECOVERY_STORAGE_KEY);
	} catch (err) {
		console.warn('[AgentRef] Local recovery read failed:', err);
		return null;
	}
}

// --- Tauri implementations ---

async function saveProjectTauri(json: string, forceDialog: boolean): Promise<boolean> {
	try {
		const { save } = await import('@tauri-apps/plugin-dialog');
		const { writeTextFile } = await import('@tauri-apps/plugin-fs');

		let path = currentFilePath;

		if (!path || forceDialog) {
			const selected = await save({
				filters: [{ name: 'AgentRef Project', extensions: ['agentref', 'json'] }],
				defaultPath: currentFilePath ?? undefined
			});
			if (!selected) return false;
			path = selected;
		}

		await writeTextFile(path, json);
		currentFilePath = path;
		return true;
	} catch (err) {
		console.error('[AgentRef] Save failed:', err);
		return false;
	}
}

async function loadProjectTauri(): Promise<ProjectData | null> {
	try {
		const { open } = await import('@tauri-apps/plugin-dialog');
		const { readTextFile } = await import('@tauri-apps/plugin-fs');

		const selected = await open({
			filters: [{ name: 'AgentRef Project', extensions: ['agentref', 'json'] }],
			multiple: false
		});

		if (!selected) return null;

		// Tauri v2 open() returns string | string[] | { path: string } | null
		let path: string;
		if (typeof selected === 'string') {
			path = selected;
		} else if (typeof selected === 'object' && selected !== null && 'path' in selected) {
			path = (selected as { path: string }).path;
		} else {
			path = String(selected);
		}

		const json = await readTextFile(path);
		currentFilePath = path;
		return deserializeProject(json);
	} catch (err) {
		console.error('[AgentRef] Load failed:', err);
		return null;
	}
}

// --- Browser implementations ---

function saveProjectBrowser(json: string, projectName: string): boolean {
	try {
		const blob = new Blob([json], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `${projectName || 'untitled'}${FILE_EXTENSION}`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
		return true;
	} catch (err) {
		console.error('[AgentRef] Save failed:', err);
		return false;
	}
}

function loadProjectBrowser(): Promise<ProjectData | null> {
	return new Promise((resolve) => {
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = '.agentref,.json';

		// Handle file dialog cancel — resolve null instead of hanging forever
		let resolved = false;
		input.onchange = async () => {
			resolved = true;
			const file = input.files?.[0];
			if (!file) {
				resolve(null);
				return;
			}
			try {
				const json = await file.text();
				resolve(deserializeProject(json));
			} catch (err) {
				console.error('[AgentRef] Load failed:', err);
				resolve(null);
			}
		};
		// When the input loses focus without a file selected, resolve null
		// This fires when the file dialog is cancelled
		window.addEventListener(
			'focus',
			() => {
				setTimeout(() => {
					if (!resolved) resolve(null);
				}, 300);
			},
			{ once: true }
		);

		input.click();
	});
}
