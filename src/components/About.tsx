/**
 * About 페이지 컴포넌트
 *
 * 라우팅 예제를 보여주기 위한 페이지입니다.
 */
export function About() {
  return (
    <div className="page">
      <h2>About</h2>
      <p>
        이 페이지는 라우팅 예제입니다.
      </p>
      <p>
        웹뷰에서 file:// 프로토콜로 로드할 때는 HashRouter를 사용해야 합니다.
        URL이 <code>#/about</code> 형태로 표시되며, 이를 통해 새로고침 없이
        페이지 전환이 가능합니다.
      </p>

      <div className="code-block">
        <code>
          {`// src/main.tsx
const isFileProtocol = window.location.protocol === 'file:';
const Router = isFileProtocol ? HashRouter : BrowserRouter;`}
        </code>
      </div>

      <p>
        일반 웹 서버(http://)에서 실행할 때는 자동으로 BrowserRouter가 사용됩니다.
      </p>
    </div>
  );
}
