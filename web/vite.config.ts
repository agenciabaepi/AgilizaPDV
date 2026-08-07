import { realpathSync } from 'node:fs'
import { resolve } from 'path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { assinaturasDevApiPlugin } from './vite-plugin-assinaturas-dev'
import { bannerStudioAliasPlugin } from './vite-plugin-banner-studio'

const bannerRoot = realpathSync(resolve(__dirname, 'banner-src'))

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [
      react(),
      vue({
        include: [/\.vue$/],
      }),
      tailwindcss(),
      bannerStudioAliasPlugin(bannerRoot, resolve(__dirname, 'src')),
      assinaturasDevApiPlugin(env),
    ],
    resolve: {
      dedupe: ['vue', 'fabric', 'pinia'],
      alias: {
        '@banner-root': resolve(bannerRoot, 'src'),
        fabric: resolve(__dirname, 'node_modules/fabric'),
        'fabric/extensions/aligning_guidelines': resolve(
          __dirname,
          'node_modules/fabric/dist-extensions/aligning_guidelines/index.mjs',
        ),
      },
    },
    server: {
      fs: {
        allow: [resolve(__dirname), bannerRoot],
      },
      proxy: {
        '/api/fiscal': {
          target: process.env.VITE_FISCAL_API_BASE || 'https://agilizapdv.app',
          changeOrigin: true,
          secure: true,
        },
      },
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'index.html'),
          bannerStudio: resolve(__dirname, 'banner-studio/index.html'),
          bannerPlayer: resolve(__dirname, 'banner-player/index.html'),
        },
      },
    },
    ssr: {
      external: [],
    },
    optimizeDeps: {
      include: ['fabric', 'vue', 'pinia', '@vueuse/core'],
    },
  }
})
