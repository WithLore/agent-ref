/**
 * File I/O — save/load projects.
 * Dual-mode: uses Tauri dialog+fs plugins when available, falls back to browser APIs.
 */

import { isTauri } from '$lib/tauri-bridge.js';
import { serializeProject, deserializeProject, FILE_EXTENSION } from './serialization.js';
import type { ProjectData } from '$lib/items/item-types.js';

let currentFilePath: string | null = null;

export function getCurrentFilePath(): string | null {
	return currentFilePath;
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
 * Silent auto-save — only writes if a file path is already set (Tauri only).
 * Does NOT prompt the user. Returns true if saved, false if no path or browser mode.
 */
export async function saveProjectSilent(project: ProjectData): Promise<boolean> {
	if (!isTauri || !currentFilePath) return false;
	try {
		const { json } = serializeProject(project);
		const { writeTextFile } = await import('@tauri-apps/plugin-fs');
		await writeTextFile(currentFilePath, json);
		return true;
	} catch (err) {
		console.error('[AgentRef] Auto-save failed:', err);
		return false;
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
