import { describe, expect, it } from 'vitest';
import { createConnectionActions } from './connection-actions.js';
import type { BoardConnection } from '$lib/items/item-types.js';

function setup(initial: BoardConnection[] = []) {
	let connections = initial;
	const store = {
		get connections() { return connections; },
		updateConnections(fn: (value: BoardConnection[]) => BoardConnection[]) { connections = fn(connections); }
	};
	return { actions: createConnectionActions(store), get connections() { return connections; } };
}

describe('connection actions', () => {
	it('allows one todo to connect to unlimited distinct targets', () => {
		const state = setup();
		for (let index = 0; index < 100; index++) {
			state.actions.connect('list', 'todo', `target-${index}`);
		}
		expect(state.connections).toHaveLength(100);
		expect(state.connections.every((connection) => connection.createdAt.length > 0)).toBe(true);
	});

	it('does not duplicate an identical relationship', () => {
		const state = setup();
		const first = state.actions.connect('list', 'todo', 'target');
		const second = state.actions.connect('list', 'todo', 'target');
		expect(second.id).toBe(first.id);
		expect(state.connections).toHaveLength(1);
	});

	it('removes and restores only affected item relationships', () => {
		const state = setup();
		state.actions.connect('list', 'a', 'target-a');
		state.actions.connect('list', 'b', 'target-b');
		const removed = state.actions.removeForItems(new Set(['target-a']));
		expect(state.connections).toHaveLength(1);
		state.actions.restore(removed);
		expect(state.connections).toHaveLength(2);
	});
});
