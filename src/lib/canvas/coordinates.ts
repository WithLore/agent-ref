/**
 * Convert screen-space coordinates to canvas-space coordinates.
 * Screen space = pixels relative to browser viewport.
 * Canvas space = position within the infinite canvas.
 */
export function screenToCanvas(
	screenX: number,
	screenY: number,
	viewportX: number,
	viewportY: number,
	scale: number
): { x: number; y: number } {
	return {
		x: (screenX - viewportX) / scale,
		y: (screenY - viewportY) / scale
	};
}

/**
 * Convert canvas-space coordinates to screen-space coordinates.
 */
export function canvasToScreen(
	canvasX: number,
	canvasY: number,
	viewportX: number,
	viewportY: number,
	scale: number
): { x: number; y: number } {
	return {
		x: canvasX * scale + viewportX,
		y: canvasY * scale + viewportY
	};
}
