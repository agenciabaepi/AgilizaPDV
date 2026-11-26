import { useEffect, useState } from 'react'
import { Target, Trophy } from 'lucide-react'

type Metas = { mensal: number | null; diaria: number | null }

type Props = {
  empresaId: string
  /** Total das vendas concluídas de hoje (já calculado pela janela "Vendas de hoje"). */
  vendidoHoje: number
  /** Nome para exibir de um produto (variações já com o nome do produto pai). */
  descreverProduto: (produtoId: string) => string | null
  /** Muda quando a lista de vendas do dia é recarregada. */
  refreshKey?: unknown
}

function formatMoney(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatQtd(q: number): string {
  return Number.isInteger(q) ? String(q) : q.toLocaleString('pt-BR', { maximumFractionDigits: 3 })
}

/** Anel de progresso da meta do dia (SVG simples, sem biblioteca de gráficos). */
function AnelMeta({ percentual }: { percentual: number }) {
  const raio = 34
  const circ = 2 * Math.PI * raio
  const preenchido = Math.min(100, Math.max(0, percentual))
  const batida = percentual >= 100
  return (
    <svg className="pdv-resumo-dia-anel" width="84" height="84" viewBox="0 0 84 84" role="img" aria-label={`${percentual}% da meta do dia`}>
      <circle cx="42" cy="42" r={raio} fill="none" stroke="#eef2ff" strokeWidth="8" />
      <circle
        cx="42"
        cy="42"
        r={raio}
        fill="none"
        stroke={batida ? 'var(--color-success)' : 'var(--color-primary)'}
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={`${(preenchido / 100) * circ} ${circ}`}
        transform="rotate(-90 42 42)"
      />
      <text x="42" y="47" textAnchor="middle" className="pdv-resumo-dia-anel-texto">
        {percentual}%
      </text>
    </svg>
  )
}

export function PdvResumoDia({ empresaId, vendidoHoje, descreverProduto, refreshKey }: Props) {
  const [metas, setMetas] = useState<Metas>({ mensal: null, diaria: null })
  const [vendidoMes, setVendidoMes] = useState<number | null>(null)
  const [topHoje, setTopHoje] = useState<{ produto_id: string; quantidade: number }[]>([])
  const [carregado, setCarregado] = useState(false)

  useEffect(() => {
    const api = window.electronAPI
    if (!empresaId || !api) return
    let cancelado = false
    const agora = new Date()
    const inicioHoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 0, 0, 0, 0)
    const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1, 0, 0, 0, 0)
    const fimHoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 23, 59, 59, 999)

    Promise.all([
      api.empresas?.getMetasVendas?.(empresaId).catch(() => null) ?? Promise.resolve(null),
      api.produtos?.maisVendidos?.(empresaId, { desde: inicioHoje.toISOString(), limite: 30, semCache: true }).catch(() => []) ??
        Promise.resolve([]),
      api.vendas
        ?.list(empresaId, { dataInicio: inicioMes.toISOString(), dataFim: fimHoje.toISOString(), limit: 10_000 })
        .then((vs) => vs.filter((v) => v.status === 'CONCLUIDA').reduce((s, v) => s + (Number(v.total) || 0), 0))
        .catch(() => null) ?? Promise.resolve(null),
    ]).then(([m, top, mes]) => {
      if (cancelado) return
      if (m) setMetas(m)
      setTopHoje(top ?? [])
      setVendidoMes(mes)
      setCarregado(true)
    })
    return () => {
      cancelado = true
    }
  }, [empresaId, refreshKey])

  // Soma variações no mesmo nome (o ranking vem por produto vendido; o pai agrupa as variações).
  const ranking = (() => {
    const porNome = new Map<string, number>()
    for (const { produto_id, quantidade } of topHoje) {
      const nome = descreverProduto(produto_id)
      if (!nome) continue
      porNome.set(nome, (porNome.get(nome) ?? 0) + quantidade)
    }
    return [...porNome.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
  })()

  const pctDia = metas.diaria ? Math.round((vendidoHoje / metas.diaria) * 100) : 0
  const pctMes = metas.mensal && vendidoMes != null ? Math.round((vendidoMes / metas.mensal) * 100) : 0

  return (
    <div className="pdv-resumo-dia">
      <section className="pdv-resumo-dia-card" aria-labelledby="pdv-resumo-meta-titulo">
        <h3 id="pdv-resumo-meta-titulo" className="pdv-resumo-dia-titulo">
          <Target size={15} aria-hidden="true" />
          Meta do dia
        </h3>
        {metas.diaria ? (
          <div className="pdv-resumo-dia-meta">
            <AnelMeta percentual={pctDia} />
            <div className="pdv-resumo-dia-meta-info">
              <strong>{formatMoney(vendidoHoje)}</strong>
              <span>de {formatMoney(metas.diaria)}</span>
              <span className={pctDia >= 100 ? 'pdv-resumo-dia-ok' : ''}>
                {pctDia >= 100 ? 'Meta do dia batida' : `Faltam ${formatMoney(metas.diaria - vendidoHoje)}`}
              </span>
            </div>
          </div>
        ) : (
          <p className="pdv-resumo-dia-vazio">
            {carregado ? 'Sem meta diária. Defina as metas no Dashboard.' : 'Carregando...'}
          </p>
        )}
        {metas.mensal != null && vendidoMes != null && (
          <div className="pdv-resumo-dia-mes">
            <div className="pdv-resumo-dia-mes-linha">
              <span>Mês</span>
              <span>
                {formatMoney(vendidoMes)} de {formatMoney(metas.mensal)} · {pctMes}%
              </span>
            </div>
            <div className="pdv-resumo-dia-barra" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, pctMes)}>
              <div
                className={`pdv-resumo-dia-barra-fill${pctMes >= 100 ? ' pdv-resumo-dia-barra-fill--ok' : ''}`}
                style={{ width: `${Math.min(100, pctMes)}%` }}
              />
            </div>
          </div>
        )}
      </section>

      <section className="pdv-resumo-dia-card" aria-labelledby="pdv-resumo-top-titulo">
        <h3 id="pdv-resumo-top-titulo" className="pdv-resumo-dia-titulo">
          <Trophy size={15} aria-hidden="true" />
          Mais vendidos hoje
        </h3>
        {ranking.length === 0 ? (
          <p className="pdv-resumo-dia-vazio">{carregado ? 'Nenhum produto vendido hoje ainda.' : 'Carregando...'}</p>
        ) : (
          <ol className="pdv-resumo-dia-top">
            {ranking.map(([nome, qtd], i) => (
              <li key={nome}>
                <span className="pdv-resumo-dia-top-pos">{i + 1}º</span>
                <span className="pdv-resumo-dia-top-nome">{nome}</span>
                <span className="pdv-resumo-dia-top-qtd">{formatQtd(qtd)} un</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  )
}
