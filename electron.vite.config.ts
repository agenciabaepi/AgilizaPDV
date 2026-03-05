import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: resolve(__dirname, 'electron/main.ts'),
        output: {
          entryFileNames: 'main.js'
        }
      },
      outDir: 'out/main'
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: resolve(__dirname, 'electron/preload.ts'),
        output: {
          entryFileNames: 'preload.js'
        }
      },
      outDir: 'out/preload'
    }
  },
  renderer: {
    root: 'renderer',
    plugins: [react()],
    build: {
      rollupOptions: {
        input: resolve(__dirname, 'renderer/index.html')
      },
      outDir: 'out/renderer'
    }
  }
})
