import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const distDir = path.join(__dirname, '..', 'dist');
const htmlPath = path.join(distDir, 'index.html');
const imagesDir = path.join(distDir, 'images', 'horse');

// HTML 파일 읽기
let htmlContent = fs.readFileSync(htmlPath, 'utf-8');

// 이미지 파일들을 base64로 변환
const imageFiles = fs.readdirSync(imagesDir).filter(file => file.endsWith('.png')).sort();
const imageMap = new Map();

console.log(`인라인화할 이미지 파일: ${imageFiles.length}개`);

// 모든 이미지를 base64로 변환하여 맵에 저장
for (const imageFile of imageFiles) {
  const imagePath = path.join(imagesDir, imageFile);
  const imageBuffer = fs.readFileSync(imagePath);
  const base64 = imageBuffer.toString('base64');
  const dataUri = `data:image/png;base64,${base64}`;
  imageMap.set(imageFile, dataUri);
  console.log(`✓ ${imageFile} 변환 완료`);
}

// HTML에서 루프 패턴을 찾아서 base64 데이터 URI 배열로 교체
// 빌드된 코드에서: for(let l=0;l<12;l++){const s=`./images/horse/tile${String(l).padStart(3,"0")}.png`;...}
// 이 루프를 찾아서 각 이미지의 base64 데이터 URI를 직접 사용하도록 수정

let replacedCount = 0;

// base64 데이터 URI 배열 생성
const base64Array = [];
for (let i = 0; i < 12; i++) {
  const num = String(i).padStart(3, '0');
  const imageFile = `tile${num}.png`;
  const dataUri = imageMap.get(imageFile);
  if (dataUri) {
    base64Array.push(dataUri);
  }
}

// 루프 패턴 찾기 - 문자열 검색 방식 사용
const loopStartStr = 'for(let l=0;l<12;l++){';
const templateStartStr = 'const s=`./images/horse/tile${String(l).padStart(3,"0")}.png`';

if (htmlContent.includes(loopStartStr) && htmlContent.includes(templateStartStr)) {
  // base64 배열을 루프 앞에 추가
  const arrayDeclaration = `const horseImages=[${base64Array.map(uri => `"${uri.replace(/"/g, '\\"')}"`).join(',')}];`;
  
  // 루프 시작 위치 찾기
  const loopStartIndex = htmlContent.indexOf(loopStartStr);
  if (loopStartIndex !== -1) {
    // 루프 시작 직전에 배열 선언 추가
    const beforeLoop = htmlContent.substring(0, loopStartIndex);
    const afterLoopStart = htmlContent.substring(loopStartIndex);
    
    // 템플릿 리터럴을 배열 접근으로 교체
    // const s=`./images/horse/tile${String(l).padStart(3,"0")}.png`; 를
    // const s=horseImages[l]; 로 교체
    // 정규식 대신 문자열 교체 사용 (더 확실함)
    const templateStr = 'const s=`./images/horse/tile${String(l).padStart(3,"0")}.png`';
    const replacementStr = 'const s=horseImages[l]';
    
    let modifiedAfterLoop = afterLoopStart;
    if (modifiedAfterLoop.includes(templateStr)) {
      modifiedAfterLoop = modifiedAfterLoop.replace(templateStr, replacementStr);
    } else {
      // 다른 형식일 수 있으므로 정규식도 시도
      modifiedAfterLoop = modifiedAfterLoop.replace(
        /const s=`\.\/images\/horse\/tile\$\{String\(l\)\.padStart\(3,"0"\)\}\)\.png`/g,
        replacementStr
      );
    }
    
    htmlContent = beforeLoop + arrayDeclaration + modifiedAfterLoop;
    replacedCount = 12;
    console.log('✓ 루프 패턴 교체 완료 (12개 이미지)');
  }
} else {
  // 루프 패턴을 찾지 못한 경우, 개별 경로 교체 시도
  console.log('⚠️ 루프 패턴을 찾지 못했습니다. 개별 경로 교체를 시도합니다...');
  
  for (let i = 0; i < 12; i++) {
    const num = String(i).padStart(3, '0');
    const imageFile = `tile${num}.png`;
    const dataUri = imageMap.get(imageFile);
    
    if (!dataUri) continue;
    
    // 실제 생성될 경로 문자열
    const pathStr = `./images/horse/${imageFile}`;
    
    // 다양한 패턴으로 교체 시도
    const patterns = [
      new RegExp(`"\\./images/horse/${imageFile}"`, 'g'),
      new RegExp(`'\\./images/horse/${imageFile}'`, 'g'),
      new RegExp(`\`\\./images/horse/${imageFile}\``, 'g'),
      new RegExp(`\\./images/horse/${imageFile}(?![0-9])`, 'g'), // 숫자로 시작하지 않는 경우만
    ];
    
    for (const regex of patterns) {
      if (regex.test(htmlContent)) {
        htmlContent = htmlContent.replace(regex, `"${dataUri}"`);
        replacedCount++;
        console.log(`✓ ${imageFile} 개별 교체 완료`);
        break;
      }
    }
  }
}

// HTML 파일 저장
fs.writeFileSync(htmlPath, htmlContent, 'utf-8');
console.log(`✅ 모든 이미지 인라인화 완료! (${replacedCount}개 교체됨)`);

