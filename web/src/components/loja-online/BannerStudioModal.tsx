import { useEffect, useRef, useCallback } from 'react'
import { X } from 'lucide-react'
import type {
  LojaOnlineBanner,
  LojaOnlineBannerTamanho,
  LojaOnlineBannerVariant,
} from '../../lib/loja-online-types'
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
  variant: LojaOnlineBannerVariant
}

function getBannerStudioUrl(
  tamanho: LojaOnlineBannerTamanho,
  variant: LojaOnlineBannerVariant,
  parentOrigin: string,
  revision: string,
  dimensions?: { width: number; height: number },
): string {
  const spec = getLojaOnlineBannerSpec(tamanho, variant)
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
  variant = 'desktop',
  banner,
  onClose,
  onSave,
  onError,
}: {
  open: boolean
  tamanho: LojaOnlineBannerTamanho
  variant?: LojaOnlineBannerVariant
  banner?: LojaOnlineBanner | null
  onClose: () => void
  onSave: (payload: BannerStudioSavePayload) => void
  onError?: (message: string) => void
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const retryTimersRef = useRef<number[]>([])
  const initLoadedRef = useRef(false)
  const parentOrigin = typeof window !== 'undefined' ? window.location.origin : ''
  const isMobile = variant === 'mobile'
  const activeStudio = isMobile ? banner?.studioMobile : banner?.studio
  const activeImagem = isMobile ? banner?.imagemMobile : banner?.imagem
  const editorTamanho = isMobile
    ? banner?.tamanhoMobile ?? banner?.studioMobile?.tamanho ?? tamanho
    : banner?.tamanho ?? banner?.studio?.tamanho ?? tamanho
  const revision =
    activeStudio?.project?.updatedAt ??
    (activeStudio?.slides?.[0]?.canvasSnapshot
      ? `${activeStudio.slides[0].canvasSnapshot.length}`
      : activeImagem
        ? `${activeImagem.length}`
        : 'new')
  const iframeKey = `${banner?.id ?? 'new'}-${variant}-${editorTamanho}-${revision}-${open ? 'open' : 'closed'}`

  const stopInitRetries = useCallback(() => {
    retryTimersRef.current.forEach((timer) => window.clearTimeout(timer))
    retryTimersRef.current = []
  }, [])

  const sendInit = useCallback(() => {
    if (initLoadedRef.current) return
    const spec = getLojaOnlineBannerSpec(editorTamanho, variant)
    const iframe = iframeRef.current
    if (!iframe?.contentWindow) return

    try {
      const studioPayload =
        activeStudio && isBannerStudioDocument(activeStudio)
          ? compactStudioForTransfer(
              JSON.parse(JSON.stringify(activeStudio)) as BannerStudioDocument,
            )
          : undefined

      const initPayload: Record<string, unknown> = {
        type: 'banner-studio:init',
        tamanho: editorTamanho,
        width: activeStudio?.project.dimensions.width ?? spec.recommendedPx.width,
        height: activeStudio?.project.dimensions.height ?? spec.recommendedPx.height,
      }

      if (studioPayload) {
        initPayload.studio = studioPayload
      }

      iframe.contentWindow.postMessage(initPayload, '*')

      if (activeImagem) {
        iframe.contentWindow.postMessage(
          { type: 'banner-studio:init-imagem', imagem: activeImagem },
          '*',
        )
      }
    } catch (error) {
      console.error('Falha ao enviar init para o Banner Studio:', error)
      onError?.('Não foi possível abrir o banner no editor. Recarregue a página e tente novamente.')
    }
  }, [activeImagem, activeStudio, editorTamanho, onError, variant])

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
          variant,
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
  }, [open, iframeKey, onSave, onClose, onError, scheduleInitRetries, stopInitRetries, editorTamanho, variant])

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
    variant,
    parentOrigin,
    revision,
    activeStudio?.project.dimensions,
  )

  return (
    <div className="banner-studio-overlay" role="dialog" aria-modal="true" aria-label="Banner Studio">
      <div className="banner-studio-overlay__header">
        <span className="banner-studio-overlay__title">
          Banner Studio{isMobile ? ' — Celular' : ''}
          {activeStudio?.project?.name ? ` — ${activeStudio.project.name}` : ''}
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
        title={isMobile ? 'Editor de banners (celular)' : 'Editor de banners'}
        allow="clipboard-read; clipboard-write"
        onLoad={scheduleInitRetries}
      />
    </div>
  )
}
