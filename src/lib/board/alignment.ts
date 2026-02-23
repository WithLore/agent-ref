/**
 * Alignment & distribution — pure functions for positioning items.
 *
 * All calculations are relative to the bounding box of the provided items.
 * Returns a Map of item ID → new {x, y} position.
 */

import type { BoardItem } from '$lib/items/item-types.js';

export type AlignDirection = 'left' | 'right' | 'top' | 'bottom' | 'center-h' | 'center-v';
export type DistributeDirection = 'horizontal' | 'vertical';

export function computeAlignment(
	items: BoardItem[],
	direction: AlignDirection
): Map<string, { x: number; y: number }> {
	if (items.length < 2) return new Map();

	const minX = Math.min(...items.map((it) => it.x));
	const maxX = Math.max(...items.map((it) => it.x + it.width));
	const minY = Math.min(...items.map((it) => it.y));
	const maxY = Math.max(...items.map((it) => it.y + it.height));
	const centerX = (minX + maxX) / 2;
	const centerY = (minY + maxY) / 2;

	const result = new Map<string, { x: number; y: number }>();

	for (const item of items) {
		let x = item.x;
		let y = item.y;
		switch (direction) {
			case 'left':
				x = minX;
				break;
			case 'right':
				x = maxX - item.width;
				break;
			case 'top':
				y = minY;
				break;
			case 'bottom':
				y = maxY - item.height;
				break;
			case 'center-h':
				x = centerX - item.width / 2;
				break;
			case 'center-v':
				y = centerY - item.height / 2;
				break;
		}
		result.set(item.id, { x, y });
	}
	return result;
}

export function computeDistribution(
	items: BoardItem[],
	direction: DistributeDirection
): Map<string, { x: number; y: number }> {
	if (items.length < 3) return new Map();

	const sorted = [...items].sort((a, b) =>
		direction === 'horizontal' ? a.x - b.x : a.y - b.y
	);

	const first = sorted[0];
	const last = sorted[sorted.length - 1];
	const result = new Map<string, { x: number; y: number }>();

	if (direction === 'horizontal') {
		const totalSpan = last.x + last.width - first.x;
		const totalItemWidth = sorted.reduce((sum, it) => sum + it.width, 0);
		const gap = (totalSpan - totalItemWidth) / (sorted.length - 1);
		let currentX = first.x;
		for (const item of sorted) {
			result.set(item.id, { x: currentX, y: item.y });
			currentX += item.width + gap;
		}
	} else {
		const totalSpan = last.y + last.height - first.y;
		const totalItemHeight = sorted.reduce((sum, it) => sum + it.height, 0);
		const gap = (totalSpan - totalItemHeight) / (sorted.length - 1);
		let currentY = first.y;
		for (const item of sorted) {
			result.set(item.id, { x: item.x, y: currentY });
			currentY += item.height + gap;
		}
	}
	return result;
}
