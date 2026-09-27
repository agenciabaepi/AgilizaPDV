import { useEffect, useRef, useState } from 'react'
import { MapPin, Monitor, ShoppingCart, Smartphone, Tablet, CreditCard } from 'lucide-react'
import { Card, CardBody, CardHeader } from '../ui'
import {
  lojaOnlineAoVivoLocal,
  subscribeLojaOnlineAoVivo,
  type LojaOnlineAoVivoVisitante,
} from '../../lib/loja-online-ao-vivo'

function formatDuracao(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}min`
  const h = Math.floor(m / 60)
  return `${h}h${String(m % 60).padStart(2, '0')}`
}

function paginaLabel(v: LojaOnlineAoVivoVisitante): string {
  const path = v.path || '/'
  if (/\/checkout$/.test(path)) return 'Finalizando compra'
  if (/\/carrinho$/.test(path)) return 'Carrinho'
  if (/\/produto\//.test(path) || /\/colecao\//.test(path) || /\/categoria\//.test(path)) {
    const titulo = v.titulo?.split(/\s[|–-]\s/)[0]?.trim()
    if (titulo) return titulo
  }
  if (/\/(conta|pedidos?)(\/|$)/.test(path)) return 'Minha conta'
  if (/\/(entrar|cadastro)$/.test(path)) return 'Login / cadastro'
  const semSlug = path.replace(/^\/loja\/[^/]+/, '') || '/'
  return semSlug === '/' ? 'Página inicial' : semSlug
}

function DeviceIcon({ device }: { device: string }) {
  if (device === 'mobile') return <Smartphone size={14} />
  if (device === 'tablet') return <Tablet size={14} />
  return <Monitor size={14} />
}

export function LojaOnlineAoVivoCard({ empresaId }: { empresaId: string }) {
  const [visitantes, setVisitantes] = useState<LojaOnlineAoVivoVisitante[]>([])
  const [conectado, setConectado] = useState(false)
  const [agora, setAgora] = useState(() => Date.now())
  const [ocultos, setOcultos] = useState<Set<string>>(() => new Set())
  const marcarInternoRef = useRef<((sessionId: string) => Promise<void>) | null>(null)

  useEffect(() => {
    if (!empresaId) return
    setConectado(false)
    const sub = subscribeLojaOnlineAoVivo(empresaId, (list) => {
      setVisitantes(list)
      setConectado(true)
    })
    marcarInternoRef.current = sub.marcarInterno
    return () => {
      marcarInternoRef.current = null
      sub.stop()
    }
  }, [empresaId])

  const marcarComoEu = (sessionId: string) => {
    if (!window.confirm('Esse acesso é seu? O aparelho deixa de contar em visitas, visualizações e ao vivo.')) return
    setOcultos((prev) => new Set(prev).add(sessionId))
    void marcarInternoRef.current?.(sessionId)
  }

  useEffect(() => {
    const t = window.setInterval(() => setAgora(Date.now()), 5000)
    return () => window.clearInterval(t)
  }, [])

  const lista = visitantes.filter((v) => !ocultos.has(v.sessionId))
  const total = lista.length
  const noCheckout = lista.filter((v) => v.checkout).length
  const comCarrinho = lista.filter((v) => v.carrinho).length

  return (
    <Card className="page-card loja-online-ao-vivo">
      <CardHeader>
        <span className="loja-online-ao-vivo__title">
          <span className={`loja-online-ao-vivo__dot${total > 0 ? ' is-on' : ''}`} aria-hidden />
          Ao vivo agora
        </span>
      </CardHeader>
      <CardBody>
        <div className="loja-online-ao-vivo__resumo">
          <div>
            <strong>{total}</strong>
            <span>{total === 1 ? 'pessoa no site' : 'pessoas no site'}</span>
          </div>
          <div>
            <strong>{comCarrinho}</strong>
            <span>com carrinho</span>
          </div>
          <div>
            <strong>{noCheckout}</strong>
            <span>finalizando compra</span>
          </div>
        </div>

        {total > 0 ? (
          <ul className="loja-online-ao-vivo__lista">
            {lista.map((v) => (
              <li key={v.sessionId}>
                <span className="loja-online-ao-vivo__device" title={v.device}>
                  <DeviceIcon device={v.device} />
                </span>
                <div className="loja-online-ao-vivo__info">
                  <strong>{paginaLabel(v)}</strong>
                  <small>
                    <MapPin size={12} /> {lojaOnlineAoVivoLocal(v)} · no site há {formatDuracao(agora - v.desde)}
                  </small>
                </div>
                <span className="loja-online-ao-vivo__tags">
                  {v.checkout ? (
                    <span className="loja-online-ao-vivo__tag is-checkout">
                      <CreditCard size={12} /> Checkout
                    </span>
                  ) : v.carrinho ? (
                    <span className="loja-online-ao-vivo__tag">
                      <ShoppingCart size={12} /> Carrinho
                    </span>
                  ) : null}
                </span>
                <button
                  type="button"
                  className="loja-online-ao-vivo__sou-eu"
                  onClick={() => marcarComoEu(v.sessionId)}
                  title="Marcar este aparelho como seu para não contar nas estatísticas"
                >
                  Sou eu
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="loja-online-hint" style={{ margin: 0 }}>
            {conectado ? 'Ninguém na loja neste momento.' : 'Conectando…'}
          </p>
        )}
      </CardBody>
    </Card>
  )
}
