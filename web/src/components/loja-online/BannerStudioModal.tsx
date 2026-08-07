import { useEffect, useRef, useCallback } from 'react'
import { X } from 'lucide-react'
import type { LojaOnlineBanner, LojaOnlineBannerTamanho } from '../../lib/loja-online-types'
import { getLojaOnlineBannerSpec } from '../../lib/loja-online-types'
import type { BannerStudioDocument } from '../../lib/loja-online-banner-studio'
import { isBannerStudioDocument } from '../../lib/loja-online-banner-studio'
import { compactStudioForTransfer } from '@banner-root/features/editor/services/studio-transfer.helpers'

type BannerStudioEmbedMessage =
  | { type: 'banner-studio:ready' }
  | { type: 'banner-studio:loaded' }
  | { type: 'banner-studio:export'; imagem: string; studio: BannerStudioDocument }
  | { type: 'banner-studio:error'; message: string }

export type BannerStudioSavePayload = {
  imagem: string
  studio: BannerStudioDocument
  tamanho: LojaOnlineBannerTamanho
}

function getBannerStudioUrl(
  tamanho: LojaOnlineBannerTamanho,
  parentOrigin: string,
  revision: string,
  dimensions?: { width: number; height: number },
): string {
  const spec = getLojaOnlineBannerSpec(tamanho)
  const width = dimensions?.width ?? spec.recommendedPx.width
  const height = dimensions?.height ?? spec.recommendedPx.height
  const params = new URLSearchParams({
    embed: '1',
    tamanho,
    width: String(width),
    height: String(height),
    parentOrigin,
    revision,
  })
  return `${window.location.origin}/banner-studio/?${params.toString()}`
}

export function BannerStudioModal({
  open,
  tamanho,
  banner,
  onClose,
  onSave,
  onError,
}: {
  open: boolean
  tamanho: LojaOnlineBannerTamanho
  banner?: LojaOnlineBanner | null
  onClose: () => void
  onSave: (payload: BannerStudioSavePayload) => void
  onError?: (message: string) => void
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const retryTimersRef = useRef<number[]>([])
  const initLoadedRef = useRef(false)
  const parentOrigin = typeof window !== 'undefined' ? window.location.origin : ''
  const editorTamanho = banner?.tamanho ?? banner?.studio?.tamanho ?? tamanho
  const revision =
    banner?.studio?.project?.updatedAt ??
    (banner?.studio?.slides?.[0]?.canvasSnapshot
      ? `${banner.studio.slides[0].canvasSnapshot.length}`
      : banner?.imagem
        ? `${banner.imagem.length}`
        : 'new')
  const iframeKey = `${banner?.id ?? 'new'}-${editorTamanho}-${revision}-${open ? 'open' : 'closed'}`

  const stopInitRetries = useCallback(() => {
    retryTimersRef.current.forEach((timer) => window.clearTimeout(timer))
    retryTimersRef.current = []
  }, [])

  const sendInit = useCallback(() => {
    if (initLoadedRef.current) return
    const spec = getLojaOnlineBannerSpec(editorTamanho)
    const iframe = iframeRef.current
    if (!iframe?.contentWindow) return

    try {
      const studioPayload =
        banner?.studio && isBannerStudioDocument(banner.studio)
          ? compactStudioForTransfer(
              JSON.parse(JSON.stringify(banner.studio)) as BannerStudioDocument,
            )
          : undefined

      const initPayload: Record<string, unknown> = {
        type: 'banner-studio:init',
        tamanho: editorTamanho,
        width: banner?.studio?.project.dimensions.width ?? spec.recommendedPx.width,
        height: banner?.studio?.project.dimensions.height ?? spec.recommendedPx.height,
      }

      if (studioPayload) {
        initPayload.studio = studioPayload
      }

      iframe.contentWindow.postMessage(initPayload, '*')

      if (banner?.imagem) {
        iframe.contentWindow.postMessage(
          { type: 'banner-studio:init-imagem', imagem: banner.imagem },
          '*',
        )
      }
    } catch (error) {
      console.error('Falha ao enviar init para o Banner Studio:', error)
      onError?.('Não foi possível abrir o banner no editor. Recarregue a página e tente novamente.')
    }
  }, [banner, editorTamanho, onError])

  const scheduleInitRetries = useCallback(() => {
    if (initLoadedRef.current) return
    stopInitRetries()
    sendInit()
    const timer = window.setTimeout(() => {
      if (!initLoadedRef.current) sendInit()
    }, 800)
    retryTimersRef.current.push(timer)
  }, [sendInit, stopInitRetries])

  useEffect(() => {
    if (!open) {
      stopInitRetries()
      initLoadedRef.current = false
      return
    }
    initLoadedRef.current = false

    const handleMessage = (event: MessageEvent) => {
      const iframe = iframeRef.current
      if (!iframe?.contentWindow || event.source !== iframe.contentWindow) return
      const data = event.data as BannerStudioEmbedMessage | undefined
      if (!data || typeof data !== 'object') return

      if (data.type === 'banner-studio:ready') {
        scheduleInitRetries()
      } else if (data.type === 'banner-studio:loaded') {
        initLoadedRef.current = true
        stopInitRetries()
      } else if (data.type === 'banner-studio:export' && data.imagem && data.studio) {
        onSave({
          imagem: data.imagem,
          studio: data.studio,
          tamanho: data.studio.tamanho ?? editorTamanho,
        })
        onClose()
      } else if (data.type === 'banner-studio:error') {
        onError?.(data.message)
      }
    }

    window.addEventListener('message', handleMessage)
    return () => {
      window.removeEventListener('message', handleMessage)
      stopInitRetries()
    }
  }, [open, iframeKey, onSave, onClose, onError, scheduleInitRetries, stopInitRetries, editorTamanho])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const src = getBannerStudioUrl(
    editorTamanho,
    parentOrigin,
    revision,
    banner?.studio?.project.dimensions,
  )

  return (
    <div className="banner-studio-overlay" role="dialog" aria-modal="true" aria-label="Banner Studio">
      <div className="banner-studio-overlay__header">
        <span className="banner-studio-overlay__title">
          Banner Studio
          {banner?.studio?.project?.name ? ` — ${banner.studio.project.name}` : ''}
        </span>
        <button type="button" className="banner-studio-overlay__close" onClick={onClose} aria-label="Fechar">
          <X size={20} />
        </button>
      </div>
      <iframe
        key={iframeKey}
        ref={iframeRef}
        className="banner-studio-overlay__frame"
        src={src}
        title="Editor de banners"
        allow="clipboard-read; clipboard-write"
        onLoad={scheduleInitRetries}
      />
    </div>
  )
}
