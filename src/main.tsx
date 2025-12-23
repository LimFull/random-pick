import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter, BrowserRouter } from 'react-router-dom'
import App from './App.tsx'

/**
 * 웹뷰 라우팅 설정
 *
 * file:// 프로토콜에서는 HashRouter 사용 (URL에 # 사용)
 * 일반 웹 서버에서는 BrowserRouter 사용
 *
 * 이 설정은 React Native 웹뷰에서 로컬 HTML 파일을 로드할 때 필수입니다.
 */
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
