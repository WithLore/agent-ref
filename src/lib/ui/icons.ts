/**
 * Inline SVG icons — no emoji, no icon library dependencies.
 * Clean geometric monochrome icons sized for 16x16 by default.
 */

export const icons = {
	// Empty state
	dropzone: `<svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="6" width="36" height="36" rx="4" stroke-dasharray="4 3"/><path d="M24 16v16M16 24h16"/></svg>`,

	// Media loop
	loop: `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M13.5 8A5.5 5.5 0 018 13.5 5.5 5.5 0 012.5 8 5.5 5.5 0 018 2.5c1.8 0 3.4.9 4.4 2.2"/><path d="M10 5h3V2"/></svg>`,

	// Warning / error
	warning: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 1.5L1 14h14L8 1.5z"/><path d="M8 6v3.5"/><circle cx="8" cy="12" r=".5" fill="currentColor"/></svg>`,

	// Context menu actions
	trash: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4h12"/><path d="M5.3 4V2.7c0-.4.3-.7.7-.7h4c.4 0 .7.3.7.7V4"/><path d="M12 4v9.3c0 .4-.3.7-.7.7H4.7c-.4 0-.7-.3-.7-.7V4"/></svg>`,

	copy: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="5" width="9" height="9" rx="1.5"/><path d="M3 11V3c0-.6.4-1 1-1h8"/></svg>`,

	paste: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 2h2c.6 0 1 .4 1 1v10c0 .6-.4 1-1 1H4c-.6 0-1-.4-1-1V3c0-.6.4-1 1-1h2"/><rect x="6" y="1" width="4" height="3" rx="1"/></svg>`,

	// Group
	group: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="12" height="12" rx="2" stroke-dasharray="3 2"/></svg>`,

	ungroup: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="1" width="6" height="6" rx="1"/><rect x="9" y="9" width="6" height="6" rx="1"/></svg>`,

	// Navigation
	plus: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M8 3v10M3 8h10"/></svg>`,

	chevronLeft: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 3L5 8l5 5"/></svg>`,

	chevronRight: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3l5 5-5 5"/></svg>`,

	// File operations
	save: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M13 15H3c-.6 0-1-.4-1-1V2c0-.6.4-1 1-1h7.6L14 4.4V14c0 .6-.4 1-1 1z"/><path d="M11 15V9H5v6"/><path d="M5 1v3h4"/></svg>`,

	folder: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 13V3c0-.6.4-1 1-1h3.2l1.6 2H13c.6 0 1 .4 1 1v8c0 .6-.4 1-1 1H3c-.6 0-1-.4-1-1z"/></svg>`,

	// Rating / curation
	star: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M8 1.5l2 4.1 4.5.7-3.2 3.2.8 4.5L8 11.8 3.9 14l.8-4.5L1.5 6.3l4.5-.7z"/></svg>`,

	starFilled: `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" stroke="currentColor" stroke-width="1" stroke-linejoin="round"><path d="M8 1.5l2 4.1 4.5.7-3.2 3.2.8 4.5L8 11.8 3.9 14l.8-4.5L1.5 6.3l4.5-.7z"/></svg>`,

	tag: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1.5 9V2.5c0-.6.4-1 1-1H9l5.5 5.5L9 12.5z"/><circle cx="5.5" cy="5.5" r="1" fill="currentColor"/></svg>`,

	// Zoom
	zoomFit: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 6V3c0-.6.4-1 1-1h3M10 2h3c.6 0 1 .4 1 1v3M14 10v3c0 .6-.4 1-1 1h-3M6 14H3c-.6 0-1-.4-1-1v-3"/></svg>`,

	zoomReset: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="7" cy="7" r="5"/><path d="M12 12l3 3"/><path d="M5.5 7h3"/></svg>`,

	// Layout
	bringToFront: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="5" width="6" height="6" rx="1" opacity=".4"/><rect x="5" y="1" width="10" height="10" rx="1"/></svg>`,

	// Text
	text: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M3 3h10M8 3v10M5 13h6"/></svg>`,

	// Board
	board: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="12" height="12" rx="2"/><path d="M2 6h12"/></svg>`,

	// Misc
	more: `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><circle cx="4" cy="8" r="1.2"/><circle cx="8" cy="8" r="1.2"/><circle cx="12" cy="8" r="1.2"/></svg>`,

	close: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 4l8 8M12 4l-8 8"/></svg>`,

	rename: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.5 2.5l3 3L5 14H2v-3z"/></svg>`,

	// Package / export
	package: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 5l6-3 6 3v6l-6 3-6-3z"/><path d="M2 5l6 3 6-3"/><path d="M8 8v6.5"/></svg>`,

	// Import
	import: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2v8M5 7l3 3 3-3"/><path d="M2 11v2c0 .6.4 1 1 1h10c.6 0 1-.4 1-1v-2"/></svg>`,

	// Undo/redo
	undo: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7h7a3 3 0 010 6H8"/><path d="M6 4L3 7l3 3"/></svg>`,

	redo: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M13 7H6a3 3 0 000 6h2"/><path d="M10 4l3 3-3 3"/></svg>`,

	// Lock
	lock: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="7" width="10" height="7" rx="1.5"/><path d="M5 7V5a3 3 0 016 0v2"/></svg>`,

	lockOpen: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="7" width="10" height="7" rx="1.5"/><path d="M5 7V5a3 3 0 016 0"/></svg>`,

	// Rotation
	rotate: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 8A5.5 5.5 0 0113.4 5.5"/><path d="M13.5 2v4h-4"/><path d="M13.5 8A5.5 5.5 0 012.6 10.5"/><path d="M2.5 14v-4h4"/></svg>`,

	// Alignment
	alignLeft: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M2 2v12"/><path d="M5 4h8M5 8h5M5 12h8"/></svg>`,

	alignCenterH: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M8 2v12"/><path d="M4 4h8M5 8h6M4 12h8"/></svg>`,

	alignRight: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M14 2v12"/><path d="M3 4h8M6 8h5M3 12h8"/></svg>`,

	alignTop: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M2 2h12"/><path d="M4 5v8M8 5v5M12 5v8"/></svg>`,

	alignCenterV: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M2 8h12"/><path d="M4 4v8M8 5v6M12 4v8"/></svg>`,

	alignBottom: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M2 14h12"/><path d="M4 3v8M8 6v5M12 3v8"/></svg>`,

	distributeH: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M2 2v12M14 2v12"/><rect x="5" y="5" width="2" height="6" rx="0.5" fill="currentColor"/><rect x="9" y="5" width="2" height="6" rx="0.5" fill="currentColor"/></svg>`,

	distributeV: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M2 2h12M2 14h12"/><rect x="5" y="5" width="6" height="2" rx="0.5" fill="currentColor"/><rect x="5" y="9" width="6" height="2" rx="0.5" fill="currentColor"/></svg>`
};
