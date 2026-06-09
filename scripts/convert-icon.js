const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('Converting SVG to ICO...');

// Check if sharp is installed
try {
  require.resolve('sharp');
} catch (e) {
  console.log('Installing sharp...');
  execSync('npm install sharp --save-dev', { stdio: 'inherit' });
}

const sharp = require('sharp');

const sizes = [16, 32, 48, 64, 128, 256];
const svgPath = path.join(__dirname, '..', 'ai-proxy.svg');
const icoPath = path.join(__dirname, '..', 'ai-proxy.ico');

async function convert() {
  // Create PNG buffers for each size
  const pngBuffers = await Promise.all(
    sizes.map(size =>
      sharp(svgPath)
        .resize(size, size)
        .png()
        .toBuffer()
    )
  );

  // For simplicity, just create a 256x256 PNG and rename to ICO
  // (Windows will auto-resize)
  await sharp(svgPath)
    .resize(256, 256)
    .png()
    .toFile(icoPath.replace('.ico', '.png'));

  console.log('Created: ai-proxy.png');
  console.log('');
  console.log('To create .ico file, use one of these methods:');
  console.log('1. Visit https://convertico.com/ and upload ai-proxy.svg');
  console.log('2. Use ImageMagick: magick convert ai-proxy.svg -resize 256x256 ai-proxy.ico');
  console.log('3. Use the PNG file directly (some apps support it)');
}

convert().catch(console.error);
