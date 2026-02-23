<script lang="ts">
	import { onDestroy } from 'svelte';
	import type { BoardItem } from './item-types.js';
	import { extractYoutubeId } from './item-types.js';

	let {
		item,
		selected = false
	}: {
		item: BoardItem;
		selected?: boolean;
	} = $props();

	const videoId = $derived(extractYoutubeId(item.url));

	// Build embed URL — controls enabled so user can play/pause/unmute
	const embedUrl = $derived(
		videoId
			? `https://www.youtube.com/embed/${videoId}?` +
				`autoplay=1&mute=1&loop=1&playlist=${videoId}&` +
				`controls=1&modestbranding=1&rel=0&showinfo=0`
			: ''
	);

	let loaded = $state(false);
	let iframeEl = $state<HTMLIFrameElement | undefined>(undefined);

	const thumbnailUrl = $derived(
		videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : ''
	);

	function activateEmbed() {
		loaded = true;
	}

	// Clean up iframe on destroy to stop video/audio playback
	onDestroy(() => {
		if (iframeEl) {
			iframeEl.src = '';
		}
		loaded = false;
	});
</script>

<div class="youtube-container">
	{#if !loaded}
		<!-- Thumbnail preview — click to load iframe -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<div
			class="youtube-thumbnail"
			onpointerdown={(e) => e.stopPropagation()}
			onclick={activateEmbed}
		>
			{#if thumbnailUrl}
				<img src={thumbnailUrl} alt="YouTube thumbnail" draggable="false" />
			{/if}
			<div class="play-button">
				<svg viewBox="0 0 68 48" width="68" height="48">
					<path
						d="M66.52 7.74c-.78-2.93-2.49-5.41-5.42-6.19C55.79.13 34 0 34 0S12.21.13 6.9 1.55C3.97 2.33 2.27 4.81 1.48 7.74.06 13.05 0 24 0 24s.06 10.95 1.48 16.26c.78 2.93 2.49 5.41 5.42 6.19C12.21 47.87 34 48 34 48s21.79-.13 27.1-1.55c2.93-.78 4.64-3.26 5.42-6.19C67.94 34.95 68 24 68 24s-.06-10.95-1.48-16.26z"
						fill="#fff"
						fill-opacity="0.9"
					/>
					<path d="M45 24L27 14v20" fill="#000" />
				</svg>
			</div>
			<div class="youtube-label">Click to play</div>
		</div>
	{:else}
		<!-- Live iframe embed -->
		<iframe
			bind:this={iframeEl}
			src={embedUrl}
			title="YouTube video"
			frameborder="0"
			allow="autoplay; encrypted-media; fullscreen"
			allowfullscreen={false}
			style="width: 100%; height: 100%; pointer-events: {selected ? 'auto' : 'none'};"
		></iframe>
		{#if !selected}
			<div class="interact-hint">Select to interact</div>
		{/if}
	{/if}
</div>

<style>
	.youtube-container {
		width: 100%;
		height: 100%;
		position: relative;
		background: #000;
		overflow: hidden;
	}

	.youtube-thumbnail {
		width: 100%;
		height: 100%;
		position: relative;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.youtube-thumbnail img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.play-button {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		opacity: 0.85;
		transition: opacity 0.15s, transform 0.15s;
	}

	.youtube-thumbnail:hover .play-button {
		opacity: 1;
		transform: translate(-50%, -50%) scale(1.08);
	}

	.youtube-label {
		position: absolute;
		bottom: 8px;
		right: 10px;
		font-size: 11px;
		color: rgba(255, 255, 255, 0.7);
		background: rgba(0, 0, 0, 0.6);
		padding: 2px 8px;
		border-radius: 3px;
	}

	.interact-hint {
		position: absolute;
		bottom: 6px;
		left: 50%;
		transform: translateX(-50%);
		font-size: 10px;
		color: rgba(255, 255, 255, 0.5);
		background: rgba(0, 0, 0, 0.6);
		padding: 2px 8px;
		border-radius: 3px;
		pointer-events: none;
	}

	iframe {
		border: none;
	}
</style>
