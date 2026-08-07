export type LayerType = 'text' | 'image' | 'shape' | 'button' | 'background'

export type ShapeKind = 'rect' | 'circle'

export interface BannerDimensions {
  width: number
  height: number
}

export interface BannerPreset {
  id: string
  label: string
  width: number
  height: number
  category: 'social' | 'display' | 'custom'
}

export interface LayerMeta {
  id: string
  name: string
  type: LayerType
  visible: boolean
  locked: boolean
}

export interface BannerProject {
  id: string
  name: string
  dimensions: BannerDimensions
  backgroundColor: string
  createdAt: string
  updatedAt: string
}

export interface ExportOptions {
  format: 'png' | 'jpeg' | 'webp'
  quality: number
  multiplier: number
}

export interface TextLayerStyle {
  fill: string
  fontSize: number
  fontFamily: string
  fontWeight: string | number
  textAlign: 'left' | 'center' | 'right'
  lineHeight: number
  charSpacing: number
  opacity: number
}

export interface ImageLayerStyle {
  opacity: number
  blur: number
  brightness: number
  contrast: number
  saturation: number
}

export interface CommonLayerStyle {
  left: number
  top: number
  width: number
  height: number
  angle: number
  opacity: number
  shadowColor: string
  shadowBlur: number
  shadowOffsetX: number
  shadowOffsetY: number
}

export type EditorTool = 'select' | 'text' | 'image' | 'button' | 'rect' | 'circle' | 'pan'

export type ButtonTarget = '_blank' | '_self'

export interface ButtonLayerConfig {
  label: string
  url: string
  target: ButtonTarget
  bgColor: string
  textColor: string
  fontSize: number
  radius: number
}

export interface CanvasViewport {
  zoom: number
  panX: number
  panY: number
}

export interface GuideSettings {
  showGrid: boolean
  gridSize: number
  snapToGrid: boolean
  showGuides: boolean
  snapToCenter: boolean
}
