/**
 * Context menu state — tracks visibility, position, and target.
 */

export type ContextTarget = 'canvas' | 'item' | 'group' | 'multi';

export function createContextMenuState() {
	let visible = $state(false);
	let x = $state(0);
	let y = $state(0);
	let target = $state<ContextTarget>('canvas');
	let targetId = $state<string | undefined>(undefined);

	function show(
		screenX: number,
		screenY: number,
		t: ContextTarget,
		id?: string
	) {
		// Clamp to viewport so menu doesn't overflow
		x = Math.min(screenX, window.innerWidth - 200);
		y = Math.min(screenY, window.innerHeight - 300);
		target = t;
		targetId = id;
		visible = true;
	}

	function hide() {
		visible = false;
	}

	return {
		get visible() { return visible; },
		get x() { return x; },
		get y() { return y; },
		get target() { return target; },
		get targetId() { return targetId; },
		show,
		hide
	};
}
