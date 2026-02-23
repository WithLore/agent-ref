<script lang="ts">
	import type { PeerInfo, CollabStatus } from '$lib/board/yjs-sync.svelte.js';
	import { isValidRoomCode } from '$lib/board/room-code.js';

	let {
		status,
		peers = [],
		onDisconnect,
		onCreate,
		onJoin
	}: {
		status: CollabStatus | null;
		peers?: PeerInfo[];
		onDisconnect?: () => void;
		onCreate?: () => string; // returns room code
		onJoin?: (code: string) => void;
	} = $props();

	let expanded = $state(false);
	let mode = $state<'menu' | 'join'>('menu');
	let joinCode = $state('');
	let joinError = $state('');
	let roomCode = $state<string | null>(null);
	let copied = $state(false);

	function toggleExpand() {
		expanded = !expanded;
		if (!expanded) {
			mode = 'menu';
			joinCode = '';
			joinError = '';
		}
	}

	function handleCreate() {
		const code = onCreate?.() ?? '';
		roomCode = code;
	}

	function handleJoin() {
		const code = joinCode.toUpperCase().trim();
		if (!isValidRoomCode(code)) {
			joinError = 'Format: WORD-WORD-##-XXXXXX';
			return;
		}
		joinError = '';
		onJoin?.(code);
		mode = 'menu';
		joinCode = '';
	}

	function handleJoinKeyDown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			handleJoin();
		}
		if (e.key === 'Escape') {
			mode = 'menu';
			joinCode = '';
			joinError = '';
		}
	}

	async function copyCode() {
		if (!roomCode) return;
		try {
			await navigator.clipboard.writeText(roomCode);
			copied = true;
			setTimeout(() => { copied = false; }, 1500);
		} catch {
			// Fallback: select text
		}
	}

	function handleDisconnect() {
		onDisconnect?.();
		roomCode = null;
		expanded = false;
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="connection-indicator" class:connected={status?.connected}>
	<button class="indicator-btn" onclick={toggleExpand} title={status ? `Room: ${status.roomId}` : 'Not connected'}>
		<span class="dot" class:online={status?.connected}></span>
		{#if status}
			<span class="peer-count">{status.peerCount}</span>
		{:else}
			<span class="label">Solo</span>
		{/if}
	</button>

	{#if expanded}
		<div class="indicator-panel">
			{#if status}
				<!-- Connected state -->
				{#if roomCode}
					<div class="room-code-display">
						<span class="room-code-label">Room Code</span>
						<button class="room-code-value" onclick={copyCode} title="Click to copy">
							{roomCode}
							<span class="copy-hint">{copied ? '✓' : '📋'}</span>
						</button>
						<span class="room-code-tip">Share this code with others</span>
					</div>
				{/if}

				<div class="panel-status">
					<span class="dot" class:online={status.connected}></span>
					<span>{status.connected ? 'Connected' : 'Connecting…'}</span>
					<span class="peer-badge">{status.peerCount} peer{status.peerCount !== 1 ? 's' : ''}</span>
				</div>

				{#if peers.length > 0}
					<div class="peers-list">
						{#each peers as peer}
							<div class="peer-item">
								<span class="peer-dot" style:background={peer.user.color}></span>
								<span class="peer-name">{peer.user.name}</span>
							</div>
						{/each}
					</div>
				{:else}
					<div class="no-peers">Waiting for others to join…</div>
				{/if}

				<button class="panel-btn danger" onclick={handleDisconnect}>
					Disconnect
				</button>
			{:else}
				<!-- Disconnected state -->
				{#if mode === 'menu'}
					<div class="panel-header">
						<span>Collaborate</span>
					</div>
					<div class="panel-actions">
						<button class="panel-btn primary" onclick={handleCreate}>
							Create Room
						</button>
						<button class="panel-btn" onclick={() => { mode = 'join'; }}>
							Join Room
						</button>
					</div>
				{:else if mode === 'join'}
					<div class="panel-header">
						<span>Enter Room Code</span>
					</div>
					<div class="join-form">
						<!-- svelte-ignore a11y_autofocus -->
						<input
							type="text"
							class="join-input"
							placeholder="BLUE-HAWK-42-A1B2C3"
							bind:value={joinCode}
							onkeydown={handleJoinKeyDown}
							autofocus
							maxlength="22"
						/>
						{#if joinError}
							<span class="join-error">{joinError}</span>
						{/if}
						<div class="join-buttons">
							<button class="panel-btn" onclick={() => { mode = 'menu'; joinCode = ''; joinError = ''; }}>
								Back
							</button>
							<button class="panel-btn primary" onclick={handleJoin}>
								Join
							</button>
						</div>
					</div>
				{/if}
			{/if}
		</div>
	{/if}
</div>

<style>
	.connection-indicator {
		position: fixed;
		bottom: 16px;
		right: 80px;
		z-index: 8000;
	}

	.indicator-btn {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 6px 12px;
		background: rgba(30, 41, 59, 0.8);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 6px;
		color: #aaa;
		font-size: 12px;
		font-family: inherit;
		cursor: pointer;
		transition: background 120ms ease, border-color 120ms ease;
	}

	.indicator-btn:hover {
		background: rgba(30, 41, 59, 1);
		border-color: rgba(255, 255, 255, 0.2);
	}

	.dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: #555;
		flex-shrink: 0;
	}

	.dot.online {
		background: #22c55e;
		box-shadow: 0 0 6px rgba(34, 197, 94, 0.5);
	}

	.peer-count {
		font-variant-numeric: tabular-nums;
	}

	.label {
		opacity: 0.6;
	}

	.indicator-panel {
		position: absolute;
		bottom: calc(100% + 8px);
		right: 0;
		min-width: 200px;
		background: var(--bg-menu, #1e293b);
		border: 1px solid var(--border-medium, rgba(255, 255, 255, 0.12));
		border-radius: 8px;
		box-shadow: 0 4px 24px rgba(0, 0, 0, 0.5);
		padding: 10px;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.panel-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		font-size: 12px;
		font-weight: 600;
		color: #ccc;
		padding: 2px 2px;
	}

	.panel-status {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 12px;
		color: #ccc;
		padding: 2px 2px;
	}

	.peer-badge {
		margin-left: auto;
		font-size: 10px;
		color: #888;
		background: rgba(255, 255, 255, 0.06);
		padding: 1px 6px;
		border-radius: 8px;
	}

	.peers-list {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 4px 0;
	}

	.peer-item {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 12px;
		color: #ddd;
		padding: 2px 2px;
	}

	.peer-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.peer-name {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.no-peers {
		font-size: 11px;
		color: #666;
		padding: 4px 2px;
	}

	.panel-actions {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.panel-btn {
		background: rgba(255, 255, 255, 0.06);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 6px;
		color: #ccc;
		font-size: 12px;
		font-family: inherit;
		padding: 7px 12px;
		cursor: pointer;
		transition: background 120ms ease;
		text-align: center;
	}

	.panel-btn:hover {
		background: rgba(255, 255, 255, 0.1);
	}

	.panel-btn.primary {
		background: rgba(59, 130, 246, 0.2);
		border-color: rgba(59, 130, 246, 0.3);
		color: #93c5fd;
	}

	.panel-btn.primary:hover {
		background: rgba(59, 130, 246, 0.3);
	}

	.panel-btn.danger {
		color: #ff4757;
		border-color: rgba(255, 71, 87, 0.2);
	}

	.panel-btn.danger:hover {
		background: rgba(255, 71, 87, 0.1);
	}

	/* Room code display */
	.room-code-display {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		padding: 6px 0;
	}

	.room-code-label {
		font-size: 10px;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: #888;
		font-weight: 600;
	}

	.room-code-value {
		font-family: 'Consolas', 'Monaco', monospace;
		font-size: 16px;
		font-weight: 700;
		letter-spacing: 0.05em;
		color: #93c5fd;
		background: rgba(59, 130, 246, 0.1);
		border: 1px solid rgba(59, 130, 246, 0.2);
		border-radius: 6px;
		padding: 6px 14px;
		cursor: pointer;
		transition: background 120ms ease;
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.room-code-value:hover {
		background: rgba(59, 130, 246, 0.2);
	}

	.copy-hint {
		font-size: 12px;
		opacity: 0.7;
	}

	.room-code-tip {
		font-size: 10px;
		color: #666;
	}

	/* Join form */
	.join-form {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.join-input {
		background: rgba(0, 0, 0, 0.3);
		border: 1px solid rgba(255, 255, 255, 0.15);
		border-radius: 6px;
		color: #fff;
		font-family: 'Consolas', 'Monaco', monospace;
		font-size: 14px;
		font-weight: 600;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		text-align: center;
		padding: 8px 12px;
		outline: none;
		transition: border-color 120ms ease;
	}

	.join-input::placeholder {
		color: #555;
		font-weight: 400;
	}

	.join-input:focus {
		border-color: rgba(59, 130, 246, 0.5);
	}

	.join-error {
		font-size: 10px;
		color: #ef4444;
		text-align: center;
	}

	.join-buttons {
		display: flex;
		gap: 6px;
	}

	.join-buttons .panel-btn {
		flex: 1;
	}
</style>
