/**
 * Packaging — export/import portable .agentref-pack (zip) files.
 *
 * Export: project JSON + all local media assets bundled into a single zip.
 * Import: extract zip, restore assets to app-data or blob URLs, load project.
 *
 * File structure inside the zip:
 *   project.json
 *   assets/
 *     {uuid}.{ext}   (deduplicated media files)
 */

import JSZip from 'jszip';
import { isTauri } from '$lib/tauri-bridge.js';
import { serializeProject, deserializeProject } from './serialization.js';
import type { ProjectData, BoardItem } from '$lib/items/item-types.js';

export const PACK_EXTENSION = '.agentref-pack';

/** Pattern matching Tauri asset protocol URLs */
const ASSET_URL_RE = /^https?:\/\/asset\.localhost\//;

/**
 * Check if a URL points to a local file (via Tauri asset protocol).
 */
function isLocalAssetUrl(url: string): boolean {
	return ASSET_URL_RE.test(url);
}

/**
 * Extract the original file path from a Tauri asset protocol URL.
 * e.g. "http://asset.localhost/C%3A%5CUsers%5C..." → "C:\Users\..."
 */
function assetUrlToFilePath(url: string): string {
	const stripped = url.replace(ASSET_URL_RE, '');
	return decodeURIComponent(stripped);
}

/**
 * Get a file extension from a URL or path.
 */
function getExtension(urlOrPath: string): string {
	const cleaned = urlOrPath.split('?')[0].split('#')[0];
	const dot = cleaned.lastIndexOf('.');
	if (dot === -1) return '';
	return cleaned.substring(dot + 1).toLowerCase();
}

/**
 * Generate a short unique ID for asset filenames.
 */
function assetId(): string {
	return crypto.randomUUID().substring(0, 12);
}

// ---------------------------------------------------------------------------
// EXPORT
// ---------------------------------------------------------------------------

/**
 * Export a project as a portable .agentref-pack zip file.
 *
 * Reads all local media assets, bundles them into the zip, and rewrites
 * URLs in the project JSON to relative asset paths.
 *
 * Returns the zip as a Blob, or null on failure.
 */
export async function exportPackage(project: ProjectData): Promise<Blob | null> {
	try {
		const zip = new JSZip();
		const assetsFolder = zip.folder('assets')!;

		// Clone to avoid mutating the live project
		const packProject = structuredClone(project);
		packProject.modifiedAt = new Date().toISOString();

		// Dedupe: map original URL → asset filename in the zip
		const urlToAssetName = new Map<string, string>();

		// Collect all local asset URLs across all boards
		for (const board of packProject.boards) {
			for (const item of board.items) {
				if (!item.url || item.type === 'text' || item.type === 'youtube') continue;
				if (!isLocalAssetUrl(item.url)) continue;
				if (urlToAssetName.has(item.url)) continue;

				const ext = getExtension(item.url) || 'bin';
				const name = `${assetId()}.${ext}`;
				urlToAssetName.set(item.url, name);
			}
		}

		// Fetch each unique asset and add to zip
		const fetchPromises: Promise<void>[] = [];
		for (const [url, name] of urlToAssetName) {
			fetchPromises.push(
				fetchAssetBinary(url).then((data) => {
					if (data) {
						assetsFolder.file(name, data);
					} else {
						console.warn(`[AgentRef] Could not read asset: ${url}`);
					}
				})
			);
		}
		await Promise.all(fetchPromises);

		// Rewrite item URLs to relative asset paths
		for (const board of packProject.boards) {
			for (const item of board.items) {
				const assetName = urlToAssetName.get(item.url);
				if (assetName) {
					item.url = `assets/${assetName}`;
				}
				// Strip blob URLs
				if (item.url.startsWith('blob:')) {
					item.url = '';
				}
			}
		}

		// Add project JSON
		const json = JSON.stringify(packProject, null, 2);
		zip.file('project.json', json);

		// Generate the zip blob
		return await zip.generateAsync({
			type: 'blob',
			compression: 'DEFLATE',
			compressionOptions: { level: 6 }
		});
	} catch (err) {
		console.error('[AgentRef] Export package failed:', err);
		return null;
	}
}

/**
 * Fetch binary data from a local asset URL.
 * Uses fetch() against the Tauri asset protocol (already enabled with scope **).
 */
async function fetchAssetBinary(url: string): Promise<ArrayBuffer | null> {
	try {
		const response = await fetch(url);
		if (!response.ok) return null;
		return await response.arrayBuffer();
	} catch {
		return null;
	}
}

// ---------------------------------------------------------------------------
// IMPORT
// ---------------------------------------------------------------------------

/** Result from importing a package. */
export interface ImportResult {
	project: ProjectData;
	/** Blob URLs created during browser-mode import (caller should track for cleanup). */
	blobUrls: string[];
}

/**
 * Import a .agentref-pack zip file.
 *
 * Extracts assets and restores them:
 * - Tauri: writes to app-data/agentref-assets/{projectId}/, converts to asset URLs
 * - Browser: creates blob URLs (in-memory only)
 *
 * Returns the loaded ProjectData with rewritten URLs, or null on failure.
 */
export async function importPackage(zipBlob: Blob): Promise<ImportResult | null> {
	try {
		const zip = await JSZip.loadAsync(zipBlob);

		// Read project.json
		const projectFile = zip.file('project.json');
		if (!projectFile) {
			throw new Error('Package missing project.json');
		}
		const json = await projectFile.async('string');
		const project = deserializeProject(json);

		// Collect all relative asset references
		const assetRefs = new Set<string>();
		for (const board of project.boards) {
			for (const item of board.items) {
				if (item.url.startsWith('assets/')) {
					assetRefs.add(item.url);
				}
			}
		}

		// Extract assets and build URL mapping
		const assetUrlMap = new Map<string, string>();

		if (isTauri) {
			await extractAssetsTauri(zip, assetRefs, project.id, assetUrlMap);
		} else {
			await extractAssetsBrowser(zip, assetRefs, assetUrlMap);
		}

		// Collect blob URLs for cleanup tracking
		const blobUrls: string[] = [];
		for (const url of assetUrlMap.values()) {
			if (url.startsWith('blob:')) {
				blobUrls.push(url);
			}
		}

		// Rewrite item URLs
		for (const board of project.boards) {
			for (const item of board.items) {
				const newUrl = assetUrlMap.get(item.url);
				if (newUrl) {
					item.url = newUrl;
				}
			}
		}

		return { project, blobUrls };
	} catch (err) {
		console.error('[AgentRef] Import package failed:', err);
		return null;
	}
}

/**
 * Tauri: extract assets to app-data directory and convert to asset protocol URLs.
 */
async function extractAssetsTauri(
	zip: JSZip,
	assetRefs: Set<string>,
	projectId: string,
	urlMap: Map<string, string>
): Promise<void> {
	const { appDataDir, join } = await import('@tauri-apps/api/path');
	const { mkdir, writeFile: tauriWriteFile } = await import('@tauri-apps/plugin-fs');
	const { convertFileSrc } = await import('@tauri-apps/api/core');

	const baseDir = await appDataDir();
	const assetsDir = await join(baseDir, 'agentref-assets', projectId);

	// Ensure directory exists
	await mkdir(assetsDir, { recursive: true });

	for (const ref of assetRefs) {
		const zipFile = zip.file(ref);
		if (!zipFile) continue;

		const data = await zipFile.async('uint8array');
		const fileName = ref.replace('assets/', '');
		const filePath = await join(assetsDir, fileName);

		await tauriWriteFile(filePath, data);
		const assetUrl = convertFileSrc(filePath);
		urlMap.set(ref, assetUrl);
	}
}

/**
 * Browser: extract assets as blob URLs (in-memory).
 */
async function extractAssetsBrowser(
	zip: JSZip,
	assetRefs: Set<string>,
	urlMap: Map<string, string>
): Promise<void> {
	for (const ref of assetRefs) {
		const zipFile = zip.file(ref);
		if (!zipFile) continue;

		const data = await zipFile.async('blob');
		const ext = getExtension(ref);
		const mimeMap: Record<string, string> = {
			png: 'image/png',
			jpg: 'image/jpeg',
			jpeg: 'image/jpeg',
			gif: 'image/gif',
			webp: 'image/webp',
			svg: 'image/svg+xml',
			mp4: 'video/mp4',
			webm: 'video/webm',
			ogg: 'video/ogg'
		};
		const mime = mimeMap[ext] || 'application/octet-stream';
		const blob = new Blob([data], { type: mime });
		urlMap.set(ref, URL.createObjectURL(blob));
	}
}

// ---------------------------------------------------------------------------
// SAVE / LOAD helpers (trigger file dialog)
// ---------------------------------------------------------------------------

/**
 * Export package and save to disk via dialog.
 */
export async function exportPackageToFile(project: ProjectData): Promise<boolean> {
	const blob = await exportPackage(project);
	if (!blob) return false;

	if (isTauri) {
		return exportPackageTauri(blob, project.name);
	}
	return exportPackageBrowser(blob, project.name);
}

/**
 * Load a .agentref-pack from disk via dialog.
 */
export async function importPackageFromFile(): Promise<ImportResult | null> {
	if (isTauri) {
		return importPackageTauri();
	}
	return importPackageBrowser();
}

async function exportPackageTauri(blob: Blob, projectName: string): Promise<boolean> {
	try {
		const { save } = await import('@tauri-apps/plugin-dialog');
		const { message } = await import('@tauri-apps/plugin-dialog');
		const { writeFile: tauriWriteFile } = await import('@tauri-apps/plugin-fs');

		const path = await save({
			filters: [{ name: 'AgentRef Package', extensions: ['agentref-pack'] }],
			defaultPath: `${projectName || 'untitled'}${PACK_EXTENSION}`
		});
		if (!path) return false;

		const buffer = await blob.arrayBuffer();
		await tauriWriteFile(path, new Uint8Array(buffer));
		console.log(`[AgentRef] Package exported to: ${path}`);
		await message(`Package exported successfully!\n\n${path}`, { title: 'Export Complete', kind: 'info' });
		return true;
	} catch (err) {
		console.error('[AgentRef] Export package save failed:', err);
		const { message } = await import('@tauri-apps/plugin-dialog');
		await message(`Export failed: ${(err as Error).message}`, { title: 'Export Error', kind: 'error' });
		return false;
	}
}

async function importPackageTauri(): Promise<ImportResult | null> {
	try {
		const { open } = await import('@tauri-apps/plugin-dialog');
		const { readFile: tauriReadFile } = await import('@tauri-apps/plugin-fs');

		const selected = await open({
			filters: [{ name: 'AgentRef Package', extensions: ['agentref-pack'] }],
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

		const data = await tauriReadFile(path);
		const blob = new Blob([data]);
		return await importPackage(blob);
	} catch (err) {
		console.error('[AgentRef] Import package failed:', err);
		return null;
	}
}

function exportPackageBrowser(blob: Blob, projectName: string): boolean {
	try {
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `${projectName || 'untitled'}${PACK_EXTENSION}`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
		return true;
	} catch (err) {
		console.error('[AgentRef] Export package download failed:', err);
		return false;
	}
}

function importPackageBrowser(): Promise<ImportResult | null> {
	return new Promise((resolve) => {
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = '.agentref-pack';

		let resolved = false;
		input.onchange = async () => {
			resolved = true;
			const file = input.files?.[0];
			if (!file) {
				resolve(null);
				return;
			}
			try {
				resolve(await importPackage(file));
			} catch (err) {
				console.error('[AgentRef] Import package failed:', err);
				resolve(null);
			}
		};
		// Handle file dialog cancel — resolve null instead of hanging
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
