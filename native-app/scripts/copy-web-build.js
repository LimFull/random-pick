/**
 * 웹 빌드 결과물을 React Native 앱에서 사용할 수 있도록 복사하는 스크립트
 *
 * 실행 방법:
 * 1. 웹 프로젝트 루트에서: npm run build:native
 * 2. native-app 폴더에서: npm run copy-web
 */

const fs = require('fs');
const path = require('path');

const WEB_BUILD_DIR = path.join(__dirname, '../../dist-native');
const OUTPUT_FILE = path.join(__dirname, '../src/webContent.ts');

async function main() {
  console.log('웹 빌드 파일을 React Native 앱으로 복사 중...');

  // dist-native 폴더 확인
  if (!fs.existsSync(WEB_BUILD_DIR)) {
    console.error('오류: dist-native 폴더를 찾을 수 없습니다.');
    console.error('먼저 웹 프로젝트 루트에서 "npm run build:native"를 실행하세요.');
    process.exit(1);
  }

  // index.html 읽기
  const indexPath = path.join(WEB_BUILD_DIR, 'index.html');
  if (!fs.existsSync(indexPath)) {
    console.error('오류: index.html을 찾을 수 없습니다.');
    process.exit(1);
  }

  let htmlContent = fs.readFileSync(indexPath, 'utf-8');

  // 필요한 메타 태그 추가 (모바일 최적화)
  const mobileMetaTags = `
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <meta name="mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  `;

  // <head> 태그 뒤에 모바일 메타 태그 삽입
  htmlContent = htmlContent.replace('<head>', '<head>' + mobileMetaTags);

  // src 폴더가 없으면 생성
  const srcDir = path.dirname(OUTPUT_FILE);
  if (!fs.existsSync(srcDir)) {
    fs.mkdirSync(srcDir, { recursive: true });
  }

  // TypeScript 모듈로 변환
  const tsContent = `/**
 * 이 파일은 자동 생성되었습니다.
 * 직접 수정하지 마세요.
 *
 * 생성 명령어: npm run copy-web
 * 원본: dist-native/index.html
 */

export const WEB_HTML_CONTENT = ${JSON.stringify(htmlContent)};
`;

  fs.writeFileSync(OUTPUT_FILE, tsContent, 'utf-8');

  console.log('완료! 웹 콘텐츠가 다음 경로에 저장되었습니다:');
  console.log(OUTPUT_FILE);

  // HTML 파일도 assets/web에 복사 (백업용)
  const assetsWebDir = path.join(__dirname, '../assets/web');
  if (!fs.existsSync(assetsWebDir)) {
    fs.mkdirSync(assetsWebDir, { recursive: true });
  }
  fs.copyFileSync(indexPath, path.join(assetsWebDir, 'index.html'));
  console.log('HTML 백업 파일도 assets/web에 복사되었습니다.');
}

main().catch(console.error);
