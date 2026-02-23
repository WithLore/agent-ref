import { describe, it, expect } from 'vitest';
import {
	createItem,
	createBoard,
	createProject,
	createGroup,
	extractYoutubeId,
	isYoutubeUrl,
	isVideoUrl,
	isImageUrl
} from './item-types.js';

describe('createItem', () => {
	it('creates an image item with defaults', () => {
		const item = createItem({ type: 'image', url: 'photo.png' });
		expect(item.type).toBe('image');
		expect(item.url).toBe('photo.png');
		expect(item.x).toBe(0);
		expect(item.y).toBe(0);
		expect(item.width).toBe(300);
		expect(item.height).toBe(200);
		expect(item.rotation).toBe(0);
		expect(item.tags).toEqual([]);
		expect(item.rating).toBe(0);
		expect(item.id).toBeTruthy();
	});

	it('generates unique IDs', () => {
		const ids = new Set(Array.from({ length: 50 }, () => createItem({ type: 'text', url: '' }).id));
		expect(ids.size).toBe(50);
	});

	it('applies overrides', () => {
		const item = createItem({ type: 'image', url: 'test.png', x: 10, y: 20, width: 50, height: 50, rotation: 45 });
		expect(item.x).toBe(10);
		expect(item.y).toBe(20);
		expect(item.width).toBe(50);
		expect(item.rotation).toBe(45);
	});

	it('sets default videoMeta for video type', () => {
		const item = createItem({ type: 'video', url: 'clip.mp4' });
		expect(item.videoMeta).toEqual({ loopStart: 0, loopEnd: 100, muted: true });
	});

	it('sets default videoMeta for youtube type', () => {
		const item = createItem({ type: 'youtube', url: 'abc123' });
		expect(item.videoMeta).toEqual({ loopStart: 0, loopEnd: 100, muted: true });
	});

	it('does not set videoMeta for image type', () => {
		const item = createItem({ type: 'image', url: 'photo.png' });
		expect(item.videoMeta).toBeUndefined();
	});

	it('does not set videoMeta for text type', () => {
		const item = createItem({ type: 'text', url: 'hello' });
		expect(item.videoMeta).toBeUndefined();
	});

	it('preserves custom videoMeta for video type', () => {
		const item = createItem({
			type: 'video',
			url: 'clip.mp4',
			videoMeta: { loopStart: 25, loopEnd: 75, muted: false }
		});
		expect(item.videoMeta).toEqual({ loopStart: 25, loopEnd: 75, muted: false });
	});
});

describe('createBoard', () => {
	it('creates a board with default name', () => {
		const board = createBoard();
		expect(board.name).toBe('Board 1');
		expect(board.items).toEqual([]);
		expect(board.groups).toEqual([]);
		expect(board.viewport).toEqual({ x: 0, y: 0, scale: 1 });
		expect(board.id).toBeTruthy();
		expect(board.createdAt).toBeTruthy();
		expect(board.modifiedAt).toBeTruthy();
	});

	it('accepts custom name', () => {
		const board = createBoard('Character Refs');
		expect(board.name).toBe('Character Refs');
	});
});

describe('createProject', () => {
	it('creates a project with one default board', () => {
		const project = createProject();
		expect(project.name).toBe('Untitled Project');
		expect(project.version).toBe(1);
		expect(project.boards).toHaveLength(1);
		expect(project.boards[0].name).toBe('Board 1');
		expect(project.activeBoardId).toBe(project.boards[0].id);
	});

	it('accepts custom name', () => {
		const project = createProject('My References');
		expect(project.name).toBe('My References');
	});
});

describe('createGroup', () => {
	it('creates a group with required position/size', () => {
		const group = createGroup({ x: 10, y: 20, width: 300, height: 200 });
		expect(group.x).toBe(10);
		expect(group.y).toBe(20);
		expect(group.width).toBe(300);
		expect(group.height).toBe(200);
		expect(group.label).toBe('Group');
		expect(group.color).toBe('#808080');
		expect(group.locked).toBe(false);
		expect(group.id).toBeTruthy();
	});

	it('applies overrides', () => {
		const group = createGroup({ x: 0, y: 0, width: 100, height: 100, label: 'Characters', color: '#ff0000', locked: true });
		expect(group.label).toBe('Characters');
		expect(group.color).toBe('#ff0000');
		expect(group.locked).toBe(true);
	});
});

describe('extractYoutubeId', () => {
	it('extracts from youtube.com/watch URL', () => {
		expect(extractYoutubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
	});

	it('extracts from youtu.be short URL', () => {
		expect(extractYoutubeId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
	});

	it('extracts from embed URL', () => {
		expect(extractYoutubeId('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
	});

	it('extracts from bare 11-char ID', () => {
		expect(extractYoutubeId('dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
	});

	it('handles extra query params', () => {
		expect(extractYoutubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10s')).toBe('dQw4w9WgXcQ');
	});

	it('returns null for non-YouTube URLs', () => {
		expect(extractYoutubeId('https://vimeo.com/12345')).toBeNull();
		expect(extractYoutubeId('not a url')).toBeNull();
		expect(extractYoutubeId('')).toBeNull();
	});
});

describe('isYoutubeUrl', () => {
	it('detects youtube.com URLs', () => {
		expect(isYoutubeUrl('https://www.youtube.com/watch?v=abc')).toBe(true);
	});

	it('detects youtu.be URLs', () => {
		expect(isYoutubeUrl('https://youtu.be/abc')).toBe(true);
	});

	it('is case insensitive', () => {
		expect(isYoutubeUrl('https://YOUTUBE.COM/watch?v=abc')).toBe(true);
	});

	it('rejects non-YouTube URLs', () => {
		expect(isYoutubeUrl('https://vimeo.com/12345')).toBe(false);
	});
});

describe('isVideoUrl', () => {
	it('detects common video extensions', () => {
		expect(isVideoUrl('clip.mp4')).toBe(true);
		expect(isVideoUrl('clip.webm')).toBe(true);
		expect(isVideoUrl('clip.mov')).toBe(true);
		expect(isVideoUrl('clip.avi')).toBe(true);
		expect(isVideoUrl('clip.mkv')).toBe(true);
		expect(isVideoUrl('clip.ogg')).toBe(true);
	});

	it('handles URLs with query params', () => {
		expect(isVideoUrl('https://example.com/clip.mp4?token=abc')).toBe(true);
	});

	it('rejects non-video files', () => {
		expect(isVideoUrl('photo.png')).toBe(false);
		expect(isVideoUrl('doc.pdf')).toBe(false);
	});
});

describe('isImageUrl', () => {
	it('detects common image extensions', () => {
		expect(isImageUrl('photo.jpg')).toBe(true);
		expect(isImageUrl('photo.jpeg')).toBe(true);
		expect(isImageUrl('photo.png')).toBe(true);
		expect(isImageUrl('photo.gif')).toBe(true);
		expect(isImageUrl('photo.webp')).toBe(true);
		expect(isImageUrl('photo.svg')).toBe(true);
		expect(isImageUrl('photo.bmp')).toBe(true);
		expect(isImageUrl('photo.avif')).toBe(true);
	});

	it('handles URLs with query params', () => {
		expect(isImageUrl('https://cdn.example.com/photo.png?w=800')).toBe(true);
	});

	it('is case insensitive', () => {
		expect(isImageUrl('PHOTO.PNG')).toBe(true);
		expect(isImageUrl('Photo.JPG')).toBe(true);
	});

	it('rejects non-image files', () => {
		expect(isImageUrl('clip.mp4')).toBe(false);
		expect(isImageUrl('doc.pdf')).toBe(false);
	});
});
