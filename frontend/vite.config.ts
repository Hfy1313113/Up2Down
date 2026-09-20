import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // 显式清空产物目录：避免历史 hash 资源在 dist/ 里堆积
  build: { emptyOutDir: true },
})
