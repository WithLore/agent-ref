import { describe, expect, it } from 'vitest';
import { createItem, createProject, createTodoEntry } from '$lib/items/item-types.js';
import { selectNewestRecovery } from './file-io.js';

function recoveryJson(name: string, modifiedAt: string): string {
	const project = createProject(name);
	project.modifiedAt = modifiedAt;
	return JSON.stringify(project);
}

describe('automatic project recovery', () => {
	it('restores the newest valid recovery copy', () => {
		const older = recoveryJson('Older', '2026-09-02T12:00:00.000Z');
		const newer = recoveryJson('Newer', '2026-09-02T12:00:01.000Z');

		expect(selectNewestRecovery([older, newer])?.name).toBe('Newer');
		expect(selectNewestRecovery([newer, older])?.name).toBe('Newer');
	});

	it('ignores a corrupted copy and preserves timestamped to-do data', () => {
		const project = createProject('Recovered');
		const todo = createTodoEntry('This should survive a restart');
		const list = createItem({
			type: 'todo',
			url: '',
			todoMeta: { title: 'Recovery list', items: [todo] }
		});
		project.boards[0].items = [list];

		const restored = selectNewestRecovery(['not valid JSON', JSON.stringify(project)]);
		expect(restored?.boards[0].items[0].todoMeta?.items[0]).toEqual(todo);
	});
});
