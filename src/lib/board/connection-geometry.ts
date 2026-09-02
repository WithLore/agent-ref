import type { BoardConnection, BoardItem } from '$lib/items/item-types.js';

export const TODO_HEADER_HEIGHT = 58;
export const TODO_ROW_HEIGHT = 64;
export const TODO_ADD_HEIGHT = 42;

export interface Point { x: number; y: number }

export function getTodoListHeight(itemCount: number): number {
	return TODO_HEADER_HEIGHT + Math.max(1, itemCount) * TODO_ROW_HEIGHT + TODO_ADD_HEIGHT;
}

export function getTodoSourcePoint(item: BoardItem, todoId: string): Point | null {
	const index = item.todoMeta?.items.findIndex((entry) => entry.id === todoId) ?? -1;
	if (index < 0) return null;
	return {
		x: item.x + item.width,
		y: item.y + TODO_HEADER_HEIGHT + index * TODO_ROW_HEIGHT + TODO_ROW_HEIGHT / 2
	};
}

export function getTargetAnchor(target: BoardItem, source: Point): Point {
	const center = { x: target.x + target.width / 2, y: target.y + target.height / 2 };
	const dx = source.x - center.x;
	const dy = source.y - center.y;
	if (dx === 0 && dy === 0) return center;
	const scale = 0.5 / Math.max(Math.abs(dx) / target.width, Math.abs(dy) / target.height);
	return { x: center.x + dx * scale, y: center.y + dy * scale };
}

export function getConnectionPoints(connection: BoardConnection, items: BoardItem[]) {
	const sourceItem = items.find((item) => item.id === connection.sourceItemId);
	const targetItem = items.find((item) => item.id === connection.targetItemId);
	if (!sourceItem || !targetItem) return null;
	const source = getTodoSourcePoint(sourceItem, connection.sourceTodoId);
	if (!source) return null;
	return { source, target: getTargetAnchor(targetItem, source) };
}

export function getConnectionPath(source: Point, target: Point): string {
	const direction = target.x >= source.x ? 1 : -1;
	const control = Math.max(56, Math.min(220, Math.abs(target.x - source.x) * 0.45));
	return `M ${source.x} ${source.y} C ${source.x + control * direction} ${source.y}, ${target.x - control * direction} ${target.y}, ${target.x} ${target.y}`;
}

export function getCurveMidpoint(source: Point, target: Point): Point {
	return { x: (source.x + target.x) / 2, y: (source.y + target.y) / 2 };
}
