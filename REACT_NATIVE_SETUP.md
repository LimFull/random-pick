# React Native 웹뷰 설정 가이드

## 1. Assets 폴더에 파일 복사

`dist` 폴더의 모든 내용을 React Native 프로젝트의 `assets` 폴더에 복사합니다:

```
your-react-native-project/
  assets/
    index.html
    manifest.json
    icon-placeholder.svg
    assets/
      index-*.js
      index-*.css
    images/
      horse/
        ...
```

## 2. Expo를 사용하는 경우

### 2.1 패키지 설치
```bash
npm install react-native-webview
# 또는
expo install react-native-webview
```

### 2.2 WebView 컴포넌트 사용

```typescript
import { WebView } from 'react-native-webview';
import { Asset } from 'expo-asset';

function App() {
  const [htmlUri, setHtmlUri] = useState<string | null>(null);

  useEffect(() => {
    // Assets에서 HTML 파일 로드
    Asset.fromModule(require('./assets/index.html'))
      .downloadAsync()
      .then((asset) => {
        // HTML 파일의 디렉토리 경로 추출
        const htmlPath = asset.localUri || asset.uri;
        const basePath = htmlPath.substring(0, htmlPath.lastIndexOf('/') + 1);
        setHtmlUri(htmlPath);
      });
  }, []);

  if (!htmlUri) {
    return <View><Text>로딩 중...</Text></View>;
  }

  return (
    <WebView
      source={{ uri: htmlUri }}
      style={{ flex: 1 }}
      originWhitelist={['*']}
      allowFileAccess={true}
      allowUniversalAccessFromFileURLs={true}
      mixedContentMode="always"
    />
  );
}
```

### 2.3 더 간단한 방법 (로컬 서버 사용)

개발 중에는 Metro bundler와 함께 로컬 서버를 사용할 수 있습니다:

```typescript
import { WebView } from 'react-native-webview';

function App() {
  return (
    <WebView
      source={{ uri: 'http://localhost:8080' }} // 또는 실제 서버 URL
      style={{ flex: 1 }}
    />
  );
}
```

## 3. React Native CLI를 사용하는 경우

### 3.1 Android

1. `dist` 폴더의 모든 내용을 `android/app/src/main/assets/` 폴더에 복사
2. WebView 컴포넌트 사용:

```typescript
import { WebView } from 'react-native-webview';
import { Platform } from 'react-native';

function App() {
  const getLocalFileUri = () => {
    if (Platform.OS === 'android') {
      return 'file:///android_asset/index.html';
    } else {
      // iOS는 아래 참조
      return '';
    }
  };

  return (
    <WebView
      source={{ uri: getLocalFileUri() }}
      style={{ flex: 1 }}
      originWhitelist={['*']}
      allowFileAccess={true}
      allowUniversalAccessFromFileURLs={true}
      mixedContentMode="always"
    />
  );
}
```

### 3.2 iOS

1. `dist` 폴더의 모든 내용을 Xcode 프로젝트에 추가 (Copy Bundle Resources)
2. WebView 컴포넌트 사용:

```typescript
import { WebView } from 'react-native-webview';
import { Platform } from 'react-native';

function App() {
  const getLocalFileUri = () => {
    if (Platform.OS === 'ios') {
      const path = require('./assets/index.html');
      return path;
    } else {
      // Android는 위 참조
      return '';
    }
  };

  return (
    <WebView
      source={{ uri: getLocalFileUri() }}
      style={{ flex: 1 }}
      originWhitelist={['*']}
      allowFileAccess={true}
      allowUniversalAccessFromFileURLs={true}
      mixedContentMode="always"
    />
  );
}
```

## 4. 권장 방법: 로컬 서버 사용

가장 간단하고 안정적인 방법은 빌드된 파일을 로컬 서버에서 제공하는 것입니다:

### 4.1 간단한 HTTP 서버 실행

```bash
# dist 폴더에서
cd dist
npx serve -p 8080
# 또는 Python 사용
python -m http.server 8080
```

### 4.2 WebView에서 로드

```typescript
import { WebView } from 'react-native-webview';

function App() {
  // 개발 환경
  const uri = __DEV__ 
    ? 'http://localhost:8080'  // 또는 실제 IP 주소
    : 'https://your-production-url.com';

  return (
    <WebView
      source={{ uri }}
      style={{ flex: 1 }}
      javaScriptEnabled={true}
      domStorageEnabled={true}
    />
  );
}
```

## 5. 주의사항

1. **Service Worker**: 웹뷰에서는 Service Worker가 제대로 작동하지 않을 수 있습니다. 현재 코드는 프로덕션에서만 등록되므로 문제없을 가능성이 높습니다.

2. **CORS 문제**: 로컬 파일을 로드할 때 CORS 문제가 발생할 수 있습니다. `originWhitelist={['*']}` 설정이 도움이 됩니다.

3. **파일 경로**: 모든 경로가 상대 경로(`./`)로 설정되어 있으므로, HTML 파일과 같은 디렉토리에 모든 파일이 있어야 합니다.

4. **네트워크 권한**: Android의 경우 `AndroidManifest.xml`에 인터넷 권한이 필요할 수 있습니다:
   ```xml
   <uses-permission android:name="android.permission.INTERNET" />
   ```

