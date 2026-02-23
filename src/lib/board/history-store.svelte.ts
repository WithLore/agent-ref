/**
 * Undo/redo history — command-pattern stack.
 *
 * Each discrete user action (move, resize, add, delete, etc.) is captured
 * as a Command with undo/redo closures. Continuous operations (drag, resize)
 * are coalesced between start/end events into a single command.
 */

export interface Command {
	label: string;
	undo: () => void;
	redo: () => void;
}

const MAX_HISTORY = 50;

export function createHistoryStore() {
	let undoStack = $state<Command[]>([]);
	let redoStack = $state<Command[]>([]);

	/**
	 * Execute a command and push it onto the undo stack.
	 * Clears redo stack (new action branches history).
	 */
	function execute(cmd: Command) {
		cmd.redo();
		undoStack = [...undoStack.slice(-(MAX_HISTORY - 1)), cmd];
		redoStack = [];
	}

	/**
	 * Push a command that has ALREADY been executed (for coalesced ops
	 * where the action happened incrementally during drag/resize).
	 */
	function push(cmd: Command) {
		undoStack = [...undoStack.slice(-(MAX_HISTORY - 1)), cmd];
		redoStack = [];
	}

	function undo() {
		if (undoStack.length === 0) return;
		const cmd = undoStack[undoStack.length - 1];
		undoStack = undoStack.slice(0, -1);
		cmd.undo();
		redoStack = [...redoStack, cmd];
	}

	function redo() {
		if (redoStack.length === 0) return;
		const cmd = redoStack[redoStack.length - 1];
		redoStack = redoStack.slice(0, -1);
		cmd.redo();
		undoStack = [...undoStack, cmd];
	}

	function clear() {
		undoStack = [];
		redoStack = [];
	}

	return {
		get canUndo() { return undoStack.length > 0; },
		get canRedo() { return redoStack.length > 0; },
		get undoLabel() { return undoStack.at(-1)?.label ?? ''; },
		get redoLabel() { return redoStack.at(-1)?.label ?? ''; },
		execute,
		push,
		undo,
		redo,
		clear
	};
}
