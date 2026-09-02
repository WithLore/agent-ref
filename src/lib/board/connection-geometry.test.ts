import { describe, expect, it } from 'vitest';
import { createItem } from '$lib/items/item-types.js';
import { createTodoEntry } from '$lib/items/item-types.js';
import { getConnectionPath, getTargetAnchor, getTodoListHeight, getTodoSourcePoint } from './connection-geometry.js';

describe('connection geometry', () => {
	it('anchors a connector to the correct todo row', () => {
		const first = createTodoEntry('First');
		const second = createTodoEntry('Second');
		const item = createItem({ type: 'todo', url: '', x: 10, y: 20, width: 360, todoMeta: { title: 'List', items: [first, second] } });
		expect(getTodoSourcePoint(item, second.id)).toEqual({ x: 370, y: 20 + 58 + 64 + 32 });
	});

	it('anchors targets on their nearest boundary', () => {
		const target = createItem({ type: 'image', url: 'x', x: 500, y: 100, width: 200, height: 100 });
		expect(getTargetAnchor(target, { x: 300, y: 150 })).toEqual({ x: 500, y: 150 });
	});

	it('sizes todo cards predictably and creates a cubic path', () => {
		expect(getTodoListHeight(3)).toBe(292);
		expect(getConnectionPath({ x: 0, y: 0 }, { x: 100, y: 50 })).toMatch(/^M 0 0 C /);
	});
});
