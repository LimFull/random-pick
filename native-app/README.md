# Random Pick - React Native App

기존 React + Phaser 웹 게임을 WebView로 감싼 React Native Expo 앱입니다.

## 왜 WebView를 사용하나요?

이 프로젝트는 Phaser.js를 사용한 게임(말 달리기, 축구 게임)을 포함하고 있습니다.
Phaser는 Canvas/WebGL 기반의 웹 게임 엔진으로, React Native에서 직접 실행할 수 없습니다.
따라서 웹 빌드를 WebView로 로드하는 방식을 채택했습니다.

## 프로젝트 구조

```
native-app/
├── app/                  # Expo Router 페이지
│   ├── _layout.tsx       # 레이아웃 컴포넌트
│   └── index.tsx         # 메인 화면 (WebView)
├── assets/               # 앱 아이콘 및 리소스
│   └── web/              # 빌드된 웹 파일 (자동 생성)
├── scripts/
│   └── copy-web-build.js # 웹 빌드 복사 스크립트
├── src/
│   └── webContent.ts     # 웹 HTML 콘텐츠 (자동 생성)
├── app.json              # Expo 설정
├── package.json
└── tsconfig.json
```

## 설치 및 실행

### 1. 웹 프로젝트 빌드

먼저 웹 프로젝트(부모 디렉토리)의 의존성을 설치하고 빌드합니다:

```bash
# 프로젝트 루트에서
cd ..
npm install
npm run build:native
```

### 2. 웹 빌드 복사

빌드된 웹 파일을 React Native 앱으로 복사합니다:

```bash
# native-app 폴더에서
cd native-app
npm install
npm run copy-web
```

또는 한 번에 실행:

```bash
# native-app 폴더에서
npm run build:all
```

### 3. 개발 서버 실행

```bash
npm start
```

Expo Go 앱을 사용하거나 에뮬레이터/시뮬레이터에서 실행하세요.

### 4. 네이티브 빌드 (EAS Build)

프로덕션 빌드를 위해 EAS CLI를 사용합니다:

```bash
# EAS CLI 설치 (처음 한 번만)
npm install -g eas-cli

# EAS 로그인
eas login

# Android APK 빌드
eas build --platform android --profile preview

# iOS 빌드 (Apple Developer 계정 필요)
eas build --platform ios --profile preview
```

## 주요 설정

### Vite 설정 (../vite.config.ts)

웹 빌드 시 `--mode native` 옵션으로 다음이 적용됩니다:
- **상대 경로 사용**: `base: './'` (WebView에서 로컬 파일 로드용)
- **단일 파일 빌드**: `vite-plugin-singlefile`로 모든 JS/CSS 인라인화
- **이미지 인라인화**: 모든 이미지를 base64로 변환

### WebView 설정 (app/index.tsx)

- `javaScriptEnabled`: JavaScript 실행 허용
- `domStorageEnabled`: localStorage 사용 허용
- `allowFileAccess`: 파일 접근 허용

## 트러블슈팅

### "웹 콘텐츠 없음" 오류
웹 빌드가 복사되지 않았습니다. `npm run build:all`을 실행하세요.

### 이미지가 로드되지 않음
`npm run build:native`로 빌드하면 모든 이미지가 base64로 인라인됩니다.
빌드 후 `npm run copy-web`을 다시 실행하세요.

### WebView가 흰 화면으로 표시됨
개발자 도구나 `onError` 콜백을 확인하여 JavaScript 오류를 디버그하세요.

## 앱 아이콘 설정

`assets/` 폴더의 placeholder 아이콘을 실제 아이콘으로 교체하세요:
- `icon.png` (1024x1024) - 앱 아이콘
- `splash-icon.png` (288x288) - 스플래시 화면
- `adaptive-icon.png` (1024x1024) - Android 적응형 아이콘

## 라이선스

이 프로젝트는 상위 프로젝트의 라이선스를 따릅니다.
