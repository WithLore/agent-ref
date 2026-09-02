import { describe, expect, it } from 'vitest';
import { createItem, createProject, createTodoEntry } from '$lib/items/item-types.js';
import { deserializeProject, serializeProject } from './serialization.js';

describe('project serialization v2', () => {
	it('round-trips permanent todo and connection timestamps', () => {
		const project = createProject('Timestamped');
		const todo = createTodoEntry('Review cut');
		const list = createItem({ type: 'todo', url: '', todoMeta: { title: 'Launch', items: [todo] } });
		const target = createItem({ type: 'image', url: 'https://example.com/frame.jpg' });
		project.boards[0].items = [list, target];
		project.boards[0].connections = [{
			id: 'connection', sourceItemId: list.id, sourceTodoId: todo.id,
			targetItemId: target.id, createdAt: '2026-09-02T15:00:00.000Z'
		}];

		const restored = deserializeProject(serializeProject(project).json);
		expect(restored.boards[0].items[0].createdAt).toBe(list.createdAt);
		expect(restored.boards[0].items[0].todoMeta?.items[0].createdAt).toBe(todo.createdAt);
		expect(restored.boards[0].connections[0].createdAt).toBe('2026-09-02T15:00:00.000Z');
	});

	it('migrates v1 items to permanent timestamps', () => {
		const project = createProject('Legacy');
		const item = createItem({ type: 'image', url: 'legacy.jpg' });
		project.version = 1;
		project.boards[0].items = [item];
		delete (project.boards[0] as Partial<typeof project.boards[0]>).connections;
		delete (item as Partial<typeof item>).createdAt;
		delete (item as Partial<typeof item>).updatedAt;

		const restored = deserializeProject(JSON.stringify(project));
		expect(restored.version).toBe(2);
		expect(restored.boards[0].connections).toEqual([]);
		expect(restored.boards[0].items[0].createdAt).toBe(restored.boards[0].createdAt);
	});
});
