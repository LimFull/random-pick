// 빌드 시점의 타임스탬프를 버전으로 사용 (배포 시마다 변경됨)
const CACHE_NAME = 'random-pick-v2';

// Service Worker의 위치에서 base URL 추출
const getBaseUrl = () => {
  const swLocation = self.location.pathname;
  // service-worker.js의 경로에서 base URL 추출
  // 예: /random-pick/service-worker.js -> /random-pick/
  const baseUrl = swLocation.substring(0, swLocation.lastIndexOf('/') + 1);
  return baseUrl;
};

const BASE_URL = getBaseUrl();
const urlsToCache = [
  `${BASE_URL}manifest.json`,
];

// 설치 이벤트
self.addEventListener('install', (event) => {
  // 이전 Service Worker를 즉시 교체하도록 skipWaiting 사용
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
  );
});

// 활성화 이벤트
self.addEventListener('activate', (event) => {
  // 모든 클라이언트를 즉시 제어하도록 claim 사용
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              return caches.delete(cacheName);
            }
          })
        );
      })
    ])
  );
});

// fetch 이벤트
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // HTML 파일과 루트 경로는 네트워크 우선 전략 사용 (캐시 문제 방지)
  const isHtmlRequest = event.request.mode === 'navigate' || 
      url.pathname.endsWith('.html') || 
      url.pathname === BASE_URL ||
      url.pathname === BASE_URL.slice(0, -1); // 마지막 슬래시 제거
  
  if (isHtmlRequest) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // 네트워크 요청 성공 시 응답 반환 (캐시하지 않음)
          return response;
        })
        .catch(() => {
          // 네트워크 실패 시에만 캐시 확인
          return caches.match(event.request)
            .then((cachedResponse) => {
              // 캐시에도 없으면 기본 페이지 반환
              return cachedResponse || caches.match(`${BASE_URL}index.html`);
            });
        })
    );
  } else {
    // 정적 자산(JS, CSS, 이미지 등)은 캐시 우선 전략 사용
    event.respondWith(
      caches.match(event.request)
        .then((response) => {
          if (response) {
            return response;
          }
          // 캐시에 없으면 네트워크 요청 후 캐시에 저장
          return fetch(event.request).then((response) => {
            // 응답이 유효한 경우에만 캐시에 저장
            if (response && response.status === 200) {
              const responseToCache = response.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, responseToCache);
              });
            }
            return response;
          });
        })
    );
  }
});

