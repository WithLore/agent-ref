<script lang="ts">
	import type { BoardItem, VideoMeta } from './item-types.js';
	import { icons } from '$lib/ui/icons.js';

	let {
		item,
		selected = false,
		onLoad,
		onUpdateMeta
	}: {
		item: BoardItem;
		selected?: boolean;
		onLoad?: (width: number, height: number) => void;
		onUpdateMeta?: (id: string, meta: Partial<VideoMeta>) => void;
	} = $props();

	let videoEl: HTMLVideoElement;
	let showControls = $state(false);
	let editingLoop = $state(false);
	let currentTime = $state(0);
	let duration = $state(0);

	const loopStart = $derived(item.videoMeta?.loopStart ?? 0);
	const loopEnd = $derived(item.videoMeta?.loopEnd ?? 100);

	function handleLoadedMetadata(e: Event) {
		const video = e.target as HTMLVideoElement;
		duration = video.duration;
		if (video.videoWidth && video.videoHeight && onLoad) {
			onLoad(video.videoWidth, video.videoHeight);
		}
	}

	function handleTimeUpdate(e: Event) {
		const video = e.target as HTMLVideoElement;
		if (!video.duration) return;
		currentTime = video.currentTime;

		// Enforce loop region
		const startTime = (loopStart / 100) * video.duration;
		const endTime = (loopEnd / 100) * video.duration;

		if (video.currentTime < startTime) {
			video.currentTime = startTime;
		} else if (video.currentTime >= endTime) {
			video.currentTime = startTime;
		}
	}

	function toggleLoop(e: MouseEvent) {
		e.stopPropagation();
		e.preventDefault();
		editingLoop = !editingLoop;
	}

	function handleLoopStartChange(e: Event) {
		const val = parseFloat((e.target as HTMLInputElement).value);
		onUpdateMeta?.(item.id, { loopStart: Math.min(val, loopEnd - 1) });
	}

	function handleLoopEndChange(e: Event) {
		const val = parseFloat((e.target as HTMLInputElement).value);
		onUpdateMeta?.(item.id, { loopEnd: Math.max(val, loopStart + 1) });
	}

	function formatTime(seconds: number): string {
		const m = Math.floor(seconds / 60);
		const s = Math.floor(seconds % 60);
		return `${m}:${s.toString().padStart(2, '0')}`;
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="video-container"
	onmouseenter={() => (showControls = true)}
	onmouseleave={() => {
		if (!editingLoop) showControls = false;
	}}
>
	<!-- svelte-ignore a11y_media_has_caption -->
	<video
		bind:this={videoEl}
		src={item.url}
		autoplay
		loop
		muted={item.videoMeta?.muted ?? true}
		playsinline
		onloadedmetadata={handleLoadedMetadata}
		ontimeupdate={handleTimeUpdate}
		style="width: 100%; height: 100%; object-fit: contain; pointer-events: none;"
	></video>

	{#if selected && showControls}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="video-overlay" onpointerdown={(e) => e.stopPropagation()}>
			<div class="video-bar">
				<!-- Progress indicator -->
				<div class="progress-track">
					{#if duration > 0}
						<div
							class="progress-loop-region"
							style:left="{loopStart}%"
							style:width="{loopEnd - loopStart}%"
						></div>
						<div
							class="progress-current"
							style:left="{(currentTime / duration) * 100}%"
						></div>
					{/if}
				</div>

				<div class="video-controls">
					<span class="time-display">
						{formatTime(currentTime)} / {formatTime(duration)}
					</span>
					<button class="loop-btn" class:active={editingLoop} onclick={toggleLoop}>
						{@html icons.loop}
					</button>
				</div>
			</div>

			{#if editingLoop}
				<div class="loop-editor">
					<label>
						Start: {loopStart.toFixed(0)}%
						<input
							type="range"
							min="0"
							max="100"
							step="0.5"
							value={loopStart}
							oninput={handleLoopStartChange}
						/>
					</label>
					<label>
						End: {loopEnd.toFixed(0)}%
						<input
							type="range"
							min="0"
							max="100"
							step="0.5"
							value={loopEnd}
							oninput={handleLoopEndChange}
						/>
					</label>
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	.video-container {
		width: 100%;
		height: 100%;
		position: relative;
	}

	.video-overlay {
		position: absolute;
		bottom: 0;
		left: 0;
		right: 0;
		background: linear-gradient(transparent, rgba(0, 0, 0, 0.8));
		padding: 4px 6px;
		pointer-events: auto;
	}

	.video-bar {
		display: flex;
		flex-direction: column;
		gap: 3px;
	}

	.progress-track {
		position: relative;
		height: 4px;
		background: rgba(255, 255, 255, 0.2);
		border-radius: 2px;
		overflow: hidden;
	}

	.progress-loop-region {
		position: absolute;
		top: 0;
		height: 100%;
		background: rgba(255, 255, 255, 0.2);
	}

	.progress-current {
		position: absolute;
		top: -1px;
		width: 3px;
		height: 6px;
		background: #fff;
		border-radius: 1px;
		transform: translateX(-50%);
	}

	.video-controls {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 6px;
	}

	.time-display {
		font-size: 10px;
		color: #ccc;
		font-family: monospace;
	}

	.loop-btn {
		background: none;
		border: 1px solid rgba(255, 255, 255, 0.3);
		border-radius: 3px;
		color: #ccc;
		font-size: 11px;
		cursor: pointer;
		padding: 1px 4px;
		line-height: 1;
	}

	.loop-btn.active {
		border-color: #fff;
		color: #fff;
		background: rgba(255, 255, 255, 0.1);
	}

	.loop-editor {
		display: flex;
		flex-direction: column;
		gap: 4px;
		margin-top: 4px;
		padding-top: 4px;
		border-top: 1px solid rgba(255, 255, 255, 0.1);
	}

	.loop-editor label {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 10px;
		color: #aaa;
		white-space: nowrap;
	}

	.loop-editor input[type='range'] {
		flex: 1;
		height: 3px;
		accent-color: #fff;
	}
</style>
