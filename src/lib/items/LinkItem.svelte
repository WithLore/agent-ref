<script lang="ts">
	import type { BoardItem } from './item-types.js';

	let { item }: { item: BoardItem } = $props();
	let initial = $derived((item.linkMeta?.domain || item.url).charAt(0).toUpperCase());
</script>

<article class="link-card">
	<header class="link-header">
		<div class="link-copy">
			<strong>{item.linkMeta?.title || item.linkMeta?.domain || item.url}</strong>
			<span>{item.linkMeta?.domain || item.url}</span>
		</div>
		<a
			class="open-link"
			href={item.url}
			target="_blank"
			rel="noreferrer"
			aria-label={`Open ${item.linkMeta?.title || item.url}`}
			title="Open link"
			onpointerdown={(event) => event.stopPropagation()}
		>↗</a>
	</header>
	<div class="preview">
		<div class="site-mark">
			<span>{initial}</span>
		</div>
		<div class="preview-copy">
			<strong>{item.linkMeta?.title || item.linkMeta?.domain}</strong>
			<span>{item.url}</span>
		</div>
	</div>
	<footer>Web link · Open with ↗</footer>
</article>

<style>
	.link-card {
		width: 100%;
		height: 100%;
		display: grid;
		grid-template-rows: 48px 1fr 26px;
		box-sizing: border-box;
		overflow: hidden;
		background: var(--bg-surface, #111);
		border: 1px solid var(--border-medium, #2a2a2a);
		border-radius: var(--radius-sm, 4px);
		color: var(--text-primary, #e8e8e8);
	}

	.link-header {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 7px 8px 7px 12px;
		border-bottom: 1px solid var(--border-subtle, #222);
	}

	.link-copy { min-width: 0; flex: 1; display: grid; gap: 1px; }
	.link-copy strong,
	.link-copy span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.link-copy strong { font-size: 12px; font-weight: 600; }
	.link-copy span { font-size: 10px; color: var(--text-secondary, #808080); }

	.open-link {
		display: grid;
		place-items: center;
		width: 32px;
		height: 32px;
		border-radius: 4px;
		color: #b8b8b8;
		text-decoration: none;
		font-size: 16px;
	}
	.open-link:hover,
	.open-link:focus-visible { background: rgba(255,255,255,.07); color: #fff; outline: 2px solid #fff; outline-offset: 1px; }

	.preview { display: grid; place-content: center; justify-items: center; gap: 14px; padding: 18px; overflow: hidden; background: #0a0a0a; text-align: center; }
	.site-mark { width: 52px; height: 52px; display: grid; place-items: center; border: 1px solid #383838; border-radius: 6px; background: #151515; color: #e8e8e8; font-size: 20px; font-weight: 600; }
	.preview-copy { max-width: 100%; display: grid; gap: 5px; }
	.preview-copy strong { font-size: 14px; }
	.preview-copy span { max-width: 38ch; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #808080; font-size: 10px; }
	footer { display: flex; align-items: center; padding: 0 10px; border-top: 1px solid #222; color: #707070; font-size: 9px; }
</style>
