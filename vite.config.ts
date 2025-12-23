import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'
import tailwindcss from '@tailwindcss/vite'


// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), viteSingleFile(), tailwindcss()],
  base: './', // React Native 웹뷰를 위한 상대 경로 설정
  server: {
    host: '0.0.0.0', // 모든 네트워크 인터페이스에 바인딩하여 외부 IP 접속 허용
    port: 5173,
  },
  build: {
    // 단일 파일 빌드를 위한 설정
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
})

