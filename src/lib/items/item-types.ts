export type ItemType = 'image' | 'video' | 'youtube' | 'text';

export interface VideoMeta {
	loopStart: number; // percentage 0-100
	loopEnd: number; // percentage 0-100
	muted: boolean;
}

export interface BoardItem {
	id: string;
	type: ItemType;
	url: string; // src URL, data URL, blob URL, or text content (for type='text')
	x: number;
	y: number;
	width: number;
	height: number;
	zIndex: number;
	rotation: number;
	tags: string[];
	rating: number; // 0=unrated, 1=trash, 2=keep, 3=star
	videoMeta?: VideoMeta;
	groupId?: string; // references GroupData.id if this item belongs to a group
}

// --- Groups ---

export interface GroupData {
	id: string;
	label: string;
	color: string; // border/header color
	x: number;
	y: number;
	width: number;
	height: number;
	zIndex: number;
	locked: boolean; // if true, children can't be dragged out
}

export function createGroup(
	overrides: Partial<GroupData> & Pick<GroupData, 'x' | 'y' | 'width' | 'height'>
): GroupData {
	return {
		id: crypto.randomUUID(),
		label: 'Group',
		color: '#808080',
		zIndex: 0,
		locked: false,
		...overrides
	};
}

// --- Board data (what gets serialized per board) ---

export interface BoardData {
	id: string;
	name: string;
	items: BoardItem[];
	groups: GroupData[];
	viewport: { x: number; y: number; scale: number };
	createdAt: string;
	modifiedAt: string;
}

// --- Project (top-level save structure) ---

export interface ProjectData {
	id: string;
	name: string;
	version: number; // schema version for future migrations
	createdAt: string;
	modifiedAt: string;
	boards: BoardData[];
	activeBoardId: string;
}

// --- Item factory ---

export function createItem(
	overrides: Partial<BoardItem> & Pick<BoardItem, 'type' | 'url'>
): BoardItem {
	const base: BoardItem = {
		id: crypto.randomUUID(),
		x: 0,
		y: 0,
		width: 300,
		height: 200,
		zIndex: 0,
		rotation: 0,
		tags: [],
		rating: 0,
		...overrides
	};

	// Default video metadata for video/youtube types
	if ((base.type === 'video' || base.type === 'youtube') && !base.videoMeta) {
		base.videoMeta = { loopStart: 0, loopEnd: 100, muted: true };
	}

	return base;
}

// --- Board factory ---

export function createBoard(name = 'Board 1'): BoardData {
	const now = new Date().toISOString();
	return {
		id: crypto.randomUUID(),
		name,
		items: [],
		groups: [],
		viewport: { x: 0, y: 0, scale: 1 },
		createdAt: now,
		modifiedAt: now
	};
}

// --- Project factory ---

export function createProject(name = 'Untitled Project'): ProjectData {
	const now = new Date().toISOString();
	const board = createBoard('Board 1');
	return {
		id: crypto.randomUUID(),
		name,
		version: 1,
		createdAt: now,
		modifiedAt: now,
		boards: [board],
		activeBoardId: board.id
	};
}

// --- URL helpers ---

/**
 * Extract YouTube video ID from various URL formats.
 * Supports: youtube.com/watch?v=X, youtu.be/X, youtube.com/embed/X
 */
export function extractYoutubeId(url: string): string | null {
	const patterns = [
		/(?:youtube\.com\/watch\?.*v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
		/^([a-zA-Z0-9_-]{11})$/ // bare ID
	];
	for (const pattern of patterns) {
		const match = url.match(pattern);
		if (match) return match[1];
	}
	return null;
}

/**
 * Check if a URL looks like a YouTube link.
 */
export function isYoutubeUrl(url: string): boolean {
	return /(?:youtube\.com|youtu\.be)\//i.test(url);
}

/**
 * Check if a URL points to a video file.
 */
export function isVideoUrl(url: string): boolean {
	return /\.(mp4|webm|ogg|mov|avi|mkv)(\?.*)?$/i.test(url);
}

/**
 * Check if a URL points to an image file.
 */
export function isImageUrl(url: string): boolean {
	return /\.(jpg|jpeg|png|gif|webp|svg|bmp|avif|ico)(\?.*)?$/i.test(url);
}
