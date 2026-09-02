import { describe, expect, it, vi } from 'vitest';
import { createProjectStore } from './project-store.svelte.js';

describe('project store change notifications', () => {
	it('notifies the autosave hook after board content changes', () => {
		const store = createProjectStore();
		const onChange = vi.fn();
		store.setChangeHandler(onChange);

		store.boardStore.update((items) => items);

		expect(onChange).toHaveBeenCalledTimes(1);
		expect(onChange).toHaveBeenLastCalledWith(store.project);
	});

	it('does not notify before autosave is attached', () => {
		const store = createProjectStore();
		store.renameProject('Before recovery');
		const onChange = vi.fn();
		store.setChangeHandler(onChange);

		expect(onChange).not.toHaveBeenCalled();
	});
});
