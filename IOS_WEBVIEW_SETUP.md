# iOS 웹뷰 설정 가이드

## 1. 파일 준비

`dist` 폴더의 모든 내용을 React Native 프로젝트의 `assets` 폴더에 복사합니다:

```bash
# dist 폴더의 모든 내용을 assets 폴더로 복사
cp -r dist/* your-react-native-project/assets/
```

폴더 구조:
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
        tile000.png
        ...
```

## 2. Expo를 사용하는 경우 (권장)

### 2.1 패키지 설치

```bash
cd your-react-native-project
npx expo install react-native-webview
```

### 2.2 app.json 설정

`app.json` 파일에 assets 폴더를 등록합니다:

```json
{
  "expo": {
    "name": "랜덤픽",
    "slug": "random-pick",
    "assetBundlePatterns": [
      "assets/**/*"
    ],
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.yourcompany.randompick"
    }
  }
}
```

### 2.3 WebView 컴포넌트 구현

**방법 A: Asset을 사용한 로컬 파일 로드 (권장)**

```typescript
import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { Asset } from 'expo-asset';

export default function App() {
  const [htmlUri, setHtmlUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHTML();
  }, []);

  const loadHTML = async () => {
    try {
      // HTML 파일을 Asset으로 로드
      const asset = Asset.fromModule(require('./assets/index.html'));
      await asset.downloadAsync();
      
      // iOS에서는 localUri를 사용
      const uri = asset.localUri || asset.uri;
      setHtmlUri(uri);
      setLoading(false);
    } catch (error) {
      console.error('HTML 파일 로드 실패:', error);
      setLoading(false);
    }
  };

  if (loading || !htmlUri) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#4a90e2" />
      </View>
    );
  }

  return (
    <WebView
      source={{ uri: htmlUri }}
      style={styles.webview}
      originWhitelist={['*']}
      allowFileAccess={true}
      allowUniversalAccessFromFileURLs={true}
      javaScriptEnabled={true}
      domStorageEnabled={true}
      startInLoadingState={true}
      scalesPageToFit={true}
      onError={(syntheticEvent) => {
        const { nativeEvent } = syntheticEvent;
        console.error('WebView 오류:', nativeEvent);
      }}
      onHttpError={(syntheticEvent) => {
        const { nativeEvent } = syntheticEvent;
        console.error('HTTP 오류:', nativeEvent);
      }}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  webview: {
    flex: 1,
  },
});
```

**방법 B: 로컬 서버 사용 (개발 환경)**

개발 중에는 로컬 서버를 사용하는 것이 더 간단할 수 있습니다:

```typescript
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import Constants from 'expo-constants';

export default function App() {
  // 개발 환경에서는 로컬 서버 사용
  // dist 폴더에서: npx serve -p 8080
  const uri = __DEV__ 
    ? 'http://localhost:8080'  // 시뮬레이터의 경우
    // 실제 기기의 경우 Mac의 IP 주소 사용: 'http://192.168.x.x:8080'
    : 'https://your-production-url.com';

  return (
    <View style={styles.container}>
      <WebView
        source={{ uri }}
        style={styles.webview}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        scalesPageToFit={true}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: Constants.statusBarHeight,
  },
  webview: {
    flex: 1,
  },
});
```

**실제 기기에서 테스트하는 경우:**

1. Mac과 iPhone이 같은 Wi-Fi에 연결되어 있는지 확인
2. Mac의 로컬 IP 주소 확인:
   ```bash
   ifconfig | grep "inet " | grep -v 127.0.0.1
   ```
3. WebView의 URI를 Mac의 IP로 변경:
   ```typescript
   const uri = 'http://192.168.x.x:8080'; // Mac의 실제 IP 주소
   ```

## 3. React Native CLI를 사용하는 경우

### 3.1 Xcode 프로젝트에 파일 추가

1. Xcode에서 프로젝트 열기: `ios/YourProject.xcworkspace`
2. 프로젝트 네비게이터에서 프로젝트 선택
3. `File` → `Add Files to "YourProject"...`
4. `dist` 폴더의 모든 파일 선택
5. **중요**: "Create folder references" 선택 (파란색 폴더 아이콘)
6. "Add to targets"에서 앱 타겟 체크
7. "Copy items if needed" 체크

### 3.2 WebView 컴포넌트 구현

```typescript
import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { WebView } from 'react-native-webview';

export default function App() {
  // iOS 번들에서 HTML 파일 로드
  const htmlUri = Platform.select({
    ios: require('./assets/index.html'), // 번들에 포함된 파일
    android: 'file:///android_asset/index.html',
  });

  return (
    <View style={styles.container}>
      <WebView
        source={{ uri: htmlUri }}
        style={styles.webview}
        originWhitelist={['*']}
        allowFileAccess={true}
        allowUniversalAccessFromFileURLs={true}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        scalesPageToFit={true}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  webview: {
    flex: 1,
  },
});
```

### 3.3 Info.plist 설정 (필요한 경우)

`ios/YourProject/Info.plist`에 다음 설정 추가:

```xml
<key>NSAppTransportSecurity</key>
<dict>
  <key>NSAllowsArbitraryLoads</key>
  <true/>
  <!-- 또는 특정 도메인만 허용 -->
  <key>NSExceptionDomains</key>
  <dict>
    <key>localhost</key>
    <dict>
      <key>NSExceptionAllowsInsecureHTTPLoads</key>
      <true/>
    </dict>
  </dict>
</dict>
```

## 4. iOS 특정 주의사항

### 4.1 파일 경로 문제

iOS에서는 상대 경로가 제대로 작동하지 않을 수 있습니다. 모든 경로가 `./`로 시작하는 상대 경로로 설정되어 있으므로, HTML 파일과 같은 디렉토리에 모든 파일이 있어야 합니다.

### 4.2 Service Worker

iOS 웹뷰에서는 Service Worker가 제한적으로 작동합니다. 현재 코드는 프로덕션에서만 등록되므로 문제없을 가능성이 높지만, 필요시 비활성화할 수 있습니다.

### 4.3 CORS 및 보안

- `allowUniversalAccessFromFileURLs={true}` 설정으로 로컬 파일 간 접근 허용
- `originWhitelist={['*']}` 설정으로 모든 출처 허용

### 4.4 메모리 관리

큰 JavaScript 번들(현재 약 1.4MB)을 사용하므로, 메모리 사용량을 모니터링하세요.

## 5. 빌드 및 테스트

### Expo

```bash
# 개발 빌드
npx expo run:ios

# 프로덕션 빌드
eas build --platform ios
```

### React Native CLI

```bash
# 개발 빌드
cd ios
pod install
cd ..
npx react-native run-ios

# 프로덕션 빌드
npx react-native run-ios --configuration Release
```

## 6. 문제 해결

### 문제: 흰 화면만 보임

**해결책:**
1. 콘솔 로그 확인: `onError`와 `onHttpError` 핸들러 추가
2. 파일 경로 확인: 모든 파일이 올바른 위치에 있는지 확인
3. `allowFileAccess={true}` 설정 확인

### 문제: 이미지나 CSS가 로드되지 않음

**해결책:**
1. 모든 파일이 같은 디렉토리에 있는지 확인
2. 상대 경로(`./`)가 올바르게 설정되어 있는지 확인
3. Xcode에서 파일이 "Copy Bundle Resources"에 포함되어 있는지 확인

### 문제: JavaScript 오류 발생

**해결책:**
1. `javaScriptEnabled={true}` 설정 확인
2. 콘솔에서 실제 오류 메시지 확인
3. Service Worker 관련 오류인 경우 비활성화 고려

## 7. 최종 체크리스트

- [ ] `dist` 폴더의 모든 파일을 `assets` 폴더에 복사
- [ ] `react-native-webview` 패키지 설치
- [ ] `app.json`에 `assetBundlePatterns` 설정 (Expo)
- [ ] Xcode에 파일 추가 및 "Copy Bundle Resources" 확인 (RN CLI)
- [ ] WebView 컴포넌트에 필요한 props 설정
- [ ] iOS 시뮬레이터 또는 실제 기기에서 테스트

