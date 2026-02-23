import sharp from 'sharp';
import { writeFileSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const iconsDir = join(rootDir, 'src-tauri/icons');
const svgPath = join(rootDir, 'src/lib/assets/icon.svg');

async function gen(size, filename) {
	await sharp(svgPath).resize(size, size).png().toFile(join(iconsDir, filename));
	console.log(`  ✓ ${filename} (${size}x${size})`);
}

/**
 * Build a minimal .icns file from PNG buffers.
 * macOS .icns format: 'icns' magic + length, then entries of type + length + PNG data.
 */
function buildIcns(pngMap) {
	// Icon type codes for PNG-encoded entries
	const typeMap = {
		128: 'ic07',   // 128x128
		256: 'ic08',   // 256x256
		512: 'ic09',   // 512x512
	};

	const entries = [];
	for (const [size, png] of Object.entries(pngMap)) {
		const code = typeMap[size];
		if (!code) continue;
		// Entry: 4-byte type + 4-byte length (includes type+length) + data
		const entryLen = 8 + png.length;
		const entry = Buffer.alloc(entryLen);
		entry.write(code, 0, 4, 'ascii');
		entry.writeUInt32BE(entryLen, 4);
		png.copy(entry, 8);
		entries.push(entry);
	}

	const totalDataLen = entries.reduce((s, e) => s + e.length, 0);
	const fileLen = 8 + totalDataLen; // 'icns' header + all entries
	const header = Buffer.alloc(8);
	header.write('icns', 0, 4, 'ascii');
	header.writeUInt32BE(fileLen, 4);

	return Buffer.concat([header, ...entries]);
}

async function generateAllIcons() {
	console.log('Generating all icon sizes from icon.svg...\n');

	// ── Tauri required icons ──
	console.log('Tauri core:');
	await gen(32, '32x32.png');
	await gen(128, '128x128.png');
	await gen(256, '128x128@2x.png');   // macOS Retina
	await gen(256, 'icon.png');
	await gen(512, '512x512.png');

	// ── Windows Store tiles ──
	console.log('\nWindows Store tiles:');
	await gen(30, 'Square30x30Logo.png');
	await gen(44, 'Square44x44Logo.png');
	await gen(71, 'Square71x71Logo.png');
	await gen(89, 'Square89x89Logo.png');
	await gen(107, 'Square107x107Logo.png');
	await gen(142, 'Square142x142Logo.png');
	await gen(150, 'Square150x150Logo.png');
	await gen(284, 'Square284x284Logo.png');
	await gen(310, 'Square310x310Logo.png');
	await gen(50, 'StoreLogo.png');

	// ── Windows .ico ──
	console.log('\nWindows .ico:');
	const pngToIco = (await import('png-to-ico')).default;
	const icoInput = join(iconsDir, 'icon.png');
	const icoBuf = await pngToIco(icoInput);
	writeFileSync(join(iconsDir, 'icon.ico'), icoBuf);
	console.log('  ✓ icon.ico');

	// ── macOS .icns ──
	console.log('\nmacOS .icns:');
	const png128 = await sharp(svgPath).resize(128, 128).png().toBuffer();
	const png256 = await sharp(svgPath).resize(256, 256).png().toBuffer();
	const png512 = await sharp(svgPath).resize(512, 512).png().toBuffer();
	const icnsBuf = buildIcns({ 128: png128, 256: png256, 512: png512 });
	writeFileSync(join(iconsDir, 'icon.icns'), icnsBuf);
	console.log('  ✓ icon.icns');

	console.log('\n✅ All icons generated!');
}

generateAllIcons().catch(console.error);
