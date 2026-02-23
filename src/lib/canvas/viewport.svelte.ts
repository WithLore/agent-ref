/**
 * Viewport state — manages pan, zoom, and the CSS transform for the infinite canvas.
 * Uses Svelte 5 runes ($state, $derived).
 *
 * Zoom-to-point math ported from AnimRef:
 *   ratio = 1 - nextScale / currentScale
 *   translateX += (cursorX - translateX) * ratio
 *   translateY += (cursorY - translateY) * ratio
 * This keeps the point under the cursor visually stable during zoom.
 */

const MIN_SCALE = 0.02;
const MAX_SCALE = 10;
const ZOOM_SENSITIVITY = 0.001;

export function createViewport() {
	let x = $state(0);
	let y = $state(0);
	let scale = $state(1);

	const transform = $derived(`translate(${x}px, ${y}px) scale(${scale})`);

	function pan(dx: number, dy: number) {
		x += dx;
		y += dy;
	}

	/**
	 * Zoom to a specific scale, keeping the point (clientX, clientY) stable on screen.
	 */
	function zoomToPoint(nextScale: number, clientX: number, clientY: number) {
		nextScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, nextScale));
		const ratio = 1 - nextScale / scale;
		x += (clientX - x) * ratio;
		y += (clientY - y) * ratio;
		scale = nextScale;
	}

	/**
	 * Zoom by a wheel delta amount, centered on the cursor position.
	 */
	function zoomByDelta(delta: number, clientX: number, clientY: number) {
		const factor = 1 - delta * ZOOM_SENSITIVITY;
		const nextScale = scale * factor;
		zoomToPoint(nextScale, clientX, clientY);
	}

	/**
	 * Reset viewport to default position and scale.
	 */
	function reset() {
		x = 0;
		y = 0;
		scale = 1;
	}

	/**
	 * Zoom to fit a bounding box in the viewport with padding.
	 * Centers the content and sets scale so it fits within the window.
	 */
	function zoomToFit(
		bounds: { minX: number; minY: number; maxX: number; maxY: number },
		windowWidth: number,
		windowHeight: number,
		padding = 60
	) {
		const contentW = bounds.maxX - bounds.minX;
		const contentH = bounds.maxY - bounds.minY;
		if (contentW <= 0 || contentH <= 0) {
			reset();
			return;
		}

		const availW = windowWidth - padding * 2;
		const availH = windowHeight - padding * 2;
		const fitScale = Math.min(availW / contentW, availH / contentH, 2); // cap at 2x
		const clampedScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, fitScale));

		// Center the content
		const centerX = (bounds.minX + bounds.maxX) / 2;
		const centerY = (bounds.minY + bounds.maxY) / 2;
		x = windowWidth / 2 - centerX * clampedScale;
		y = windowHeight / 2 - centerY * clampedScale;
		scale = clampedScale;
	}

	/**
	 * Set viewport to exact values (for restoring saved viewport on board switch).
	 */
	function setTo(newX: number, newY: number, newScale: number) {
		x = newX;
		y = newY;
		scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, newScale));
	}

	return {
		get x() {
			return x;
		},
		get y() {
			return y;
		},
		get scale() {
			return scale;
		},
		get transform() {
			return transform;
		},
		pan,
		zoomToPoint,
		zoomByDelta,
		reset,
		zoomToFit,
		setTo
	};
}
