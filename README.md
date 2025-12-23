# WebView Template

React Native 웹뷰에서 사용할 수 있는 **단일 HTML 파일**을 생성하기 위한 템플릿입니다.

## 주요 기능

- **단일 HTML 빌드**: `vite-plugin-singlefile`을 사용하여 모든 JS/CSS를 하나의 HTML 파일로 번들링
- **이미지 인라인화**: 빌드 시 이미지를 base64로 변환하여 HTML에 포함
- **웹뷰 라우팅 지원**: `file://` 프로토콜에서도 동작하는 HashRouter 자동 적용
- **Tailwind CSS**: 스타일링을 위한 Tailwind CSS 내장

## 빠른 시작

```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run dev

# 프로덕션 빌드
npm run build
```

빌드 후 `dist/index.html` 파일이 생성됩니다. 이 파일을 React Native 앱의 웹뷰에서 로드하면 됩니다.

---

## 이미지 사용법

웹뷰에서 이미지를 사용하는 두 가지 방법이 있습니다.

### 방법 1: public 폴더 이미지 (권장)

`public/images` 폴더에 이미지를 넣고 경로로 참조합니다.

```tsx
// 컴포넌트에서 사용
<img src="./images/my-icon.png" alt="My Icon" />
```

**빌드 과정:**
1. `npm run build` 실행
2. Vite가 `public/images`를 `dist/images`로 복사
3. `scripts/inline-images.js`가 모든 이미지를 base64로 변환하여 HTML에 인라인화

**지원 형식:** PNG, JPG, JPEG, GIF, SVG, WebP, ICO

### 방법 2: src/assets 이미지 (import 방식)

`src/assets` 폴더에 이미지를 넣고 import로 사용합니다.

```tsx
// 이미지 import
import logo from '../assets/logo.png';

// 컴포넌트에서 사용
<img src={logo} alt="Logo" />
```

`vite-plugin-singlefile`을 사용하기 때문에 **이미지 크기와 관계없이 모두 base64로 인라인화**됩니다.

---

## 라우팅 사용법

이 템플릿은 웹뷰에서 동작하도록 특별한 라우팅 설정이 적용되어 있습니다.

### 기본 원리

```tsx
// src/main.tsx
const isFileProtocol = window.location.protocol === 'file:';
const Router = isFileProtocol ? HashRouter : BrowserRouter;
```

- **file:// 프로토콜** (웹뷰 로컬 파일): `HashRouter` 사용 → URL이 `#/about` 형태
- **http:// 프로토콜** (웹 서버): `BrowserRouter` 사용 → URL이 `/about` 형태

### 라우트 추가하기

`src/App.tsx`에서 라우트를 추가합니다:

```tsx
import { Routes, Route, Link } from 'react-router-dom';
import { MyPage } from './components/MyPage';

function App() {
  return (
    <div>
      {/* 네비게이션 링크 */}
      <Link to="/mypage">My Page</Link>

      {/* 라우트 정의 */}
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/mypage" element={<MyPage />} />
      </Routes>
    </div>
  );
}
```

### 주의사항

- `<a href>` 대신 반드시 `<Link to>`를 사용하세요
- 웹뷰에서 새로고침하면 현재 라우트가 유지됩니다 (HashRouter 덕분)

---

## 프로젝트 구조

```
├── public/
│   └── images/           # 이미지 파일 (빌드 시 인라인화됨)
├── src/
│   ├── assets/           # import로 사용할 에셋
│   ├── components/       # React 컴포넌트
│   ├── App.tsx           # 메인 앱 컴포넌트
│   ├── App.css           # 스타일
│   └── main.tsx          # 엔트리 포인트 (라우터 설정)
├── scripts/
│   └── inline-images.js  # 이미지 인라인화 스크립트
├── index.html            # HTML 템플릿
├── vite.config.ts        # Vite 설정
└── package.json
```

---

## React Native 웹뷰 연동

### 1. 빌드된 HTML 복사

```bash
# 빌드
npm run build

# dist/index.html을 React Native 프로젝트로 복사
cp dist/index.html ../my-rn-app/assets/webview.html
```

### 2. Expo 프로젝트 (권장)

Expo에서는 별도의 네이티브 설정 없이 바로 사용할 수 있습니다.

```tsx
import { WebView } from 'react-native-webview';

// assets 폴더에 webview.html을 넣고 require로 로드
const htmlSource = require('./assets/webview.html');

function MyWebView() {
  return (
    <WebView
      source={htmlSource}
      originWhitelist={['*']}
    />
  );
}
```

### 3. Bare React Native 프로젝트

Expo 없이 순수 React Native를 사용하는 경우, 플랫폼별 설정이 필요합니다.

```tsx
import { WebView } from 'react-native-webview';
import { Platform } from 'react-native';

// Android
const androidSource = { uri: 'file:///android_asset/webview.html' };

// iOS
const iosSource = require('./assets/webview.html');

function MyWebView() {
  return (
    <WebView
      source={Platform.OS === 'ios' ? iosSource : androidSource}
      originWhitelist={['*']}
    />
  );
}
```

#### iOS 설정 (Xcode) - Bare RN만 해당

1. `webview.html`을 Xcode 프로젝트에 드래그하여 추가
2. "Copy items if needed" 체크
3. Target Membership 확인

#### Android 설정 - Bare RN만 해당

1. `android/app/src/main/assets/` 폴더 생성 (없는 경우)
2. `webview.html`을 해당 폴더에 복사

---

## Vite 설정

`vite.config.ts`의 주요 설정:

```ts
export default defineConfig({
  plugins: [
    react(),
    viteSingleFile(),  // 단일 파일 빌드
    tailwindcss()
  ],
  base: './',  // 상대 경로 (웹뷰 필수)
  build: {
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
})
```

---

## 스크립트

| 명령어 | 설명 |
|--------|------|
| `npm run dev` | 개발 서버 실행 (http://localhost:5173) |
| `npm run build` | 프로덕션 빌드 + 이미지 인라인화 |
| `npm run preview` | 빌드 결과물 미리보기 |

---

## 문제 해결

### 이미지가 표시되지 않음

1. 이미지 경로가 `./images/`로 시작하는지 확인
2. 빌드 콘솔에서 인라인화 로그 확인
3. `dist/index.html`에서 base64 문자열 확인

### 라우팅이 동작하지 않음

1. `<Link>` 컴포넌트를 사용하고 있는지 확인
2. 브라우저 콘솔에서 에러 확인
3. URL에 `#`이 포함되어 있는지 확인 (file:// 프로토콜)

### 빌드 파일이 너무 큼

1. 이미지 최적화 (TinyPNG 등 사용)
2. 불필요한 의존성 제거
3. 큰 이미지는 외부 URL로 로드 고려
