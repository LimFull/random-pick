/**
 * 홈 페이지 컴포넌트
 */
export function Home() {
  return (
    <div className="page">
      <h2>Welcome!</h2>
      <p>
        이 템플릿은 React Native 웹뷰에서 사용할 수 있는
        단일 HTML 파일을 생성하기 위한 프로젝트입니다.
      </p>
      <p>
        주요 기능:
      </p>
      <ul style={{ marginLeft: '1.5rem', marginBottom: '1rem' }}>
        <li>vite-plugin-singlefile을 사용한 단일 HTML 빌드</li>
        <li>이미지 파일의 base64 인라인화</li>
        <li>file:// 프로토콜 지원 라우팅 (HashRouter)</li>
        <li>Tailwind CSS 지원</li>
      </ul>
      <p>
        상단 네비게이션을 통해 다른 페이지들을 확인해보세요.
      </p>
    </div>
  );
}
