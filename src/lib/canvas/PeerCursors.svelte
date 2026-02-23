<script lang="ts">
	import type { PeerInfo } from '$lib/board/yjs-sync.svelte.js';

	let {
		peers,
		viewportX,
		viewportY,
		viewportScale
	}: {
		peers: PeerInfo[];
		viewportX: number;
		viewportY: number;
		viewportScale: number;
	} = $props();

	// Only show peers who are on the same board and have a cursor position
	let visiblePeers = $derived(
		peers.filter((p) => p.cursor)
	);
</script>

{#each visiblePeers as peer (peer.clientId)}
	{@const screenX = (peer.cursor?.x ?? 0) * viewportScale + viewportX}
	{@const screenY = (peer.cursor?.y ?? 0) * viewportScale + viewportY}
	<div
		class="peer-cursor"
		style:left="{screenX}px"
		style:top="{screenY}px"
		style:--peer-color={peer.user.color}
	>
		<!-- Cursor arrow SVG -->
		<svg width="16" height="20" viewBox="0 0 16 20" fill="none">
			<path
				d="M1 1L7 18L9.5 10.5L15 8L1 1Z"
				fill={peer.user.color}
				stroke="rgba(0,0,0,0.4)"
				stroke-width="1"
			/>
		</svg>
		<span class="peer-label" style:background={peer.user.color}>
			{peer.user.name}
		</span>
	</div>
{/each}

<style>
	.peer-cursor {
		position: fixed;
		pointer-events: none;
		z-index: 9500;
		transition: left 80ms ease-out, top 80ms ease-out;
	}

	.peer-label {
		position: absolute;
		top: 16px;
		left: 12px;
		padding: 1px 6px;
		border-radius: 3px;
		font-size: 10px;
		color: #fff;
		white-space: nowrap;
		font-weight: 500;
		box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
	}
</style>
