/**
 * Room code generator - short, human-readable codes for P2P rooms.
 * Format: WORD-WORD-NN-XXXXXX (e.g., "REEF-TIGER-27-A1B2C3")
 */

const ADJECTIVES = [
	'RED', 'BLUE', 'GOLD', 'DARK', 'WILD', 'COOL', 'FAST', 'BOLD',
	'WARM', 'DEEP', 'SOFT', 'PALE', 'KEEN', 'PURE', 'RARE', 'CALM',
	'IRON', 'JADE', 'NEON', 'MINT', 'DAWN', 'DUSK', 'PINE', 'SNOW'
];

const NOUNS = [
	'WOLF', 'HAWK', 'BEAR', 'REEF', 'FERN', 'LYNX', 'SAGE', 'CROW',
	'HARE', 'MOTH', 'KITE', 'WREN', 'PIKE', 'DOVE', 'LARK', 'COLT',
	'TIDE', 'MIST', 'PEAK', 'GLEN', 'VALE', 'MOSS', 'DUNE', 'FORD'
];

function pick<T>(arr: T[]): T {
	return arr[Math.floor(Math.random() * arr.length)];
}

function randomToken(length: number): string {
	const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
	const bytes = crypto.getRandomValues(new Uint8Array(length));
	let token = '';
	for (const byte of bytes) {
		token += alphabet[byte % alphabet.length];
	}
	return token;
}

/**
 * Generate a room code like "BLUE-HAWK-42-A1B2C3".
 * Entropy is driven by a 6-char random base36 suffix (~2.1B combinations).
 */
export function generateRoomCode(): string {
	const adj = pick(ADJECTIVES);
	const noun = pick(NOUNS);
	const num = String(Math.floor(Math.random() * 90) + 10); // 10-99
	const token = randomToken(6);
	return `${adj}-${noun}-${num}-${token}`;
}

/**
 * Convert a room code to the full room ID used by y-webrtc.
 */
export function roomCodeToId(code: string): string {
	return `agentref-room-${code.toUpperCase().trim()}`;
}

/**
 * Validate a room code looks right (WORD-WORD-NN-XXXXXX format).
 */
export function isValidRoomCode(code: string): boolean {
	return /^[A-Z]{3,5}-[A-Z]{3,5}-\d{2}-[A-Z0-9]{6}$/.test(code.toUpperCase().trim());
}
