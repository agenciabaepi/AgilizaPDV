import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Plugin } from 'vite'

const BANNER_PATH_MARKERS = ['/banner-src/', '/banner/']
const EXTENSIONS = ['.ts', '.tsx', '.vue', '.js', '.mjs', '.json']

function isBannerImporter(importer: string): boolean {
  const normalized = importer.replace(/\\/g, '/')
  return BANNER_PATH_MARKERS.some((marker) => normalized.includes(marker))
}

function resolveWithExtensions(basePath: string): string | null {
  if (existsSync(basePath)) return basePath
  for (const ext of EXTENSIONS) {
    const candidate = `${basePath}${ext}`
    if (existsSync(candidate)) return candidate
  }
  return null
}

export function bannerStudioAliasPlugin(bannerRoot: string, appRoot: string): Plugin {
  return {
    name: 'banner-studio-alias',
    enforce: 'pre',
    resolveId(source, importer) {
      if (!source.startsWith('@/')) return null
      const rel = source.slice(2)
      const base = importer && isBannerImporter(importer)
        ? resolve(bannerRoot, 'src', rel)
        : resolve(appRoot, rel)
      return resolveWithExtensions(base)
    },
  }
}
