import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Calendar,
  Clock,
  Eye,
  Flame,
  MapPin,
  MousePointerClick,
  RefreshCw,
  ShoppingCart,
  Smartphone,
  Target,
  TrendingUp,
  Truck,
  Users,
} from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { DashboardKpiCard } from '../components/dashboard/DashboardKpiCard'
import { LojaOnlineHeatmap } from '../components/loja-online/LojaOnlineHeatmap'
import { Button, Card, CardBody, CardHeader } from '../components/ui'
import { DASHBOARD_CHART_COLORS, formatCurrency } from '../lib/dashboard-utils'
import {
  iaHeatmap,
  iaMetricas,
  type IaCapaPersonalizada,
  type IaFreteConsultas,
  type IaHeatmap,
  type IaMetricas,
  type IaPeriodo,
  type NomeTotal,
  type SegmentoRow,
} from '../lib/loja-online-ia-api'

type Props = { empresaId: string; slug: string }
type Aba = 'visao' | 'heatmap'
type PeriodoId = '7d' | '30d' | '90d'

const PERIODOS: { id: PeriodoId; label: string; dias: number }[] = [
  { id: '7d', label: '7 dias', dias: 7 },
  { id: '30d', label: '30 dias', dias: 30 },
  { id: '90d', label: '90 dias', dias: 90 },
]

const TIPO_PAGINA_LABEL: Record<string, string> = {
  home: 'Página inicial',
  produto: 'Páginas de produto',
  carrinho: 'Carrinho',
  checkout: 'Checkout',
  busca: 'Busca',
  colecao: 'Coleções',
  conta: 'Minha conta',
  pedido: 'Pedido',
  login_cadastro: 'Login / cadastro',
  legal: 'Páginas legais',
  outra: 'Outras',
}

const TIPO_PAGINA_PATH: Record<string, string> = {
  home: '/',
  carrinho: '/carrinho',
  checkout: '/checkout',
  busca: '/busca',
  conta: '/conta',
  login_cadastro: '/entrar',
}

function rangeFor(id: PeriodoId): IaPeriodo {
  const dias = PERIODOS.find((p) => p.id === id)?.dias ?? 30
  const fim = new Date()
  const inicio = new Date(fim.getTime() - dias * 86_400_000)
  return { inicio: inicio.toISOString(), fim: fim.toISOString() }
}

function fmtTempo(s: number | null | undefined): string {
  if (s == null || !Number.isFinite(s)) return '—'
  if (s < 60) return `${Math.round(s)}s`
  const m = Math.floor(s / 60)
  const r = Math.round(s % 60)
  return r ? `${m}min ${r}s` : `${m}min`
}

function fmtPct(v: number | null | undefined): string {
  return v == null ? '—' : `${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
}

function fmtData(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function BarList({
  rows,
  suffix = '',
  emptyText = 'Sem dados no período.',
  scaleMax,
}: {
  rows: NomeTotal[]
  suffix?: string
  emptyText?: string
  /** Escala fixa (ex.: 100 para porcentagens); sem ela a maior barra ocupa a largura toda. */
  scaleMax?: number
}) {
  if (!rows.length) return <p className="loja-online-hint">{emptyText}</p>
  const max = scaleMax ?? Math.max(...rows.map((r) => r.total), 1)
  return (
    <ul className="loja-ia-barlist">
      {rows.map((r) => (
        <li key={r.nome}>
          <div className="loja-ia-barlist-label">
            <span title={r.nome}>{r.nome}</span>
            <strong>
              {r.total.toLocaleString('pt-BR')}
              {suffix}
            </strong>
          </div>
          <div className="loja-ia-barlist-track">
            <div className="loja-ia-barlist-fill" style={{ width: `${(r.total / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  )
}

function SegmentTable({ rows, label }: { rows: SegmentoRow[]; label: string }) {
  if (!rows.length) return <p className="loja-online-hint">Sem dados no período.</p>
  return (
    <div className="loja-online-table-wrap">
      <table className="loja-online-table">
        <thead>
          <tr>
            <th>{label}</th>
            <th>Sessões</th>
            <th>Carrinhos</th>
            <th>Compras</th>
            <th>Conversão</th>
            <th>Abandono</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.nome}>
              <td>{r.nome}</td>
              <td>{r.sessoes}</td>
              <td>{r.carrinhos}</td>
              <td>{r.compras}</td>
              <td>{fmtPct(r.conversao_pct)}</td>
              <td className={r.abandono_carrinho_pct != null && r.abandono_carrinho_pct >= 75 ? 'loja-ia-bad' : ''}>
                {fmtPct(r.abandono_carrinho_pct)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Panel({ icon, title, children, wide }: { icon: React.ReactNode; title: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <Card className={`page-card loja-ia-panel${wide ? ' loja-ia-panel--wide' : ''}`}>
      <CardHeader>
        <span>
          {icon} {title}
        </span>
      </CardHeader>
      <CardBody>{children}</CardBody>
    </Card>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'bad' }) {
  return (
    <div className={`loja-ia-stat${tone ? ` loja-ia-stat--${tone}` : ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

const ORIGEM_FRETE_LABEL: Record<string, string> = {
  produto: 'Página do produto',
  checkout: 'Checkout',
  carrinho: 'Carrinho',
}

function ConsultasFrete({ c }: { c: IaFreteConsultas }) {
  const brl = (v: number | null | undefined) => (v != null ? formatCurrency(v) : '—')
  const pdp = c.pagina_produto
  return (
    <Panel icon={<Truck size={18} />} title="Consultas de frete" wide>
      {c.total_consultas === 0 ? (
        <p className="loja-online-hint">
          Nenhuma consulta de frete registrada no período. Cada cálculo de frete feito na página do produto ou no checkout passa a
          ser registrado com o valor cotado.
        </p>
      ) : (
        <>
          <div className="loja-ia-stats">
            <Stat label="Consultas" value={c.total_consultas.toLocaleString('pt-BR')} />
            <Stat label="Sessões que consultaram" value={c.sessoes_que_consultaram.toLocaleString('pt-BR')} />
            <Stat label="Frete cotado médio" value={brl(c.frete_cotado_medio)} />
            <Stat label="Mediana do frete cotado" value={brl(c.frete_cotado_mediana)} />
            <Stat label="Cotações com frete grátis" value={fmtPct(c.frete_gratis_pct_das_consultas)} />
            <Stat
              label="Recalcularam várias vezes"
              value={c.sessoes_que_recalcularam_varias_vezes.toLocaleString('pt-BR')}
              tone={c.sessoes_que_recalcularam_varias_vezes > 0 ? 'bad' : undefined}
            />
            <Stat label="Erros no cálculo" value={c.consultas_com_erro.toLocaleString('pt-BR')} tone={c.consultas_com_erro > 0 ? 'bad' : undefined} />
          </div>

          {pdp.consultas > 0 && (
            <>
              <h4 className="loja-ia-subtitle">Página do produto: consultou o frete e…</h4>
              <div className="loja-ia-stats">
                <Stat label="Adicionou ao carrinho" value={fmtPct(pdp.adicionaram_ao_carrinho_pct)} tone="good" />
                <Stat label="Comprou" value={fmtPct(pdp.compraram_pct)} tone="good" />
                <Stat label="Frete médio (adicionou)" value={brl(pdp.frete_medio_quem_adicionou)} tone="good" />
                <Stat label="Frete médio (desistiu)" value={brl(pdp.frete_medio_quem_nao_adicionou)} tone="bad" />
              </div>
              {pdp.por_faixa_frete.length > 0 && (
                <div style={{ width: '100%', height: 200, marginTop: 12 }}>
                  <ResponsiveContainer>
                    <BarChart data={pdp.por_faixa_frete}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="faixa" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} unit="%" />
                      <Tooltip />
                      <Bar dataKey="desistiram_pct" name="Desistiram após cotar %" fill={DASHBOARD_CHART_COLORS.warning} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </>
          )}

          {c.por_origem.length > 0 && (
            <div className="loja-online-table-wrap" style={{ marginTop: 12 }}>
              <table className="loja-online-table">
                <thead>
                  <tr>
                    <th>Onde cotou</th>
                    <th>Consultas</th>
                    <th>Sessões</th>
                    <th>Compras</th>
                    <th>Conversão</th>
                    <th>Frete médio</th>
                  </tr>
                </thead>
                <tbody>
                  {c.por_origem.map((r) => (
                    <tr key={r.origem}>
                      <td>{ORIGEM_FRETE_LABEL[r.origem] ?? r.origem}</td>
                      <td>{r.consultas}</td>
                      <td>{r.sessoes}</td>
                      <td>{r.compras}</td>
                      <td>{fmtPct(r.conversao_pct)}</td>
                      <td>{formatCurrency(r.frete_medio)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {c.erros_top.length > 0 && (
            <>
              <h4 className="loja-ia-subtitle">Erros no cálculo de frete</h4>
              <BarList rows={c.erros_top} />
            </>
          )}

          <h4 className="loja-ia-subtitle">Últimas consultas</h4>
          <div className="loja-online-table-wrap">
            <table className="loja-online-table">
              <thead>
                <tr>
                  <th>Quando</th>
                  <th>Onde</th>
                  <th>UF</th>
                  <th>Subtotal</th>
                  <th>Frete</th>
                  <th>Prazo</th>
                  <th>O que aconteceu</th>
                </tr>
              </thead>
              <tbody>
                {c.ultimas.map((r, i) => (
                  <tr key={`${r.quando}-${i}`}>
                    <td>{fmtData(r.quando)}</td>
                    <td>{ORIGEM_FRETE_LABEL[r.origem] ?? r.origem}</td>
                    <td>{r.uf ?? '—'}</td>
                    <td>{brl(r.subtotal)}</td>
                    <td>{r.erro ? '—' : r.frete === 0 ? 'Grátis' : brl(r.frete)}</td>
                    <td>{r.prazo ? `${r.prazo} dias` : '—'}</td>
                    <td className={r.resultado === 'comprou' ? 'loja-ia-good' : r.erro || r.resultado.startsWith('abandonou') ? 'loja-ia-bad' : ''}>
                      {r.erro ? `Erro: ${r.erro}` : r.resultado}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Panel>
  )
}

function CapaPersonalizadaPanel({ c }: { c: IaCapaPersonalizada }) {
  const t = c.tracking_por_sessao
  const a = c.artes_salvas
  const maxFunil = Math.max(...c.funil.map((f) => f.sessoes), 1)
  return (
    <Panel icon={<Smartphone size={18} />} title="Capa personalizada" wide>
      <div className="loja-ia-stats">
        <Stat label="Começaram a personalizar" value={t.sessoes_que_comecaram.toLocaleString('pt-BR')} />
        <Stat label="Desistiram sem comprar" value={`${t.abandonaram} (${fmtPct(t.abandono_pct)})`} tone="bad" />
        <Stat label="Capas no carrinho → vendidas" value={`${a.capas_colocadas_no_carrinho} → ${a.capas_vendidas} (${fmtPct(a.conversao_carrinho_para_venda_pct)})`} tone="good" />
        <Stat label="Tempo no editor (média · mediana)" value={`${fmtTempo(t.tempo_medio_no_editor_s)} · ${fmtTempo(t.tempo_mediano_no_editor_s)}`} />
        <Stat label="Usaram texto" value={fmtPct(t.usaram_texto_pct)} />
        <Stat label="Deixado no carrinho sem comprar" value={formatCurrency(t.valor_no_carrinho_nao_comprado)} />
        {c.ajuda_whatsapp ? (
          <Stat
            label="Aviso de ajuda no WhatsApp (viram → clicaram)"
            value={`${c.ajuda_whatsapp.sessoes_que_viram} → ${c.ajuda_whatsapp.sessoes_que_clicaram} (${fmtPct(c.ajuda_whatsapp.taxa_clique_pct)})`}
            tone="good"
          />
        ) : null}
        {c.acoes_no_carrinho ? (
          <Stat
            label="No carrinho: editaram a arte · criaram outra"
            value={`${c.acoes_no_carrinho.editaram_a_arte} · ${c.acoes_no_carrinho.criaram_outra_capa}`}
          />
        ) : null}
      </div>

      <h4 className="loja-ia-subtitle">Funil do editor</h4>
      <ul className="loja-ia-funil">
        {c.funil.map((f) => (
          <li key={f.etapa}>
            <div className="loja-ia-funil-head">
              <span>{f.etapa}</span>
              <span>
                <strong>{f.sessoes.toLocaleString('pt-BR')}</strong>
                {f.pct_de_quem_comecou != null && ` · ${fmtPct(f.pct_de_quem_comecou)}`}
                {f.queda_da_etapa_anterior_pct != null && f.queda_da_etapa_anterior_pct > 0 && (
                  <em className={f.queda_da_etapa_anterior_pct >= 50 ? 'loja-ia-bad' : ''}> −{fmtPct(f.queda_da_etapa_anterior_pct)}</em>
                )}
              </span>
            </div>
            <div className="loja-ia-barlist-track">
              <div className="loja-ia-barlist-fill loja-ia-funil-fill" style={{ width: `${(f.sessoes / maxFunil) * 100}%` }} />
            </div>
          </li>
        ))}
      </ul>

      <div className="loja-ia-capa-cols">
        <div>
          <h4 className="loja-ia-subtitle">Onde desistem</h4>
          <BarList rows={c.abandonaram_em} emptyText="Ninguém desistiu no período." />
        </div>
        <div>
          <h4 className="loja-ia-subtitle">Modelos mais escolhidos</h4>
          <BarList rows={c.modelos_mais_escolhidos} />
        </div>
        <div>
          <h4 className="loja-ia-subtitle">Modelos vendidos</h4>
          <BarList rows={a.vendas_por_modelo} emptyText="Nenhuma capa vendida no período." />
        </div>
      </div>

      {c.erros_top.length > 0 && (
        <>
          <h4 className="loja-ia-subtitle">Erros no editor</h4>
          <BarList rows={c.erros_top} />
        </>
      )}
    </Panel>
  )
}

function VisaoGeral({ m }: { m: IaMetricas }) {
  const v = m.visao_geral
  const q = m.qualidade_dados
  const maxFunil = Math.max(m.funil[0]?.sessoes ?? 1, 1)

  return (
    <>
      {q.sessoes_com_tracking_avancado === 0 ? (
        <div className="dashboard-alert dashboard-alert--error">
          <AlertTriangle size={18} />
          O tracking comportamental (cliques, fotos, frete, checkout) ainda não registrou visitas neste período. As métricas
          detalhadas aparecem conforme novos clientes navegam na loja.
        </div>
      ) : (
        <p className="loja-online-hint">
          {q.sessoes_total.toLocaleString('pt-BR')} sessões no período, {q.sessoes_com_tracking_avancado.toLocaleString('pt-BR')} com
          tracking comportamental completo
          {q.tracking_avancado_desde ? ` (desde ${new Date(q.tracking_avancado_desde).toLocaleDateString('pt-BR')})` : ''}.
          {q.dados_truncados ? ' Volume muito alto: parte dos eventos mais recentes foi omitida.' : ''}
        </p>
      )}

      <section className="dashboard-kpis" style={{ marginTop: 12 }}>
        <DashboardKpiCard
          label="Sessões"
          value={v.sessoes.toLocaleString('pt-BR')}
          hint={v.visitantes_unicos ? `${v.visitantes_unicos} visitantes · ${fmtPct(v.visitantes_recorrentes_pct)} recorrentes` : `${v.paginas_por_sessao} páginas/sessão`}
          icon={<Users size={22} strokeWidth={1.8} />}
          variant="info"
        />
        <DashboardKpiCard
          label="Conversão"
          value={fmtPct(v.conversao_pct)}
          hint={`${v.pedidos} pedidos · ${formatCurrency(v.receita)}`}
          icon={<Target size={22} strokeWidth={1.8} />}
          variant="success"
        />
        <DashboardKpiCard
          label="Abandono de carrinho"
          value={fmtPct(m.carrinho.abandono_pct)}
          hint={`~${formatCurrency(m.carrinho.valor_abandonado_estimado)} deixados no carrinho`}
          icon={<ShoppingCart size={22} strokeWidth={1.8} />}
          variant="danger"
        />
        <DashboardKpiCard
          label="Tempo no site"
          value={fmtTempo(v.tempo_medio_sessao_s)}
          hint={`Mediana ${fmtTempo(v.tempo_mediano_sessao_s)} · rejeição ${fmtPct(v.rejeicao_pct)}`}
          icon={<Clock size={22} strokeWidth={1.8} />}
          variant="warning"
        />
      </section>

      <div className="loja-ia-grid">
        <Panel icon={<TrendingUp size={18} />} title="Funil de compra" wide>
          <ul className="loja-ia-funil">
            {m.funil.map((f, i) => (
              <li key={f.etapa}>
                <div className="loja-ia-funil-head">
                  <span>{f.etapa}</span>
                  <span>
                    <strong>{f.sessoes.toLocaleString('pt-BR')}</strong> · {fmtPct(f.pct_do_topo)}
                    {i > 0 && f.queda_da_etapa_anterior_pct > 0 && (
                      <em className={f.queda_da_etapa_anterior_pct >= 50 ? 'loja-ia-bad' : ''}> −{fmtPct(f.queda_da_etapa_anterior_pct)}</em>
                    )}
                  </span>
                </div>
                <div className="loja-ia-barlist-track">
                  <div className="loja-ia-barlist-fill loja-ia-funil-fill" style={{ width: `${(f.sessoes / maxFunil) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel icon={<ShoppingCart size={18} />} title="Onde abandonam o carrinho">
          <BarList rows={m.carrinho.abandonaram_em} />
          <div className="loja-ia-stats">
            <Stat label="Carrinho médio abandonado" value={m.carrinho.carrinho_medio_abandonado != null ? formatCurrency(m.carrinho.carrinho_medio_abandonado) : '—'} />
            <Stat label="Tempo na sessão antes de abandonar" value={fmtTempo(m.carrinho.tempo_medio_sessao_abandono_s)} />
          </div>
        </Panel>

        {m.capa_personalizada && <CapaPersonalizadaPanel c={m.capa_personalizada} />}

        <Panel icon={<Truck size={18} />} title="Frete × abandono">
          <div className="loja-ia-stats">
            <Stat label="Conversão após ver o frete" value={fmtPct(m.frete.conversao_apos_cotacao_pct)} />
            <Stat label="Frete médio (compraram)" value={m.frete.frete_medio_compradores != null ? formatCurrency(m.frete.frete_medio_compradores) : '—'} tone="good" />
            <Stat label="Frete médio (desistiram)" value={m.frete.frete_medio_abandonos != null ? formatCurrency(m.frete.frete_medio_abandonos) : '—'} tone="bad" />
            <Stat label="Frete / carrinho (compraram)" value={fmtPct(m.frete.frete_sobre_carrinho_compradores_pct)} tone="good" />
            <Stat label="Frete / carrinho (desistiram)" value={fmtPct(m.frete.frete_sobre_carrinho_abandonos_pct)} tone="bad" />
            <Stat label="Prazo médio (compraram × desistiram)" value={`${m.frete.prazo_medio_compradores_dias ?? '—'} × ${m.frete.prazo_medio_abandonos_dias ?? '—'} dias`} />
          </div>
          {m.frete.abandono_por_valor_frete.length > 0 && (
            <div style={{ width: '100%', height: 200, marginTop: 12 }}>
              <ResponsiveContainer>
                <BarChart data={m.frete.abandono_por_valor_frete}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="faixa" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} unit="%" />
                  <Tooltip />
                  <Bar dataKey="abandono_pct" name="Abandono %" fill={DASHBOARD_CHART_COLORS.warning} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>

        {m.frete.consultas && <ConsultasFrete c={m.frete.consultas} />}

        <Panel icon={<Eye size={18} />} title="Fotos do produto">
          <div className="loja-ia-stats">
            <Stat label="Média de fotos vistas" value={fmtPct(m.galeria.media_midias_vistas_pct)} />
            <Stat label="Viram todas as fotos" value={fmtPct(m.galeria.viram_todas_pct)} />
            <Stat label="Viram só a 1ª foto" value={fmtPct(m.galeria.viram_so_a_primeira_pct)} />
            <Stat label="Adicionam ao carrinho (viram todas)" value={fmtPct(m.galeria.taxa_add_quem_viu_todas_pct)} tone="good" />
            <Stat label="Adicionam ao carrinho (não viram todas)" value={fmtPct(m.galeria.taxa_add_quem_nao_viu_todas_pct)} />
          </div>
          <p className="loja-online-hint">
            Baseado em {m.galeria.visualizacoes_produto_com_varias_midias} visualizações de produtos com mais de uma foto/vídeo.
          </p>
        </Panel>

        <Panel icon={<Target size={18} />} title="Preço × conversão">
          {m.preco.por_faixa.length ? (
            <div style={{ width: '100%', height: 220 }}>
              <ResponsiveContainer>
                <BarChart data={m.preco.por_faixa}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="faixa" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} unit="%" />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="taxa_add_pct" name="Adicionam ao carrinho %" fill={DASHBOARD_CHART_COLORS.info} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="taxa_compra_pct" name="Compram %" fill={DASHBOARD_CHART_COLORS.success} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="loja-online-hint">Sem dados no período.</p>
          )}
        </Panel>

        <Panel icon={<MapPin size={18} />} title="Regiões (UF)" wide>
          <SegmentTable rows={m.segmentos.regiao_uf} label="UF" />
          {m.frete.por_uf.length > 0 && (
            <>
              <h4 className="loja-ia-subtitle">Frete por UF (quem calculou o frete)</h4>
              <div className="loja-online-table-wrap">
                <table className="loja-online-table">
                  <thead>
                    <tr>
                      <th>UF</th>
                      <th>Cotações</th>
                      <th>Compras</th>
                      <th>Abandono</th>
                      <th>Frete médio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {m.frete.por_uf.map((r) => (
                      <tr key={r.uf}>
                        <td>{r.uf}</td>
                        <td>{r.cotacoes}</td>
                        <td>{r.compras}</td>
                        <td className={r.abandono_pct >= 75 ? 'loja-ia-bad' : ''}>{fmtPct(r.abandono_pct)}</td>
                        <td>{formatCurrency(r.frete_medio)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Panel>

        <Panel icon={<Users size={18} />} title="Dispositivo">
          <SegmentTable rows={m.segmentos.dispositivo} label="Dispositivo" />
        </Panel>

        <Panel icon={<TrendingUp size={18} />} title="Origem do tráfego">
          <SegmentTable rows={m.segmentos.origem} label="Origem" />
        </Panel>

        <Panel icon={<Users size={18} />} title="Faixa etária">
          {m.segmentos.faixa_etaria_sessoes.length ? (
            <SegmentTable rows={m.segmentos.faixa_etaria_sessoes} label="Idade" />
          ) : (
            <p className="loja-online-hint">
              Nenhum cliente logado com data de nascimento no período. A data agora é pedida (opcional) no cadastro da loja.
            </p>
          )}
          <h4 className="loja-ia-subtitle">Pedidos por faixa etária</h4>
          <BarList rows={m.segmentos.faixa_etaria_pedidos} />
        </Panel>

        <Panel icon={<Users size={18} />} title="Novos × recorrentes">
          <SegmentTable rows={m.segmentos.novos_vs_recorrentes} label="Visitante" />
        </Panel>

        <Panel icon={<Clock size={18} />} title="Horário das visitas" wide>
          <div style={{ width: '100%', height: 220 }}>
            <ResponsiveContainer>
              <BarChart data={m.segmentos.hora_do_dia}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="hora" tick={{ fontSize: 11 }} unit="h" />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="sessoes" name="Sessões" fill={DASHBOARD_CHART_COLORS.primary} radius={[4, 4, 0, 0]} />
                <Bar dataKey="compras" name="Compras" fill={DASHBOARD_CHART_COLORS.success} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel icon={<ShoppingCart size={18} />} title="Produtos: visitas × vendas" wide>
          {m.produtos.length ? (
            <div className="loja-online-table-wrap">
              <table className="loja-online-table">
                <thead>
                  <tr>
                    <th>Produto</th>
                    <th>Preço</th>
                    <th>Visitas</th>
                    <th>Add carrinho</th>
                    <th>Compras</th>
                    <th>Abandono</th>
                    <th>Tempo na página</th>
                    <th>Fotos vistas</th>
                  </tr>
                </thead>
                <tbody>
                  {m.produtos.map((p) => (
                    <tr key={p.produto_id}>
                      <td>{p.nome}</td>
                      <td>{p.preco != null ? formatCurrency(p.preco) : '—'}</td>
                      <td>{p.visualizacoes}</td>
                      <td>
                        {p.add_carrinho} <small>({fmtPct(p.taxa_add_pct)})</small>
                      </td>
                      <td>
                        {p.compras} <small>({fmtPct(p.taxa_compra_pct)})</small>
                      </td>
                      <td className={p.abandono_carrinho_pct != null && p.abandono_carrinho_pct >= 75 ? 'loja-ia-bad' : ''}>
                        {fmtPct(p.abandono_carrinho_pct)}
                      </td>
                      <td>{fmtTempo(p.tempo_medio_pagina_s)}</td>
                      <td>{fmtPct(p.fotos_vistas_media_pct)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="loja-online-hint">Sem visualizações de produto no período.</p>
          )}
        </Panel>

        <Panel icon={<AlertTriangle size={18} />} title="Travamentos no checkout">
          <h4 className="loja-ia-subtitle">Erros mostrados ao cliente</h4>
          <BarList rows={m.checkout.erros_checkout_top} emptyText="Nenhum erro registrado." />
          <h4 className="loja-ia-subtitle">Erros no cálculo de frete</h4>
          <BarList rows={m.checkout.erros_frete_top} emptyText="Nenhum erro registrado." />
          <div className="loja-ia-stats">
            <Stat label="Cupons tentados" value={String(m.checkout.cupons.tentativas)} />
            <Stat label="Cupons válidos" value={String(m.checkout.cupons.sucesso)} />
          </div>
          {m.checkout.metodos_pagamento.length > 0 && (
            <>
              <h4 className="loja-ia-subtitle">Pagamento escolhido × concluído</h4>
              <BarList
                rows={m.checkout.metodos_pagamento.map((p) => ({ nome: `${p.metodo} (${fmtPct(p.conclusao_pct)} concluem)`, total: p.escolhas }))}
              />
            </>
          )}
        </Panel>

        <Panel icon={<Flame size={18} />} title="Frustração (rage clicks) e erros">
          <h4 className="loja-ia-subtitle">Cliques repetidos de frustração</h4>
          <BarList rows={m.engajamento.rage_clicks_top} emptyText="Nenhum rage click registrado." />
          <h4 className="loja-ia-subtitle">Erros técnicos (JavaScript)</h4>
          <BarList rows={m.engajamento.erros_js_top} emptyText="Nenhum erro técnico." />
        </Panel>

        <Panel icon={<MousePointerClick size={18} />} title="Elementos mais clicados" wide>
          <BarList rows={m.engajamento.cliques_top} />
        </Panel>

        <Panel icon={<Clock size={18} />} title="Tempo e rolagem por página">
          {m.engajamento.tempo_por_tipo_pagina.length ? (
            <div className="loja-online-table-wrap">
              <table className="loja-online-table">
                <thead>
                  <tr>
                    <th>Página</th>
                    <th>Tempo médio</th>
                    <th>Rolaram 50%</th>
                    <th>Até o fim</th>
                  </tr>
                </thead>
                <tbody>
                  {m.engajamento.tempo_por_tipo_pagina.map((t) => {
                    const sc = m.engajamento.scroll_por_tipo_pagina.find((s) => s.tipo === t.tipo)
                    return (
                      <tr key={t.tipo}>
                        <td>{TIPO_PAGINA_LABEL[t.tipo] ?? t.tipo}</td>
                        <td>{fmtTempo(t.media_s)}</td>
                        <td>{fmtPct(sc?.chegaram_50_pct)}</td>
                        <td>{fmtPct(sc?.chegaram_ao_fim_pct)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="loja-online-hint">Sem dados no período.</p>
          )}
          <h4 className="loja-ia-subtitle">Última página antes de sair (sem comprar)</h4>
          <BarList rows={m.engajamento.paginas_de_saida_sem_compra.map((r) => ({ ...r, nome: TIPO_PAGINA_LABEL[r.nome] ?? r.nome }))} />
        </Panel>

        <Panel icon={<Eye size={18} />} title="Buscas">
          <h4 className="loja-ia-subtitle">Mais buscados</h4>
          <BarList rows={m.engajamento.buscas_top} />
          <h4 className="loja-ia-subtitle">Buscas sem resultado (demanda não atendida)</h4>
          <BarList rows={m.engajamento.buscas_sem_resultado} emptyText="Nenhuma busca sem resultado." />
        </Panel>
      </div>
    </>
  )
}

function HeatmapTab({ empresaId, slug, periodo }: { empresaId: string; slug: string; periodo: IaPeriodo }) {
  const [alvo, setAlvo] = useState('tipo:home')
  const [device, setDevice] = useState<'desktop' | 'mobile'>('mobile')
  const [data, setData] = useState<IaHeatmap | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    iaHeatmap(empresaId, periodo, alvo, device)
      .then((d) => !cancelled && setData(d))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : 'Erro ao carregar mapa de calor.'))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [empresaId, periodo, alvo, device])

  const iframePath = useMemo(() => {
    if (!alvo.startsWith('tipo:')) return alvo
    const tipo = alvo.slice(5)
    if (TIPO_PAGINA_PATH[tipo]) return TIPO_PAGINA_PATH[tipo]
    const prefix = tipo === 'produto' ? '/produto/' : tipo === 'colecao' ? '/colecao/' : null
    return (prefix && data?.paginas.find((p) => p.nome.startsWith(prefix))?.nome) || '/'
  }, [alvo, data?.paginas])

  // O painel usa HashRouter: a vitrine fica em /#/loja/:slug (sem o "#" cairia na landing do sistema)
  const iframeSrc = `/#/loja/${encodeURIComponent(slug)}${iframePath === '/' ? '' : iframePath}?agiliza_internal=1`
  const [incluirLegado, setIncluirLegado] = useState(true)
  const legados = data?.pontos.filter((p) => p.legado && !p.rage).length ?? 0
  const dataVisivel = useMemo(
    () => (data && !incluirLegado ? { ...data, pontos: data.pontos.filter((p) => !p.legado) } : data),
    [data, incluirLegado]
  )
  const cliques = dataVisivel?.pontos.filter((p) => !p.rage).length ?? 0

  return (
    <>
      <div className="loja-ia-toolbar">
        <select className="input-el" value={alvo} onChange={(e) => setAlvo(e.target.value)}>
          <optgroup label="Tipo de página">
            {Object.entries(TIPO_PAGINA_LABEL).map(([id, label]) => (
              <option key={id} value={`tipo:${id}`}>
                {label}
                {data?.tipos.find((t) => t.nome === id) ? ` (${data.tipos.find((t) => t.nome === id)!.total} cliques)` : ''}
              </option>
            ))}
          </optgroup>
          {data && data.paginas.length > 0 && (
            <optgroup label="Página específica">
              {data.paginas.map((p) => (
                <option key={p.nome} value={p.nome}>
                  {p.nome} ({p.total})
                </option>
              ))}
            </optgroup>
          )}
        </select>
        <div className="dashboard-periodos">
          {(['mobile', 'desktop'] as const).map((d) => (
            <button
              key={d}
              type="button"
              className={`btn btn--secondary btn--sm ${device === d ? 'dashboard-periodo-ativo' : ''}`}
              onClick={() => setDevice(d)}
            >
              {d === 'mobile' ? 'Celular' : 'Computador'}
            </button>
          ))}
        </div>
        {loading && <RefreshCw size={16} className="dashboard-spin" />}
      </div>

      {error && (
        <div className="dashboard-alert dashboard-alert--error">
          <AlertTriangle size={18} />
          {error}
        </div>
      )}

      {data && dataVisivel && (
        <div className="loja-ia-heatmap-layout">
          <div>
            <p className="loja-online-hint">
              {cliques} cliques{dataVisivel.pontos.some((p) => p.rage) ? ' · ✕ vermelho = clique repetido de frustração' : ''}. A prévia usa a
              versão atual da página; se o layout mudou, os pontos podem ficar deslocados.
            </p>
            {legados > 0 && (
              <label className="loja-online-hint" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input type="checkbox" checked={incluirLegado} onChange={(e) => setIncluirLegado(e.target.checked)} />
                Incluir {legados.toLocaleString('pt-BR')} cliques antigos (antes da correção da coleta: a posição horizontal é
                exata, a vertical é aproximada — ficam concentrados na primeira tela)
              </label>
            )}
            <LojaOnlineHeatmap key={`${iframeSrc}|${device}`} data={dataVisivel} iframeSrc={iframeSrc} />
          </div>
          <aside>
            <Panel icon={<MousePointerClick size={18} />} title="Mais clicados aqui">
              <BarList rows={data.elementosTop} />
            </Panel>
            <Panel icon={<Eye size={18} />} title="Até onde rolam">
              {data.scroll.amostras ? (
                <>
                  <BarList
                    rows={data.scroll.faixas.map((f) => ({ nome: `Chegaram a ${f.limite}%`, total: f.pct }))}
                    suffix="%"
                    scaleMax={100}
                  />
                  <p className="loja-online-hint">
                    Base: {data.scroll.amostras.toLocaleString('pt-BR')} visualizações desta página.
                  </p>
                </>
              ) : (
                <p className="loja-online-hint">
                  Sem dados de rolagem ainda. A coleta foi corrigida (antes registrava 100% para todo mundo); os números aparecem
                  conforme novas visitas chegam.
                </p>
              )}
            </Panel>
          </aside>
        </div>
      )}
    </>
  )
}

export function LojaOnlineInteligenciaPage({ empresaId, slug }: Props) {
  const [aba, setAba] = useState<Aba>('visao')
  const [periodoId, setPeriodoId] = useState<PeriodoId>('30d')
  const [periodo, setPeriodo] = useState<IaPeriodo>(() => rangeFor('30d'))
  const [metricas, setMetricas] = useState<IaMetricas | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setMetricas(await iaMetricas(empresaId, periodo))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar métricas.')
    } finally {
      setLoading(false)
    }
  }, [empresaId, periodo])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const escolherPeriodo = (id: PeriodoId) => {
    setPeriodoId(id)
    setPeriodo(rangeFor(id))
  }

  const abas: { id: Aba; label: string; icon: React.ReactNode }[] = [
    { id: 'visao', label: 'Comportamento', icon: <TrendingUp size={16} /> },
    { id: 'heatmap', label: 'Mapa de calor', icon: <Flame size={16} /> },
  ]

  return (
    <div className="loja-online-dashboard loja-ia-page">
      <header className="dashboard-header" style={{ marginBottom: 16 }}>
        <div>
          <h2 className="dashboard-header__title" style={{ fontSize: '1.35rem' }}>
            Inteligência da loja
          </h2>
          <p className="dashboard-header__subtitle">Comportamento dos visitantes, mapa de calor e pontos de abandono</p>
        </div>
        <div className="dashboard-header__actions">
          <div className="dashboard-periodos">
            <Calendar size={18} />
            {PERIODOS.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`btn btn--secondary btn--sm ${periodoId === p.id ? 'dashboard-periodo-ativo' : ''}`}
                onClick={() => escolherPeriodo(p.id)}
              >
                {p.label}
              </button>
            ))}
          </div>
          <Button variant="secondary" size="sm" onClick={() => escolherPeriodo(periodoId)} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'dashboard-spin' : ''} />
            Atualizar
          </Button>
        </div>
      </header>

      <div className="loja-ia-tabs" role="tablist">
        {abas.map((a) => (
          <button
            key={a.id}
            type="button"
            role="tab"
            aria-selected={aba === a.id}
            className={`loja-ia-tab${aba === a.id ? ' is-active' : ''}`}
            onClick={() => setAba(a.id)}
          >
            {a.icon} {a.label}
          </button>
        ))}
      </div>

      {error && aba === 'visao' && (
        <div className="dashboard-alert dashboard-alert--error">
          <AlertTriangle size={18} />
          {error}
        </div>
      )}

      {aba === 'visao' && (metricas ? <VisaoGeral m={metricas} /> : loading && <p className="loja-online-hint">Calculando métricas…</p>)}
      {aba === 'heatmap' &&
        (slug ? (
          <HeatmapTab empresaId={empresaId} slug={slug} periodo={periodo} />
        ) : (
          <p className="loja-online-hint">Defina o endereço da loja em Publicação para ver o mapa de calor.</p>
        ))}
    </div>
  )
}
