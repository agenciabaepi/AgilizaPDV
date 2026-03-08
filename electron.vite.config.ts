import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

// Carrega .env na raiz para injetar SUPABASE_* no bundle do main (app instalado não depende de .env)
import dotenv from 'dotenv'
dotenv.config({ path: resolve(process.cwd(), '.env') })

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      define: {
        'process.env.SUPABASE_URL': JSON.stringify(process.env.SUPABASE_URL ?? ''),
        'process.env.SUPABASE_ANON_KEY': JSON.stringify(process.env.SUPABASE_ANON_KEY ?? '')
      },
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
