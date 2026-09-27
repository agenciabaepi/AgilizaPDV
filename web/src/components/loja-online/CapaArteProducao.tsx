import { Check, Download, ImageIcon } from 'lucide-react'
import type { CapaDesignAdmin, CapaDesignStatus } from '../../lib/capa-custom-admin-api'

const STATUS_OPCOES: { id: CapaDesignStatus; label: string }[] = [
  { id: 'pedido', label: 'A produzir' },
  { id: 'produzido', label: 'Produzida' },
  { id: 'cancelado', label: 'Cancelada' },
]

export const CAPA_STATUS_LABEL: Record<CapaDesignStatus, string> = {
  rascunho: 'No carrinho',
  pedido: 'A produzir',
  produzido: 'Produzida',
  cancelado: 'Cancelada',
}

function downloadUrl(url: string, filename: string): string {
  return `${url}${url.includes('?') ? '&' : '?'}download=${encodeURIComponent(filename)}`
}

export function CapaArteProducao({
  design,
  pedidoCodigo,
  busy,
  onStatus,
}: {
  design: CapaDesignAdmin
  pedidoCodigo: string
  busy?: boolean
  onStatus: (status: CapaDesignStatus) => void
}) {
  const nomeBase = `capa-${pedidoCodigo}-${design.id.slice(0, 4)}`
  const fotos = design.assets_json ?? []

  return (
    <div className="capa-arte">
      <a
        className="capa-arte-preview"
        href={design.preview_url ?? design.print_url ?? '#'}
        target="_blank"
        rel="noreferrer"
        title="Abrir prévia"
      >
        {design.preview_url ? (
          <img src={design.preview_url} alt={`Arte ${design.modelo_nome}`} loading="lazy" />
        ) : (
          <ImageIcon size={24} />
        )}
      </a>

      <div className="capa-arte-info">
        <div className="capa-arte-titulo">
          <strong>{design.modelo_nome}</strong>
          <span className={`capa-arte-status capa-arte-status--${design.status}`}>{CAPA_STATUS_LABEL[design.status]}</span>
        </div>
        {design.print_largura && design.print_altura ? (
          <p className="capa-arte-meta">
            PNG {design.print_largura} × {design.print_altura} px{design.print_dpi ? ` · ${design.print_dpi} dpi` : ''}
          </p>
        ) : null}

        <div className="capa-arte-acoes">
          {design.print_url && (
            <a className="btn btn--primary btn--sm" href={downloadUrl(design.print_url, `${nomeBase}.png`)}>
              <Download size={14} /> Baixar arte (PNG)
            </a>
          )}
          {fotos.map((url, i) => (
            <a key={url} className="btn btn--secondary btn--sm" href={downloadUrl(url, `${nomeBase}-foto-${i + 1}`)}>
              Foto original{fotos.length > 1 ? ` ${i + 1}` : ''}
            </a>
          ))}
        </div>

        <div className="capa-arte-producao" role="group" aria-label="Status de produção">
          {STATUS_OPCOES.map((o) => (
            <button
              key={o.id}
              type="button"
              disabled={busy}
              className={design.status === o.id ? 'is-active' : undefined}
              onClick={() => design.status !== o.id && onStatus(o.id)}
            >
              {design.status === o.id && <Check size={13} />}
              {o.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
