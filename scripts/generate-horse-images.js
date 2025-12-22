import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const imagesDir = path.join(__dirname, '..', 'public', 'images', 'horse');
const outputPath = path.join(__dirname, '..', 'src', 'assets', 'horseImages.ts');

// assets 디렉토리가 없으면 생성
const assetsDir = path.dirname(outputPath);
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

// 이미지 파일들을 base64로 변환
const imageFiles = fs.readdirSync(imagesDir)
  .filter(file => file.endsWith('.png'))
  .sort();

console.log(`변환할 이미지 파일: ${imageFiles.length}개`);

const images = [];
for (const imageFile of imageFiles) {
  const imagePath = path.join(imagesDir, imageFile);
  const imageBuffer = fs.readFileSync(imagePath);
  const base64 = imageBuffer.toString('base64');
  const dataUri = `data:image/png;base64,${base64}`;
  images.push(dataUri);
  console.log(`✓ ${imageFile} 변환 완료`);
}

// TypeScript 파일 생성
const tsContent = `// 자동 생성된 파일 - 직접 수정하지 마세요
// scripts/generate-horse-images.js에 의해 생성됨

export const horseImages: string[] = [
${images.map((img, i) => `  // tile${String(i).padStart(3, '0')}.png\n  "${img}"`).join(',\n')}
];
`;

fs.writeFileSync(outputPath, tsContent, 'utf-8');
console.log(`\n✅ ${outputPath} 생성 완료!`);
