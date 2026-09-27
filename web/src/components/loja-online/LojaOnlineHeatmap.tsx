import { useEffect, useMemo, useRef, useState } from 'react'
import type { IaHeatmap } from '../../lib/loja-online-ia-api'

const RADIUS = 26

function buildPalette(): Uint8ClampedArray {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 1
  const ctx = c.getContext('2d')!
  const g = ctx.createLinearGradient(0, 0, 256, 0)
  g.addColorStop(0, 'rgba(0, 0, 255, 0)')
  g.addColorStop(0.2, 'rgb(0, 120, 255)')
  g.addColorStop(0.45, 'rgb(0, 220, 120)')
  g.addColorStop(0.7, 'rgb(255, 230, 0)')
  g.addColorStop(1, 'rgb(255, 30, 0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 256, 1)
  return ctx.getImageData(0, 0, 256, 1).data
}

function drawHeat(canvas: HTMLCanvasElement, pontos: IaHeatmap['pontos'], width: number, height: number) {
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, width, height)
  const clicks = pontos.filter((p) => !p.rage)
  if (clicks.length === 0) return

  const intensity = Math.min(0.35, Math.max(0.05, 6 / Math.sqrt(clicks.length)))
  for (const p of clicks) {
    const x = p.x * width
    const g = ctx.createRadialGradient(x, p.y, 0, x, p.y, RADIUS)
    g.addColorStop(0, `rgba(0,0,0,${intensity})`)
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = g
    ctx.fillRect(x - RADIUS, p.y - RADIUS, RADIUS * 2, RADIUS * 2)
  }

  const img = ctx.getImageData(0, 0, width, height)
  const palette = buildPalette()
  const d = img.data
  for (let i = 0; i < d.length; i += 4) {
    const a = d[i + 3]
    if (!a) continue
    const o = a * 4
    d[i] = palette[o]
    d[i + 1] = palette[o + 1]
    d[i + 2] = palette[o + 2]
    d[i + 3] = Math.min(220, a * 1.6)
  }
  ctx.putImageData(img, 0, 0)

  ctx.strokeStyle = '#dc2626'
  ctx.lineWidth = 3
  for (const p of pontos.filter((pt) => pt.rage)) {
    const x = p.x * width
    ctx.beginPath()
    ctx.moveTo(x - 8, p.y - 8)
    ctx.lineTo(x + 8, p.y + 8)
    ctx.moveTo(x + 8, p.y - 8)
    ctx.lineTo(x - 8, p.y + 8)
    ctx.stroke()
  }
}

export function LojaOnlineHeatmap({ data, iframeSrc }: { data: IaHeatmap; iframeSrc: string }) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [containerW, setContainerW] = useState(900)

  const vw = data.viewportMedio || (data.device === 'mobile' ? 390 : 1280)
  const docH = useMemo(() => {
    const hs = data.pontos.map((p) => p.dh).filter((h) => h > 0).sort((a, b) => a - b)
    const mediana = hs.length ? hs[Math.floor(hs.length / 2)] : 0
    const maxY = data.pontos.reduce((m, p) => Math.max(m, p.y), 0)
    return Math.min(12000, Math.max(mediana, maxY + 200, 1400))
  }, [data.pontos])

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setContainerW(el.clientWidth))
    ro.observe(el)
    setContainerW(el.clientWidth)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    if (canvasRef.current) drawHeat(canvasRef.current, data.pontos, vw, docH)
  }, [data.pontos, vw, docH])

  const scale = Math.min(1, containerW / vw)

  return (
    <div ref={wrapRef} className="loja-ia-heatmap-wrap">
      <div className="loja-ia-heatmap-scroll">
        <div className="loja-ia-heatmap-stage" style={{ width: vw * scale, height: docH * scale }}>
          <div style={{ width: vw, height: docH, transform: `scale(${scale})`, transformOrigin: 'top left', position: 'relative' }}>
            <iframe
              title="Prévia da página"
              src={iframeSrc}
              width={vw}
              height={docH}
              scrolling="no"
              className="loja-ia-heatmap-iframe"
              tabIndex={-1}
            />
            <canvas ref={canvasRef} className="loja-ia-heatmap-canvas" />
            {data.scroll.amostras > 0 &&
              data.scroll.faixas.map((f) => (
                <div key={f.limite} className="loja-ia-heatmap-fold" style={{ top: (docH * f.limite) / 100 }}>
                  <span>
                    {f.pct}% chegaram a {f.limite}% da página
                  </span>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  )
}
