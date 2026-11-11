import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron/simple'
import { resolve } from 'path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const supabaseDefines = {
    'process.env.SUPABASE_URL': JSON.stringify(
      env.VITE_SUPABASE_URL || env.SUPABASE_URL || ''
    ),
    'process.env.SUPABASE_ANON_KEY': JSON.stringify(
      env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || ''
    )
  }

  return {
    base: './',
    plugins: [
      react(),
      electron({
        main: {
          entry: 'electron/main/index.ts',
          vite: {
            define: supabaseDefines,
            build: {
              outDir: 'dist-electron',
              rollupOptions: {
                external: ['electron', 'ws', 'electron-updater'],
                output: {
                  entryFileNames: 'main.js'
                }
              }
            }
          }
        },
        preload: {
          input: 'electron/preload/index.ts',
          vite: {
            build: {
              outDir: 'dist-electron',
              rollupOptions: {
                external: ['electron'],
                output: {
                  entryFileNames: 'preload.js'
                }
              }
            }
          }
        },
        renderer: {}
      })
    ],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src')
      }
    },
    server: {
      port: 5180
    }
  }
})
