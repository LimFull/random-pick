import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter, BrowserRouter } from 'react-router-dom'
import App from './App.tsx'

// file:// 프로토콜에서는 HashRouter 사용 (URL에 # 사용)
// 일반 웹 서버에서는 BrowserRouter 사용
const isFileProtocol = window.location.protocol === 'file:';
const Router = isFileProtocol ? HashRouter : BrowserRouter;
const basename = isFileProtocol ? '' : (import.meta.env.BASE_URL || '/');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Router basename={basename}>
      <App />
    </Router>
  </StrictMode>,
)

// 개발 모드에서는 Service Worker 해제
if ('serviceWorker' in navigator && import.meta.env.DEV) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => {
      registration.unregister();
      console.log('Service Worker 해제됨 (개발 모드)');
    });
  });
}

// Service Worker 등록 (프로덕션에서만)
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    const baseUrl = import.meta.env.BASE_URL;
    navigator.serviceWorker
      .register(`${baseUrl}service-worker.js`, { updateViaCache: 'none' })
      .then((registration) => {
        console.log('Service Worker 등록 성공:', registration.scope);
        
        // Service Worker 업데이트 확인
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // 새 버전이 설치되었고, 현재 페이지가 제어되고 있으면
                // 사용자에게 새로고침을 안내하거나 자동 새로고침
                console.log('새 버전의 Service Worker가 설치되었습니다.');
                window.location.reload();
              }
            });
          }
        });
      })
      .catch((error) => {
        console.log('Service Worker 등록 실패:', error);
      });
    
    // 주기적으로 업데이트 확인
    setInterval(() => {
      navigator.serviceWorker.getRegistration().then((registration) => {
        if (registration) {
          registration.update();
        }
      });
    }, 60000); // 1분마다 확인
  });
}

