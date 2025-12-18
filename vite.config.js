import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // 개발 환경에서는 base를 '/'로, 프로덕션에서는 '/random-pick/' 사용
  const base = mode === 'production' ? '/random-pick/' : '/';
  
  return {
    plugins: [react()],
    base,
  };
})

