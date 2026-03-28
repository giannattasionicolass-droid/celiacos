/**
 * Genera los iconos PNG para la PWA descargando el logo de CeliaShop
 * desde Supabase y redimensionándolo con sharp.
 * Uso: node scripts/generate-pwa-icons.mjs
 */
import { createWriteStream, existsSync, mkdirSync } from 'fs';
import { pipeline } from 'stream/promises';
import https from 'https';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(__dirname, '..', 'public');

const LOGO_URL =
  'https://fsgssvindtmryytpgmxg.supabase.co/storage/v1/object/public/assets/Gemini_Generated_Image_cjh3kicjh3kicjh3.png';

async function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = createWriteStream(dest);
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} al descargar ${url}`));
        return;
      }
      pipeline(res, file).then(resolve).catch(reject);
    }).on('error', reject);
  });
}

async function trySharp() {
  try {
    const sharp = (await import('sharp')).default;
    return sharp;
  } catch {
    return null;
  }
}

async function main() {
  console.log('📱 Generando iconos PWA para CeliaShop...');

  // Descargar logo original
  const logoPath = path.join(PUBLIC, '_logo-original.png');
  console.log('⬇️  Descargando logo desde Supabase...');
  await download(LOGO_URL, logoPath);
  console.log('✅  Logo descargado');

  const sharp = await trySharp();
  if (!sharp) {
    console.log('\n⚠️  "sharp" no está instalado. Instalalo con:');
    console.log('   npm install sharp --save-dev');
    console.log('   y volvé a ejecutar: node scripts/generate-pwa-icons.mjs\n');
    console.log('Por ahora se usará el logo original como ícono (sólo funciona si tiene exactamente 512x512 px).');
    return;
  }

  const sizes = [
    { name: 'pwa-192.png', size: 192 },
    { name: 'pwa-512.png', size: 512 },
    { name: 'apple-touch-icon.png', size: 180 },
  ];

  for (const { name, size } of sizes) {
    const dest = path.join(PUBLIC, name);
    await sharp(logoPath)
      .resize(size, size, { fit: 'cover', background: { r: 255, g: 255, b: 255, alpha: 1 } })
      .png()
      .toFile(dest);
    console.log(`✅  ${name} (${size}x${size}px)`);
  }

  // Limpiar logo temporal
  const { unlinkSync } = await import('fs');
  unlinkSync(logoPath);

  console.log('\n🎉 Iconos generados en public/');
  console.log('   Ahora corré: npm run build');
}

main().catch((err) => {
  console.error('❌  Error:', err.message);
  process.exit(1);
});
