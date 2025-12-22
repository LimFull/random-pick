# Assets 폴더

이 폴더에는 다음 이미지 파일들이 필요합니다:

## 필수 아이콘 파일

1. **icon.png** (1024x1024)
   - 앱 아이콘
   - iOS App Store, Android Play Store에서 사용

2. **splash-icon.png** (288x288 권장)
   - 스플래시 화면에 표시될 아이콘

3. **adaptive-icon.png** (1024x1024)
   - Android 적응형 아이콘의 전경 이미지

4. **favicon.png** (48x48)
   - 웹 파비콘 (Expo Web 사용 시)

## web 폴더

`web/` 폴더는 웹 빌드 결과물이 저장되는 곳입니다.
`npm run copy-web` 스크립트 실행 시 자동으로 생성됩니다.

## 아이콘 생성 팁

Expo의 `@expo/cli`를 사용하면 아이콘을 쉽게 생성할 수 있습니다:

```bash
npx expo-cli generate-icon ./icon.png
```

또는 https://icon.kitchen/ 같은 온라인 도구를 사용하세요.
