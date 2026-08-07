import { fileURLToPath, URL } from 'node:url'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

const outDir = process.env.BANNER_OUT_DIR
  ? resolve(process.env.BANNER_OUT_DIR)
  : 'dist'

export default defineConfig({
  base: '/banner-studio/',
  plugins: [vue(), tailwindcss()],
  build: {
    outDir,
    emptyOutDir: true,
  },
  server: {
    port: 5174,
    strictPort: true,
    cors: true,
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      'fabric/extensions/aligning_guidelines': fileURLToPath(
        new URL('./node_modules/fabric/dist-extensions/aligning_guidelines/index.mjs', import.meta.url),
      ),
    },
  },
})
