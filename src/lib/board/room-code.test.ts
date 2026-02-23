import { describe, it, expect } from 'vitest';
import { generateRoomCode, roomCodeToId, isValidRoomCode } from './room-code.js';

describe('room-code', () => {
	describe('generateRoomCode', () => {
		it('produces WORD-WORD-NN-XXXXXX format', () => {
			const code = generateRoomCode();
			expect(code).toMatch(/^[A-Z]+-[A-Z]+-\d{2}-[A-Z0-9]{6}$/);
		});

		it('produces codes that pass validation', () => {
			for (let i = 0; i < 50; i++) {
				const code = generateRoomCode();
				expect(isValidRoomCode(code), `Code "${code}" should be valid`).toBe(true);
			}
		});

		it('generates unique codes across many iterations', () => {
			const codes = new Set<string>();
			for (let i = 0; i < 100; i++) {
				codes.add(generateRoomCode());
			}
			// With ~2.1B combos, 100 codes should always be unique
			expect(codes.size).toBe(100);
		});

		it('number segment is between 10 and 99', () => {
			for (let i = 0; i < 100; i++) {
				const code = generateRoomCode();
				const num = parseInt(code.split('-')[2], 10);
				expect(num).toBeGreaterThanOrEqual(10);
				expect(num).toBeLessThanOrEqual(99);
			}
		});

		it('token segment is exactly 6 chars of base36', () => {
			for (let i = 0; i < 50; i++) {
				const code = generateRoomCode();
				const token = code.split('-')[3];
				expect(token).toHaveLength(6);
				expect(token).toMatch(/^[A-Z0-9]+$/);
			}
		});
	});

	describe('roomCodeToId', () => {
		it('prepends agentref-room- prefix', () => {
			expect(roomCodeToId('BLUE-HAWK-42-A1B2C3')).toBe('agentref-room-BLUE-HAWK-42-A1B2C3');
		});

		it('uppercases and trims input', () => {
			expect(roomCodeToId('  blue-hawk-42-a1b2c3  ')).toBe('agentref-room-BLUE-HAWK-42-A1B2C3');
		});
	});

	describe('isValidRoomCode', () => {
		it('accepts valid WORD-WORD-NN-XXXXXX codes', () => {
			expect(isValidRoomCode('BLUE-HAWK-42-A1B2C3')).toBe(true);
			expect(isValidRoomCode('RED-WOLF-10-ZZZZZZ')).toBe(true);
			expect(isValidRoomCode('SNOW-DUNE-99-000000')).toBe(true);
		});

		it('is case-insensitive', () => {
			expect(isValidRoomCode('blue-hawk-42-a1b2c3')).toBe(true);
			expect(isValidRoomCode('Blue-Hawk-42-A1b2C3')).toBe(true);
		});

		it('trims whitespace', () => {
			expect(isValidRoomCode('  BLUE-HAWK-42-A1B2C3  ')).toBe(true);
		});

		it('rejects empty string', () => {
			expect(isValidRoomCode('')).toBe(false);
		});

		it('rejects codes missing segments', () => {
			expect(isValidRoomCode('BLUE-HAWK-42')).toBe(false);
			expect(isValidRoomCode('BLUE-HAWK')).toBe(false);
			expect(isValidRoomCode('BLUE')).toBe(false);
		});

		it('rejects codes with wrong number format', () => {
			expect(isValidRoomCode('BLUE-HAWK-5-A1B2C3')).toBe(false); // single digit
			expect(isValidRoomCode('BLUE-HAWK-100-A1B2C3')).toBe(false); // three digits
		});

		it('rejects codes with wrong token length', () => {
			expect(isValidRoomCode('BLUE-HAWK-42-A1B2C')).toBe(false); // 5 chars
			expect(isValidRoomCode('BLUE-HAWK-42-A1B2C3D')).toBe(false); // 7 chars
		});

		it('rejects codes with special characters', () => {
			expect(isValidRoomCode('BLU!-HAWK-42-A1B2C3')).toBe(false);
			expect(isValidRoomCode('BLUE-HA#K-42-A1B2C3')).toBe(false);
		});

		it('rejects codes with word segments too short or too long', () => {
			expect(isValidRoomCode('AB-HAWK-42-A1B2C3')).toBe(false); // 2-char adj
			expect(isValidRoomCode('ABCDEF-HAWK-42-A1B2C3')).toBe(false); // 6-char adj
		});
	});
});
