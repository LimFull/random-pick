import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { Home } from './components/Home';
import { About } from './components/About';
import { ImageExample } from './components/ImageExample';
import './App.css';

/**
 * 메인 앱 컴포넌트
 *
 * 라우팅 예제:
 * - / : 홈 페이지
 * - /about : About 페이지
 * - /images : 이미지 사용 예제
 */
function App() {
  const location = useLocation();

  return (
    <div className="app">
      <header className="app-header">
        <h1>WebView Template</h1>
        <nav className="app-nav">
          <Link
            to="/"
            className={`nav-link ${location.pathname === '/' ? 'active' : ''}`}
          >
            Home
          </Link>
          <Link
            to="/about"
            className={`nav-link ${location.pathname === '/about' ? 'active' : ''}`}
          >
            About
          </Link>
          <Link
            to="/images"
            className={`nav-link ${location.pathname === '/images' ? 'active' : ''}`}
          >
            Images
          </Link>
        </nav>
      </header>

      <main className="app-main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="/images" element={<ImageExample />} />
        </Routes>
      </main>

      <footer className="app-footer">
        <p>WebView Template - React + Vite + SingleFile</p>
      </footer>
    </div>
  );
}

export default App;
