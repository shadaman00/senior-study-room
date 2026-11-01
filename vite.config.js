import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages 프로젝트 사이트는 /<저장소이름>/ 아래에서 서빙되므로
// 배포 워크플로우에서 VITE_BASE 로 경로를 넘겨준다. 로컬에서는 '/'.
export default defineConfig({
  base: process.env.VITE_BASE || '/',
  plugins: [react()],
})
