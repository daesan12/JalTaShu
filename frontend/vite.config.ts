import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    // 배포 경로: production '/' (기본), staging '/staging/' — Jenkins에서 VITE_BASE_PATH로 주입
    base: env.VITE_BASE_PATH || '/',
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      // 백엔드(8080) 연동 시 CORS 없이 호출하기 위한 dev 프록시 (msw 사용 중에는 영향 없음)
      proxy: {
        '/api': 'http://localhost:8080',
        '/auth': 'http://localhost:8080',
      },
    },
  }
})
