import type { BannerPreset } from '@/core/types/banner.types'

export const BANNER_PRESETS: BannerPreset[] = [
  { id: 'instagram-post', label: 'Instagram Post', width: 1080, height: 1080, category: 'social' },
  { id: 'instagram-story', label: 'Instagram Story', width: 1080, height: 1920, category: 'social' },
  { id: 'facebook-cover', label: 'Facebook Cover', width: 820, height: 312, category: 'social' },
  { id: 'youtube-thumbnail', label: 'YouTube Thumbnail', width: 1280, height: 720, category: 'social' },
  { id: 'linkedin-banner', label: 'LinkedIn Banner', width: 1584, height: 396, category: 'social' },
  { id: 'twitter-header', label: 'Twitter/X Header', width: 1500, height: 500, category: 'social' },
  { id: 'leaderboard', label: 'Leaderboard (728×90)', width: 728, height: 90, category: 'display' },
  { id: 'medium-rectangle', label: 'Medium Rectangle (300×250)', width: 300, height: 250, category: 'display' },
  { id: 'wide-skyscraper', label: 'Wide Skyscraper (160×600)', width: 160, height: 600, category: 'display' },
  { id: 'full-banner', label: 'Full Banner (468×60)', width: 468, height: 60, category: 'display' },
  { id: 'custom-hd', label: 'HD Banner (1200×628)', width: 1200, height: 628, category: 'custom' },
  { id: 'loja-pequeno', label: 'Loja online — Pequeno (4:1)', width: 1200, height: 300, category: 'custom' },
  { id: 'loja-medio', label: 'Loja online — Médio (3:1)', width: 1200, height: 400, category: 'custom' },
  { id: 'loja-grande', label: 'Loja online — Grande (2:1)', width: 1200, height: 600, category: 'custom' },
]

export const DEFAULT_BANNER_WIDTH = 1200
export const DEFAULT_BANNER_HEIGHT = 628
export const DEFAULT_BACKGROUND = '#ffffff'

export const MIN_ZOOM = 0.1
export const MAX_ZOOM = 3
export const ZOOM_STEP = 0.1
export const FIT_PADDING = 48

export const HISTORY_LIMIT = 50

export const FONT_FAMILIES = [
  'Inter',
  'Roboto',
  'Open Sans',
  'Montserrat',
  'Poppins',
  'Bebas Neue',
  'Playfair Display',
  'Oswald',
  'Lato',
  'Arial',
  'Georgia',
  'Times New Roman',
] as const

export const FONT_WEIGHTS = [
  { label: 'Light', value: '300' },
  { label: 'Regular', value: '400' },
  { label: 'Medium', value: '500' },
  { label: 'Semi Bold', value: '600' },
  { label: 'Bold', value: '700' },
  { label: 'Extra Bold', value: '800' },
] as const

export const LAYER_TYPE_LABELS: Record<string, string> = {
  text: 'Texto',
  image: 'Imagem',
  shape: 'Forma',
  button: 'Botão',
  background: 'Fundo',
}

export const CUSTOM_PROPS = [
  'layerId',
  'layerName',
  'layerType',
  'buttonUrl',
  'buttonTarget',
] as const

export const DEFAULT_GRID_SIZE = 20
export const GRID_SIZE_OPTIONS = [10, 20, 40, 50] as const
export const SNAP_MARGIN = 5
export const CENTER_SNAP_MARGIN = 5
export const GUIDE_COLOR = 'rgba(99, 102, 241, 0.9)'
export const CENTER_GUIDE_COLOR = 'rgba(236, 72, 153, 0.9)'
