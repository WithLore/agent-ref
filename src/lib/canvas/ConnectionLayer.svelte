<script lang="ts">
	import type { BoardConnection, BoardItem } from '$lib/items/item-types.js';
	import { getConnectionPath, getConnectionPoints, getCurveMidpoint, type Point } from '$lib/board/connection-geometry.js';

	let {
		connections,
		items,
		selectedId = null,
		draft = null,
		onSelect,
		onDelete
	}: {
		connections: BoardConnection[];
		items: BoardItem[];
		selectedId?: string | null;
		draft?: { source: Point; target: Point } | null;
		onSelect: (id: string) => void;
		onDelete: (id: string) => void;
	} = $props();

	let rendered = $derived(connections.flatMap((connection) => {
		const points = getConnectionPoints(connection, items);
		return points ? [{ connection, ...points, midpoint: getCurveMidpoint(points.source, points.target) }] : [];
	}));
</script>

<div class="connection-layer" aria-label="Board connections">
	<svg>
		{#each rendered as entry (entry.connection.id)}
			<path class:selected={selectedId === entry.connection.id} class="connection" d={getConnectionPath(entry.source, entry.target)} />
			<path
				class="connection-hit"
				d={getConnectionPath(entry.source, entry.target)}
				role="button"
				tabindex="0"
				aria-label="Select connection"
				onclick={(event) => { event.stopPropagation(); onSelect(entry.connection.id); }}
				onkeydown={(event) => {
					if (event.key === 'Enter' || event.key === ' ') {
						event.preventDefault();
						onSelect(entry.connection.id);
					}
				}}
			/>
			<circle class:selected={selectedId === entry.connection.id} class="endpoint" cx={entry.source.x} cy={entry.source.y} r="4" />
			<circle class:selected={selectedId === entry.connection.id} class="endpoint" cx={entry.target.x} cy={entry.target.y} r="4" />
		{/each}
		{#if draft}
			<path class="connection draft" d={getConnectionPath(draft.source, draft.target)} />
			<circle class="endpoint selected" cx={draft.target.x} cy={draft.target.y} r="5" />
		{/if}
	</svg>

	{#each rendered.filter((entry) => entry.connection.id === selectedId) as entry (entry.connection.id)}
		<button
			class="delete-connection"
			style:left="{entry.midpoint.x}px"
			style:top="{entry.midpoint.y}px"
			title="Remove connection"
			aria-label="Remove connection"
			onclick={(event) => { event.stopPropagation(); onDelete(entry.connection.id); }}
		>×</button>
	{/each}
</div>

<style>
	.connection-layer,
	svg {
		position: absolute;
		inset: 0;
		width: 1px;
		height: 1px;
		overflow: visible;
		pointer-events: none;
	}

	.connection {
		fill: none;
		stroke: rgba(232, 232, 232, 0.38);
		stroke-width: 1.5;
		vector-effect: non-scaling-stroke;
		transition: stroke 120ms ease;
	}

	.connection.selected,
	.connection.draft {
		stroke: #e8e8e8;
		stroke-width: 2;
	}

	.connection.draft { stroke-dasharray: 5 4; }

	.connection-hit {
		fill: none;
		stroke: transparent;
		stroke-width: 16;
		pointer-events: stroke;
		cursor: pointer;
		vector-effect: non-scaling-stroke;
	}

	.endpoint {
		fill: #0a0a0a;
		stroke: #808080;
		stroke-width: 1.5;
		vector-effect: non-scaling-stroke;
	}

	.endpoint.selected { stroke: #fff; stroke-width: 2; }

	.delete-connection {
		position: absolute;
		width: 24px;
		height: 24px;
		transform: translate(-50%, -50%);
		border: 1px solid #484848;
		border-radius: 50%;
		background: #111;
		color: #e8e8e8;
		font: inherit;
		font-size: 16px;
		line-height: 1;
		cursor: pointer;
		pointer-events: auto;
		padding: 0 0 2px;
	}

	.delete-connection::before { content: ''; position: absolute; inset: -10px; }
	.delete-connection:hover,
	.delete-connection:focus-visible { border-color: #fff; outline: none; }

	@media (prefers-reduced-motion: reduce) {
		.connection { transition: none; }
	}
</style>
