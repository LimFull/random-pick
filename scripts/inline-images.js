/**
 * 이미지 인라인화 스크립트
 *
 * 빌드된 index.html의 이미지 경로를 base64 데이터 URI로 변환합니다.
 * 이를 통해 단일 HTML 파일에서 이미지를 사용할 수 있습니다.
 *
 * 사용법:
 * - public/images 폴더에 이미지를 추가하세요
 * - npm run build 실행 시 자동으로 이미지가 인라인화됩니다
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const distDir = path.join(__dirname, '..', 'dist');
const htmlPath = path.join(distDir, 'index.html');

// HTML 파일 존재 확인
if (!fs.existsSync(htmlPath)) {
  console.log('⚠️ dist/index.html 파일이 없습니다. 먼저 빌드를 실행하세요.');
  process.exit(1);
}

// HTML 파일 읽기
let htmlContent = fs.readFileSync(htmlPath, 'utf-8');

/**
 * 디렉토리를 재귀적으로 탐색하여 모든 이미지 파일 찾기
 */
function findImageFiles(dir, basePath = '') {
  const files = [];

  if (!fs.existsSync(dir)) {
    return files;
  }

  const items = fs.readdirSync(dir);

  for (const item of items) {
    const fullPath = path.join(dir, item);
    const relativePath = path.join(basePath, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      files.push(...findImageFiles(fullPath, relativePath));
    } else if (/\.(png|jpg|jpeg|gif|svg|webp|ico)$/i.test(item)) {
      files.push({
        fullPath,
        relativePath: relativePath.replace(/\\/g, '/'), // Windows 경로 변환
        extension: path.extname(item).toLowerCase()
      });
    }
  }

  return files;
}

/**
 * 이미지 파일을 base64 데이터 URI로 변환
 */
function imageToDataUri(filePath, extension) {
  const mimeTypes = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon'
  };

  const mimeType = mimeTypes[extension] || 'application/octet-stream';
  const imageBuffer = fs.readFileSync(filePath);
  const base64 = imageBuffer.toString('base64');

  return `data:${mimeType};base64,${base64}`;
}

// dist/images 디렉토리에서 이미지 파일 찾기
const imagesDir = path.join(distDir, 'images');
const imageFiles = findImageFiles(imagesDir);

console.log(`\n📁 이미지 인라인화 시작`);
console.log(`   발견된 이미지: ${imageFiles.length}개\n`);

let replacedCount = 0;

// 각 이미지 파일에 대해 경로를 base64로 교체
for (const imageFile of imageFiles) {
  const dataUri = imageToDataUri(imageFile.fullPath, imageFile.extension);

  // 다양한 경로 패턴으로 교체 시도
  const patterns = [
    `./images/${imageFile.relativePath}`,
    `/images/${imageFile.relativePath}`,
    `images/${imageFile.relativePath}`
  ];

  for (const pattern of patterns) {
    // 큰따옴표, 작은따옴표, 백틱으로 감싸진 경로 모두 처리
    const regexPatterns = [
      new RegExp(`"${pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`, 'g'),
      new RegExp(`'${pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'`, 'g'),
      new RegExp(`\`${pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\``, 'g')
    ];

    for (const regex of regexPatterns) {
      if (regex.test(htmlContent)) {
        htmlContent = htmlContent.replace(regex, `"${dataUri}"`);
        replacedCount++;
        console.log(`   ✓ ${imageFile.relativePath} 인라인화 완료`);
        break;
      }
    }
  }
}

// HTML 파일 저장
fs.writeFileSync(htmlPath, htmlContent, 'utf-8');

console.log(`\n✅ 이미지 인라인화 완료! (${replacedCount}개 교체됨)\n`);
