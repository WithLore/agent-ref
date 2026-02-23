import { describe, it, expect } from 'vitest';
import { computeAlignment, computeDistribution } from './alignment.js';
import type { BoardItem } from '$lib/items/item-types.js';

function makeItem(id: string, x: number, y: number, w: number, h: number): BoardItem {
	return {
		id,
		type: 'image',
		url: '',
		x,
		y,
		width: w,
		height: h,
		zIndex: 0,
		rotation: 0,
		tags: [],
		rating: 0
	};
}

describe('computeAlignment', () => {
	const items = [
		makeItem('a', 10, 20, 100, 50),
		makeItem('b', 50, 80, 80, 60),
		makeItem('c', 200, 40, 120, 40)
	];

	it('returns empty map for fewer than 2 items', () => {
		expect(computeAlignment([], 'left').size).toBe(0);
		expect(computeAlignment([items[0]], 'left').size).toBe(0);
	});

	it('aligns items to left edge', () => {
		const result = computeAlignment(items, 'left');
		expect(result.get('a')!.x).toBe(10); // leftmost stays
		expect(result.get('b')!.x).toBe(10);
		expect(result.get('c')!.x).toBe(10);
		// Y positions should not change
		expect(result.get('a')!.y).toBe(20);
		expect(result.get('b')!.y).toBe(80);
		expect(result.get('c')!.y).toBe(40);
	});

	it('aligns items to right edge', () => {
		const result = computeAlignment(items, 'right');
		const maxRight = 200 + 120; // item c: x + width = 320
		expect(result.get('a')!.x).toBe(maxRight - 100); // 220
		expect(result.get('b')!.x).toBe(maxRight - 80); // 240
		expect(result.get('c')!.x).toBe(maxRight - 120); // 200
	});

	it('aligns items to top edge', () => {
		const result = computeAlignment(items, 'top');
		expect(result.get('a')!.y).toBe(20); // topmost stays
		expect(result.get('b')!.y).toBe(20);
		expect(result.get('c')!.y).toBe(20);
		// X positions should not change
		expect(result.get('a')!.x).toBe(10);
		expect(result.get('b')!.x).toBe(50);
		expect(result.get('c')!.x).toBe(200);
	});

	it('aligns items to bottom edge', () => {
		const result = computeAlignment(items, 'bottom');
		const maxBottom = 80 + 60; // item b: y + height = 140
		expect(result.get('a')!.y).toBe(maxBottom - 50); // 90
		expect(result.get('b')!.y).toBe(maxBottom - 60); // 80
		expect(result.get('c')!.y).toBe(maxBottom - 40); // 100
	});

	it('centers items horizontally', () => {
		const result = computeAlignment(items, 'center-h');
		// Bounding box: minX=10, maxX=320; centerX=165
		const centerX = (10 + 320) / 2; // 165
		expect(result.get('a')!.x).toBe(centerX - 100 / 2); // 115
		expect(result.get('b')!.x).toBe(centerX - 80 / 2); // 125
		expect(result.get('c')!.x).toBe(centerX - 120 / 2); // 105
	});

	it('centers items vertically', () => {
		const result = computeAlignment(items, 'center-v');
		// Bounding box: minY=20, maxY=140; centerY=80
		const centerY = (20 + 140) / 2; // 80
		expect(result.get('a')!.y).toBe(centerY - 50 / 2); // 55
		expect(result.get('b')!.y).toBe(centerY - 60 / 2); // 50
		expect(result.get('c')!.y).toBe(centerY - 40 / 2); // 60
	});
});

describe('computeDistribution', () => {
	it('returns empty map for fewer than 3 items', () => {
		const items = [makeItem('a', 0, 0, 50, 50), makeItem('b', 100, 0, 50, 50)];
		expect(computeDistribution(items, 'horizontal').size).toBe(0);
		expect(computeDistribution([], 'horizontal').size).toBe(0);
	});

	it('distributes 3 items horizontally with equal gaps', () => {
		const items = [
			makeItem('a', 0, 0, 40, 30),
			makeItem('b', 60, 0, 40, 30),
			makeItem('c', 200, 0, 40, 30)
		];
		const result = computeDistribution(items, 'horizontal');
		// Total span: 200+40 - 0 = 240; total item width: 120; gaps: 2
		// gap = (240 - 120) / 2 = 60
		expect(result.get('a')!.x).toBe(0); // first stays
		expect(result.get('b')!.x).toBe(0 + 40 + 60); // 100
		expect(result.get('c')!.x).toBe(0 + 40 + 60 + 40 + 60); // 200
		// Y positions unchanged
		expect(result.get('a')!.y).toBe(0);
		expect(result.get('b')!.y).toBe(0);
		expect(result.get('c')!.y).toBe(0);
	});

	it('distributes 3 items vertically with equal gaps', () => {
		const items = [
			makeItem('a', 0, 0, 30, 40),
			makeItem('b', 0, 60, 30, 40),
			makeItem('c', 0, 200, 30, 40)
		];
		const result = computeDistribution(items, 'vertical');
		// Total span: 200+40 - 0 = 240; total item height: 120; gaps: 2
		// gap = (240 - 120) / 2 = 60
		expect(result.get('a')!.y).toBe(0);
		expect(result.get('b')!.y).toBe(0 + 40 + 60); // 100
		expect(result.get('c')!.y).toBe(0 + 40 + 60 + 40 + 60); // 200
		// X positions unchanged
		expect(result.get('a')!.x).toBe(0);
		expect(result.get('b')!.x).toBe(0);
		expect(result.get('c')!.x).toBe(0);
	});

	it('sorts items by position before distributing', () => {
		// Items provided out of order
		const items = [
			makeItem('c', 200, 0, 40, 30),
			makeItem('a', 0, 0, 40, 30),
			makeItem('b', 60, 0, 40, 30)
		];
		const result = computeDistribution(items, 'horizontal');
		// Should still produce correct positions regardless of input order
		expect(result.get('a')!.x).toBe(0);
		expect(result.get('c')!.x).toBe(200);
	});

	it('handles 4+ items with correct spacing', () => {
		const items = [
			makeItem('a', 0, 0, 20, 20),
			makeItem('b', 40, 0, 20, 20),
			makeItem('c', 80, 0, 20, 20),
			makeItem('d', 300, 0, 20, 20)
		];
		const result = computeDistribution(items, 'horizontal');
		// Total span: 300+20 - 0 = 320; total width: 80; gaps: 3
		// gap = (320 - 80) / 3 = 80
		expect(result.get('a')!.x).toBe(0);
		expect(result.get('b')!.x).toBeCloseTo(100, 5);
		expect(result.get('c')!.x).toBeCloseTo(200, 5);
		expect(result.get('d')!.x).toBeCloseTo(300, 5);
	});
});
