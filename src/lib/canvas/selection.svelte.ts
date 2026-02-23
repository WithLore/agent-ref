/**
 * Selection state — tracks which items are currently selected.
 * Explicit state (not CSS-class-based like AnimRef).
 */

export function createSelection() {
	let selectedIds = $state<Set<string>>(new Set());

	function select(id: string, multi = false) {
		if (multi) {
			const next = new Set(selectedIds);
			if (next.has(id)) {
				next.delete(id);
			} else {
				next.add(id);
			}
			selectedIds = next;
		} else {
			// Skip if already the sole selection — avoids re-render that
			// disrupts browser dblclick detection between the two clicks.
			if (selectedIds.size === 1 && selectedIds.has(id)) return;
			selectedIds = new Set([id]);
		}
	}

	function clear() {
		if (selectedIds.size > 0) {
			selectedIds = new Set();
		}
	}

	function isSelected(id: string): boolean {
		return selectedIds.has(id);
	}

	function deleteSelected(): string[] {
		const ids = Array.from(selectedIds);
		selectedIds = new Set();
		return ids;
	}

	/** Replace the entire selection with the given IDs (no toggling). */
	function selectAll(ids: string[]) {
		selectedIds = new Set(ids);
	}

	return {
		get ids() {
			return selectedIds;
		},
		select,
		clear,
		isSelected,
		deleteSelected,
		selectAll
	};
}
