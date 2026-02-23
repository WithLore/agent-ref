/**
 * Tauri bridge — handles Tauri-specific APIs with graceful fallback for browser.
 *
 * Detects whether we're running inside Tauri and provides:
 * - File drop event listening (onDragDropEvent)
 * - File path → displayable URL conversion (convertFileSrc)
 * - Environment detection
 */

/** Whether we're running inside a Tauri webview */
export const isTauri: boolean =
	typeof window !== 'undefined' && !!(window as any).__TAURI_INTERNALS__;

/**
 * Detect file type from a file path extension.
 */
export function detectFileTypeFromPath(filePath: string): 'image' | 'video' | null {
	const lower = filePath.toLowerCase();
	if (/\.(jpg|jpeg|png|gif|webp|svg|bmp|avif|ico|tiff|tif)$/.test(lower)) return 'image';
	if (/\.(mp4|webm|ogg|mov|avi|mkv|m4v|wmv)$/.test(lower)) return 'video';
	return null;
}

/**
 * Convert a local file path to a URL the webview can display.
 * Uses Tauri's convertFileSrc() in Tauri, falls back to file:// in browser.
 */
export async function filePathToUrl(filePath: string): Promise<string> {
	if (isTauri) {
		const { convertFileSrc } = await import('@tauri-apps/api/core');
		return convertFileSrc(filePath);
	}
	// Browser fallback — shouldn't be called, but just in case
	return `file://${filePath}`;
}

/**
 * Set up Tauri native file drop listener.
 * Returns an unlisten function, or null if not in Tauri.
 *
 * The callback receives file paths and the drop position (screen coords).
 *
 * Tauri DragDropEvent types: 'enter' | 'over' | 'drop' | 'leave'
 */
export async function setupTauriFileDrop(
	onDrop: (paths: string[], position: { x: number; y: number }) => void,
	onHover?: (position: { x: number; y: number }) => void,
	onLeave?: () => void
): Promise<(() => void) | null> {
	if (!isTauri) return null;

	try {
		const { getCurrentWebview } = await import('@tauri-apps/api/webview');
		const webview = getCurrentWebview();

		const unlisten = await webview.onDragDropEvent((event) => {
			const payload = event.payload;
			if (payload.type === 'drop') {
				onDrop(payload.paths, payload.position);
			} else if (payload.type === 'over') {
				onHover?.(payload.position);
			} else if (payload.type === 'enter') {
				// 'enter' also has position — treat like hover start
				onHover?.(payload.position);
			} else if (payload.type === 'leave') {
				onLeave?.();
			}
		});

		return unlisten;
	} catch (err) {
		console.error('Failed to set up Tauri file drop listener:', err);
		return null;
	}
}
