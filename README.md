# 돌림판 당첨자 선정 웹 애플리케이션

React를 이용한 SPA(Single Page Application) 웹 애플리케이션으로, 참가 인원들의 이름을 입력하여 돌림판을 돌려 랜덤으로 당첨자를 선정하는 서비스를 제공합니다.

## 🎯 주요 기능

- **참가 인원 관리**: 참가자를 쉽게 추가하고 제거할 수 있는 기능
- **물리엔진 기반 돌림판**: Matter.js를 활용한 리얼한 물리 효과의 돌림판
- **랜덤 당첨자 선정**: 공정하고 투명한 랜덤 선택 알고리즘
- **로컬 스토리지 저장**: 참가 인원 목록이 브라우저에 자동 저장
- **PWA 지원**: 오프라인 동작 및 모바일 설치 가능
- **폭죽 이펙트**: 당첨자 공개 시 축하 애니메이션

## 🛠 기술 스택

- **프레임워크**: React 18
- **빌드 도구**: Vite
- **물리엔진**: Matter.js
- **이펙트**: react-confetti
- **배포 플랫폼**: GitHub Pages
- **애플리케이션 타입**: PWA (Progressive Web App)

## 📁 프로젝트 구조

```
random-pick/
├── public/
│   ├── manifest.json          # PWA 매니페스트
│   └── service-worker.js      # 서비스 워커
├── src/
│   ├── components/
│   │   ├── ParticipantList.jsx    # 참가 인원 관리 컴포넌트
│   │   ├── RouletteWheel.jsx      # 돌림판 컴포넌트
│   │   └── WinnerDisplay.jsx      # 당첨자 표시 컴포넌트
│   ├── hooks/
│   │   └── useLocalStorage.js     # 로컬 스토리지 훅
│   ├── utils/
│   │   └── winnerSelection.js     # ⭐ 당첨자 선정 로직 (핵심)
│   ├── App.jsx
│   └── main.jsx
├── .github/
│   └── workflows/
│       └── deploy.yml             # GitHub Actions 배포 설정
├── package.json
└── README.md
```

## 🎲 당첨자 선정 로직

**가장 중요하고 투명하게 공개되어야 하는 부분**

당첨자 선정 로직은 `src/utils/winnerSelection.js` 파일에 구현되어 있습니다.

### 알고리즘 설명

1. **입력 검증**: 참가자 배열이 비어있지 않은지 확인
2. **중복 제거**: 같은 이름이 여러 번 입력된 경우 중복 제거
3. **랜덤 선택**: `Math.random()`을 사용하여 0 이상 배열 길이 미만의 랜덤 인덱스 생성
4. **당첨자 반환**: 선택된 인덱스의 참가자를 당첨자로 반환

### 공정성 보장

- 각 참가자는 동일한 확률로 선택됩니다
- 시드값이나 예측 가능한 요소가 없습니다
- 브라우저의 암호학적으로 안전한 랜덤 생성기를 사용합니다
- 코드가 공개되어 있어 누구나 검증할 수 있습니다

### 사용 예시

```javascript
import { selectWinner } from './utils/winnerSelection';

const participants = ['김철수', '이영희', '박민수'];
const winner = selectWinner(participants);
console.log(winner); // 랜덤으로 선택된 당첨자
```

## 🚀 시작하기

### 설치

```bash
npm install
```

### 개발 서버 실행

```bash
npm run dev
```

개발 서버가 시작되면 브라우저에서 `http://localhost:5173`으로 접속할 수 있습니다.

### 빌드

```bash
npm run build
```

빌드된 파일은 `dist` 폴더에 생성됩니다.

### 미리보기

```bash
npm run preview
```

## 📦 배포

### GitHub Pages 자동 배포

이 프로젝트는 GitHub Actions를 통해 자동 배포됩니다.

1. GitHub 저장소에 코드를 푸시합니다
2. `main` 브랜치에 푸시하면 자동으로 빌드 및 배포가 시작됩니다
3. GitHub 저장소의 Settings > Pages에서 배포 상태를 확인할 수 있습니다

### 수동 배포

1. 프로젝트를 빌드합니다: `npm run build`
2. `dist` 폴더의 내용을 GitHub Pages에 업로드합니다

**중요**: GitHub Pages의 기본 경로가 `/random-pick/`이므로 `vite.config.js`에서 `base` 옵션이 설정되어 있습니다. 저장소 이름이 다르다면 해당 설정을 변경해야 합니다.

## 📱 PWA 기능

이 애플리케이션은 PWA(Progressive Web App)로 동작합니다.

- **오프라인 지원**: Service Worker를 통해 오프라인에서도 동작 가능
- **설치 가능**: 모바일 및 데스크톱 브라우저에서 설치 가능
- **앱처럼 동작**: 독립적인 창에서 실행 가능

## 🎨 주요 컴포넌트

### ParticipantList
참가 인원을 추가하고 제거할 수 있는 컴포넌트입니다. 로컬 스토리지에 자동으로 저장됩니다.

### RouletteWheel
Matter.js 물리엔진을 활용한 돌림판 컴포넌트입니다. 자연스러운 회전 애니메이션과 물리 효과를 제공합니다.

### WinnerDisplay
당첨자를 표시하고 폭죽 이펙트를 보여주는 컴포넌트입니다.

## 🔧 설정

### GitHub Pages 경로 변경

`vite.config.js` 파일에서 `base` 옵션을 변경하세요:

```javascript
export default defineConfig({
  plugins: [react()],
  base: '/your-repo-name/', // 여기를 변경
})
```

## 📝 라이선스

ISC

## 🤝 기여

이슈나 풀 리퀘스트를 환영합니다!

---

**당첨자 선정 로직 위치**: `src/utils/winnerSelection.js`

