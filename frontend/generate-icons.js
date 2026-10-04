const sharp = require('sharp');
const path = require('path');

const svgBuffer = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="80" fill="#1a1a2e"/>
  <rect x="145" y="105" width="215" height="275" rx="14" fill="#FDF6EC" opacity="0.85"/>
  <rect x="162" y="82" width="215" height="275" rx="14" fill="#FDF6EC" opacity="0.72"/>
  <rect x="178" y="62" width="218" height="295" rx="14" fill="#FDF6EC"/>
  <rect x="198" y="122" width="138" height="11" rx="5.5" fill="#1a1a2e" opacity="0.25"/>
  <rect x="198" y="147" width="98" height="8" rx="4" fill="#1a1a2e" opacity="0.18"/>
  <rect x="198" y="167" width="118" height="8" rx="4" fill="#1a1a2e" opacity="0.18"/>
  <rect x="198" y="187" width="80" height="8" rx="4" fill="#1a1a2e" opacity="0.12"/>
  <circle cx="287" cy="275" r="58" fill="#F5C98E" opacity="0.9"/>
  <circle cx="287" cy="275" r="44" fill="#1a1a2e" opacity="0.15"/>
  <text x="287" y="303" text-anchor="middle" font-size="68" font-weight="900" fill="#1a1a2e" font-family="Arial Black, Arial, sans-serif">D</text>
</svg>`);

async function generateIcons() {
  try {
    await sharp(svgBuffer).resize(192, 192).png().toFile(path.join('public', 'icon-192.png'));
    console.log('Generated icon-192.png');
    
    await sharp(svgBuffer).resize(512, 512).png().toFile(path.join('public', 'icon-512.png'));
    console.log('Generated icon-512.png');
    
    await sharp(svgBuffer).resize(180, 180).png().toFile(path.join('public', 'apple-touch-icon.png'));
    console.log('Generated apple-touch-icon.png');
  } catch (err) {
    console.error('Error generating icons:', err.message);
  }
}

generateIcons();
