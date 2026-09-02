import type { BoardConnection } from '$lib/items/item-types.js';

export interface ConnectionStore {
	readonly connections: BoardConnection[];
	updateConnections(fn: (connections: BoardConnection[]) => BoardConnection[]): void;
}

export function createConnectionActions(store: ConnectionStore) {
	function connect(sourceItemId: string, sourceTodoId: string, targetItemId: string): BoardConnection {
		const existing = store.connections.find((connection) =>
			connection.sourceItemId === sourceItemId &&
			connection.sourceTodoId === sourceTodoId &&
			connection.targetItemId === targetItemId
		);
		if (existing) return existing;

		const connection: BoardConnection = {
			id: crypto.randomUUID(),
			sourceItemId,
			sourceTodoId,
			targetItemId,
			createdAt: new Date().toISOString()
		};
		store.updateConnections((connections) => [...connections, connection]);
		return connection;
	}

	function remove(ids: Set<string>): BoardConnection[] {
		const removed = store.connections.filter((connection) => ids.has(connection.id));
		if (removed.length > 0) {
			store.updateConnections((connections) => connections.filter((connection) => !ids.has(connection.id)));
		}
		return removed;
	}

	function removeForItems(itemIds: Set<string>): BoardConnection[] {
		const ids = new Set(store.connections
			.filter((connection) => itemIds.has(connection.sourceItemId) || itemIds.has(connection.targetItemId))
			.map((connection) => connection.id));
		return remove(ids);
	}

	function removeForTodo(sourceItemId: string, sourceTodoId: string): BoardConnection[] {
		const ids = new Set(store.connections
			.filter((connection) => connection.sourceItemId === sourceItemId && connection.sourceTodoId === sourceTodoId)
			.map((connection) => connection.id));
		return remove(ids);
	}

	function restore(connections: BoardConnection[]) {
		const existing = new Set(store.connections.map((connection) => connection.id));
		store.updateConnections((current) => [
			...current,
			...connections.filter((connection) => !existing.has(connection.id)).map((connection) => ({ ...connection }))
		]);
	}

	return { connect, remove, removeForItems, removeForTodo, restore };
}
