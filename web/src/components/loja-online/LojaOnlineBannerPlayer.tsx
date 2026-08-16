import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  LojaOnlineBanner,
  LojaOnlineBannerTamanho,
  LojaOnlineBannerVariant,
} from '../../lib/loja-online-types'
import { getLojaOnlineBannerSpec } from '../../lib/loja-online-types'
import { hasRestorableBannerStudio } from '../../lib/loja-online-banner-studio'
import { compactStudioForTransfer } from '@banner-root/features/editor/services/studio-transfer.helpers'
import type { BannerStudioDocument } from '../../lib/loja-online-banner-studio'

function getBannerPlayerUrl(
  tamanho: LojaOnlineBannerTamanho,
  variant: LojaOnlineBannerVariant,
  revision: string,
  dimensions?: { width: number; height: number },
): string {
  const spec = getLojaOnlineBannerSpec(tamanho, variant)
  const params = new URLSearchParams({
    embed: '1',
    tamanho,
    width: String(dimensions?.width ?? spec.recommendedPx.width),
    height: String(dimensions?.height ?? spec.recommendedPx.height),
    revision,
  })
  return `${window.location.origin}/banner-player/?${params.toString()}`
}

export function LojaOnlineBannerPlayer({
  banner,
  tamanho,
  variant = 'desktop',
}: {
  banner: LojaOnlineBanner
  tamanho: LojaOnlineBannerTamanho
  variant?: LojaOnlineBannerVariant
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const retryTimersRef = useRef<number[]>([])
  const [useFallbackImage, setUseFallbackImage] = useState(false)
  const editorTamanho = banner.tamanho ?? banner.studio?.tamanho ?? tamanho
  const revision =
    banner.studio?.project?.updatedAt ??
    (banner.studio?.slides?.[0]?.canvasSnapshot
      ? `${banner.studio.slides[0].canvasSnapshot.length}`
      : 'static')

  const sendInit = useCallback(() => {
    const iframe = iframeRef.current
    if (!iframe?.contentWindow || !hasRestorableBannerStudio(banner.studio)) return

    const studio =
      banner.studio && hasRestorableBannerStudio(banner.studio)
        ? compactStudioForTransfer(
            JSON.parse(JSON.stringify(banner.studio)) as BannerStudioDocument,
          )
        : banner.studio

    iframe.contentWindow.postMessage(
      {
        type: 'banner-player:init',
        studio,
        imagem: banner.imagem,
        autoplay: true,
        loop: true,
      },
      '*',
    )
  }, [banner.studio, banner.imagem])

  const scheduleInitRetries = useCallback(() => {
    retryTimersRef.current.forEach((timer) => window.clearTimeout(timer))
    retryTimersRef.current = []
    sendInit()
    for (const delay of [800]) {
      retryTimersRef.current.push(window.setTimeout(sendInit, delay))
    }
  }, [sendInit])

  useEffect(() => {
    setUseFallbackImage(false)
  }, [banner.id, revision])

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const iframe = iframeRef.current
      if (!iframe?.contentWindow || event.source !== iframe.contentWindow) return
      const data = event.data as { type?: string } | undefined
      if (data?.type === 'banner-player:ready') {
        scheduleInitRetries()
      } else if (data?.type === 'banner-player:loaded') {
        retryTimersRef.current.forEach((timer) => window.clearTimeout(timer))
        retryTimersRef.current = []
      } else if (data?.type === 'banner-player:error') {
        setUseFallbackImage(true)
      } else if (data?.type === 'banner-player:navigate') {
        const payload = data as { url?: string; target?: string }
        if (!payload.url) return
        const target = payload.target === '_self' ? '_self' : '_blank'
        window.open(payload.url, target, target === '_blank' ? 'noopener,noreferrer' : undefined)
      }
    }

    window.addEventListener('message', handleMessage)
    return () => {
      window.removeEventListener('message', handleMessage)
      retryTimersRef.current.forEach((timer) => window.clearTimeout(timer))
      retryTimersRef.current = []
    }
  }, [scheduleInitRetries])

  if (!hasRestorableBannerStudio(banner.studio)) {
    return null
  }

  if (useFallbackImage) {
    return <img src={banner.imagem} alt="" className="loja-store-carousel-img" />
  }

  const src = getBannerPlayerUrl(
    editorTamanho,
    variant,
    revision,
    banner.studio?.project.dimensions,
  )

  return (
    <iframe
      key={`${banner.id}-${variant}-${revision}`}
      ref={iframeRef}
      className="loja-store-banner-player"
      src={src}
      title="Banner interativo"
      loading="lazy"
      onLoad={scheduleInitRetries}
    />
  )
}
