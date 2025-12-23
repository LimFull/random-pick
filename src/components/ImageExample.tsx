/**
 * 이미지 사용 예제 컴포넌트
 *
 * 웹뷰에서 이미지를 사용하는 두 가지 방법을 보여줍니다:
 * 1. public 폴더의 이미지 (빌드 시 인라인화됨)
 * 2. src/assets의 이미지 (import로 사용)
 */

// 방법 2: src/assets의 이미지를 import로 사용
// import exampleImage from '../assets/example.png';

export function ImageExample() {
  return (
    <div className="page">
      <h2>이미지 사용 예제</h2>

      <h3 style={{ marginTop: '1.5rem', marginBottom: '0.5rem' }}>
        방법 1: public 폴더 이미지
      </h3>
      <p>
        <code>public/images</code> 폴더에 이미지를 넣고 경로로 참조합니다.
        빌드 시 <code>scripts/inline-images.js</code>가 자동으로 base64로 변환합니다.
      </p>

      <div className="image-container">
        <div className="image-item">
          <img src="./images/sample-icon.svg" alt="Sample Icon" width="100" />
          <p>sample-icon.svg</p>
        </div>
        <div className="image-item">
          <img src="./images/sample-banner.svg" alt="Sample Banner" width="200" />
          <p>sample-banner.svg</p>
        </div>
      </div>

      <div className="code-block">
        <code>
          {`// JSX에서 이미지 사용
<img src="./images/sample-icon.svg" alt="Icon" />`}
        </code>
      </div>

      <h3 style={{ marginTop: '1.5rem', marginBottom: '0.5rem' }}>
        방법 2: import로 이미지 사용
      </h3>
      <p>
        <code>src/assets</code> 폴더에 이미지를 넣고 import 문으로 가져옵니다.
        Vite가 자동으로 base64로 인라인화합니다.
      </p>

      <div className="code-block">
        <code>
          {`// 이미지 import
import logo from '../assets/logo.png';

// JSX에서 사용
<img src={logo} alt="Logo" />`}
        </code>
      </div>

      <h3 style={{ marginTop: '1.5rem', marginBottom: '0.5rem' }}>
        지원 형식
      </h3>
      <ul style={{ marginLeft: '1.5rem' }}>
        <li>PNG, JPG, JPEG, GIF</li>
        <li>SVG</li>
        <li>WebP</li>
        <li>ICO</li>
      </ul>
    </div>
  );
}
