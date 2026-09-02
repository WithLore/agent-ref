<script lang="ts">
	import { tick } from 'svelte';
	import { icons } from './icons.js';

	let { onAddTodo, onAddLink }: { onAddTodo: () => void; onAddLink: (url: string) => void } = $props();
	let addingLink = $state(false);
	let url = $state('');
	let error = $state('');
	let urlInput = $state<HTMLInputElement>();

	async function openLinkInput() {
		addingLink = true;
		error = '';
		await tick();
		urlInput?.focus();
	}

	function submitLink() {
		let next = url.trim();
		if (!next) { error = 'Paste a link'; return; }
		if (!/^https?:\/\//i.test(next)) next = `https://${next}`;
		try { new URL(next); } catch { error = 'Enter a valid link'; return; }
		onAddLink(next);
		url = '';
		error = '';
		addingLink = false;
	}
</script>

<div class="quick-add" aria-label="Add to board">
	<button onclick={onAddTodo} title="Add to-do list">
		<span class="icon">{@html icons.todo}</span><span>To-do</span>
	</button>
	{#if addingLink}
		<form onsubmit={(event) => { event.preventDefault(); submitLink(); }}>
			<label class="sr-only" for="quick-link-url">Link URL</label>
			<input
				id="quick-link-url"
				bind:this={urlInput}
				bind:value={url}
				placeholder="Paste a link"
				aria-invalid={Boolean(error)}
				title={error}
				onkeydown={(event) => { if (event.key === 'Escape') addingLink = false; }}
			/>
			<button class="submit" type="submit" aria-label="Add link">Add</button>
		</form>
	{:else}
		<button onclick={openLinkInput} title="Add link">
			<span class="icon">{@html icons.link}</span><span>Link</span>
		</button>
	{/if}
</div>

<style>
	.quick-add {
		position: fixed;
		top: 14px;
		left: 50%;
		transform: translateX(-50%);
		display: flex;
		align-items: center;
		gap: 2px;
		padding: 3px;
		background: var(--bg-menu, #161616);
		border: 1px solid var(--border-medium, #2a2a2a);
		border-radius: var(--radius-md, 6px);
		box-shadow: 0 4px 18px rgba(0,0,0,.35);
		z-index: 8000;
	}

	button,
	form { height: 32px; }
	button {
		display: flex;
		align-items: center;
		gap: 7px;
		padding: 0 10px;
		border: 0;
		border-radius: 4px;
		background: transparent;
		color: var(--text-secondary, #a0a0a0);
		font: inherit;
		font-size: 12px;
		cursor: pointer;
	}
	button:hover,
	button:focus-visible { background: rgba(255,255,255,.07); color: #fff; outline: 2px solid #fff; outline-offset: 1px; }
	.icon { display: flex; }
	form { display: flex; align-items: center; gap: 2px; }
	input {
		width: 210px;
		height: 28px;
		box-sizing: border-box;
		border: 1px solid #484848;
		border-radius: 4px;
		background: #0d0d0d;
		color: #e8e8e8;
		font: inherit;
		font-size: 12px;
		padding: 0 9px;
		outline: none;
	}
	input:focus { border-color: #e8e8e8; }
	input[aria-invalid="true"] { border-color: var(--danger, #ff4757); }
	.submit { color: #e8e8e8; }
	.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
	@media (max-width: 560px) { .quick-add { left: auto; right: 12px; transform: none; } input { width: 150px; } }
</style>
