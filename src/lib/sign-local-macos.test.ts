import { describe, expect, it } from 'vitest';
import {
	BUNDLE_IDENTIFIER,
	makeDesignatedRequirement,
	parseSha1Fingerprint
} from '../../scripts/sign-local-macos.js';

describe('local macOS signing identity', () => {
	it('creates a stable designated requirement from the certificate fingerprint', () => {
		const output = [
			'SHA-256 hash: 09BD33D3E1571DDF0B9F9070FB47796435E534EB21A734110DB0BF777B67173D',
			'SHA-1 hash: 5EEB5805E705F65D73EF2796ED8797E1AB64F1DC'
		].join('\n');
		const fingerprint = parseSha1Fingerprint(output);

		expect(makeDesignatedRequirement(fingerprint)).toBe(
			'=designated => certificate leaf = H"5EEB5805E705F65D73EF2796ED8797E1AB64F1DC" and identifier "com.agentref.app"'
		);
		expect(BUNDLE_IDENTIFIER).toBe('com.agentref.app');
	});

	it('rejects certificate output without a SHA-1 identity', () => {
		expect(() => parseSha1Fingerprint('0 valid identities found')).toThrow(
			'Could not find the SHA-1 fingerprint'
		);
	});
});
