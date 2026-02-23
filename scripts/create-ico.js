import pngToIco from 'png-to-ico';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

async function createIco() {
	const iconPath = join(rootDir, 'src-tauri/icons/icon.png');
	const outputPath = join(rootDir, 'src-tauri/icons/icon.ico');

	console.log('Creating .ico file from PNG...');

	const buf = await pngToIco(iconPath);
	writeFileSync(outputPath, buf);

	console.log('✓ Created icon.ico');
}

createIco().catch(console.error);
