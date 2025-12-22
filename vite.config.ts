import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: mode === 'native'
    ? [react(), viteSingleFile()] // native 모드에서는 단일 파일로 빌드
    : [react()],
  // 'native' 모드일 때는 상대 경로 사용 (WebView용)
  // 그 외에는 GitHub Pages용 경로 사용
  base: mode === 'native' ? './' : '/random-pick/',
  build: {
    // native 모드일 때는 dist-native 폴더에 빌드
    outDir: mode === 'native' ? 'dist-native' : 'dist',
    // native 모드에서는 이미지를 base64로 인라인화
    assetsInlineLimit: mode === 'native' ? 100000000 : 4096,
  },
}))
