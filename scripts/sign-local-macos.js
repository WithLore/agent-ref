#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const DEFAULT_IDENTITY = 'AgentRef Local Development';
export const BUNDLE_IDENTIFIER = 'com.agentref.app';

/** @param {string} output */
export function parseSha1Fingerprint(output) {
	const match = output.match(/^SHA-1 hash:\s*([0-9A-F]{40})$/m);
	if (!match) {
		throw new Error(`Could not find the SHA-1 fingerprint for "${DEFAULT_IDENTITY}".`);
	}
	return match[1];
}

/** @param {string} fingerprint */
export function makeDesignatedRequirement(fingerprint) {
	return `=designated => certificate leaf = H"${fingerprint}" and identifier "${BUNDLE_IDENTIFIER}"`;
}

/**
 * @param {string} command
 * @param {string[]} args
 * @param {{ capture?: boolean }} [options]
 */
function run(command, args, options = {}) {
	return execFileSync(command, args, {
		encoding: 'utf8',
		stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit'
	});
}

/**
 * @param {string} appPath
 * @param {string} [identity]
 */
export function signLocalMacApp(appPath, identity = DEFAULT_IDENTITY) {
	if (process.platform !== 'darwin') {
		throw new Error('Local AgentRef code signing is only available on macOS.');
	}

	const resolvedAppPath = resolve(appPath);
	const loginKeychain = join(homedir(), 'Library', 'Keychains', 'login.keychain-db');
	if (!existsSync(resolvedAppPath)) {
		throw new Error(`AgentRef app bundle not found: ${resolvedAppPath}`);
	}

	const certificateDetails = run(
		'/usr/bin/security',
		['find-certificate', '-Z', '-c', identity, loginKeychain],
		{ capture: true }
	);
	const fingerprint = parseSha1Fingerprint(certificateDetails);
	const requirement = makeDesignatedRequirement(fingerprint);

	run('/usr/bin/codesign', [
		'--force',
		'--deep',
		'--options',
		'runtime',
		'--keychain',
		loginKeychain,
		'--sign',
		fingerprint,
		'--identifier',
		BUNDLE_IDENTIFIER,
		'--requirements',
		requirement,
		resolvedAppPath
	]);
	run('/usr/bin/codesign', ['--verify', '--deep', '--strict', '--verbose=2', resolvedAppPath]);

	console.log(`Signed ${resolvedAppPath} as ${BUNDLE_IDENTIFIER} with ${identity}.`);
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) {
	const appPath = process.argv[2] ?? 'src-tauri/target/release/bundle/macos/AgentRef.app';
	try {
		signLocalMacApp(appPath, process.env.AGENTREF_CODESIGN_IDENTITY ?? DEFAULT_IDENTITY);
	} catch (error) {
		console.error(error instanceof Error ? error.message : error);
		process.exitCode = 1;
	}
}
