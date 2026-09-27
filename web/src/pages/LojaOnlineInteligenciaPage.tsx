import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  Brain,
  Calendar,
  Clock,
  Eye,
  Flame,
  KeyRound,
  Lightbulb,
  MapPin,
  MessageSquare,
  MousePointerClick,
  RefreshCw,
  Send,
  ShoppingCart,
  Sparkles,
  Target,
  TrendingUp,
  Truck,
  Users,
} from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { DashboardKpiCard } from '../components/dashboard/DashboardKpiCard'
import { LojaOnlineHeatmap } from '../components/loja-online/LojaOnlineHeatmap'
import { Button, Card, CardBody, CardHeader, useToast } from '../components/ui'
import { DASHBOARD_CHART_COLORS, formatCurrency } from '../lib/dashboard-utils'
import {
  iaChat,
  iaConfigDelete,
  iaConfigSave,
  iaConfigStatus,
  iaGerarAnalise,
  iaHeatmap,
  iaListarAnalises,
  iaMetricas,
  type IaAnalise,
  type IaChatMessage,
  type IaConfigStatus,
  type IaFreteConsultas,
  type IaHeatmap,
  type IaMetricas,
  type IaPeriodo,
  type IaResultado,
  type NomeTotal,
  type SegmentoRow,
} from '../lib/loja-online-ia-api'

type Props = { empresaId: string; slug: string }
type Aba = 'visao' | 'heatmap' | 'ia' | 'config'
type PeriodoId = '7d' | '30d' | '90d'

const PERIODOS: { id: PeriodoId; label: string; dias: number }[] = [
  { id: '7d', label: '7 dias', dias: 7 },
  { id: '30d', label: '30 dias', dias: 30 },
  { id: '90d', label: '90 dias', dias: 90 },
]

const MODELOS = [
  { id: 'gpt-5-mini', label: 'GPT-5 mini (recomendado: ótimo custo-benefício)' },
  { id: 'gpt-5', label: 'GPT-5 (mais profundo, porém mais lento e caro)' },
  { id: 'gpt-4.1', label: 'GPT-4.1' },
  { id: 'gpt-4.1-mini', label: 'GPT-4.1 mini' },
  { id: 'gpt-4o-mini', label: 'GPT-4o mini (mais barato)' },
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

const SEVERIDADE_ORDEM = { critica: 0, alta: 1, media: 2, baixa: 3 } as const

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

function BarList({ rows, suffix = '', emptyText = 'Sem dados no período.' }: { rows: NomeTotal[]; suffix?: string; emptyText?: string }) {
  if (!rows.length) return <p className="loja-online-hint">{emptyText}</p>
  const max = Math.max(...rows.map((r) => r.total), 1)
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
  const cliques = data?.pontos.filter((p) => !p.rage).length ?? 0

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

      {data && (
        <div className="loja-ia-heatmap-layout">
          <div>
            <p className="loja-online-hint">
              {cliques} cliques{data.pontos.some((p) => p.rage) ? ' · ✕ vermelho = clique repetido de frustração' : ''}. A prévia usa a
              versão atual da página; se o layout mudou, os pontos podem ficar deslocados.
            </p>
            <LojaOnlineHeatmap key={`${iframeSrc}|${device}`} data={data} iframeSrc={iframeSrc} />
          </div>
          <aside>
            <Panel icon={<MousePointerClick size={18} />} title="Mais clicados aqui">
              <BarList rows={data.elementosTop} />
            </Panel>
            <Panel icon={<Eye size={18} />} title="Até onde rolam">
              {data.scroll.amostras ? (
                <BarList rows={data.scroll.faixas.map((f) => ({ nome: `Chegaram a ${f.limite}%`, total: f.pct }))} suffix="%" />
              ) : (
                <p className="loja-online-hint">Sem dados de rolagem.</p>
              )}
            </Panel>
          </aside>
        </div>
      )}
    </>
  )
}

function AnaliseResultado({ r }: { r: IaResultado }) {
  const [categoria, setCategoria] = useState<string>('todas')
  const insights = useMemo(
    () =>
      [...(r.insights ?? [])]
        .sort((a, b) => (SEVERIDADE_ORDEM[a.severidade] ?? 9) - (SEVERIDADE_ORDEM[b.severidade] ?? 9))
        .filter((i) => categoria === 'todas' || i.categoria === categoria),
    [r.insights, categoria]
  )
  const categorias = useMemo(() => [...new Set((r.insights ?? []).map((i) => i.categoria))], [r.insights])
  const nota = Math.max(0, Math.min(100, Number(r.nota_saude) || 0))
  const notaTone = nota >= 70 ? 'good' : nota >= 45 ? 'mid' : 'bad'

  return (
    <div className="loja-ia-resultado">
      <Card className="page-card loja-ia-resumo">
        <CardBody>
          <div className="loja-ia-resumo-grid">
            <div className={`loja-ia-nota loja-ia-nota--${notaTone}`}>
              <strong>{nota}</strong>
              <span>saúde da loja</span>
            </div>
            <div>
              <p className="loja-ia-resumo-text">{r.resumo_executivo}</p>
              {r.diagnostico_principal && (
                <p className="loja-ia-diagnostico">
                  <Target size={16} /> <strong>Diagnóstico principal:</strong> {r.diagnostico_principal}
                </p>
              )}
            </div>
          </div>
        </CardBody>
      </Card>

      {!!r.metricas_chave?.length && (
        <div className="loja-ia-metricas-chave">
          {r.metricas_chave.map((mk) => (
            <div key={mk.nome} className={`loja-ia-mk loja-ia-mk--${mk.leitura}`}>
              <span>{mk.nome}</span>
              <strong>{mk.valor}</strong>
              <small>{mk.comentario}</small>
            </div>
          ))}
        </div>
      )}

      {!!r.hipoteses_abandono?.length && (
        <Panel icon={<ShoppingCart size={18} />} title="Por que estão desistindo? (hipóteses da IA)" wide>
          <div className="loja-ia-hipoteses">
            {r.hipoteses_abandono.map((h) => (
              <div key={h.titulo} className="loja-ia-hipotese">
                <div className="loja-ia-hipotese-head">
                  <span className={`loja-ia-badge loja-ia-badge--${h.probabilidade}`}>Probabilidade {h.probabilidade}</span>
                  <span className="loja-ia-tag">{h.causa}</span>
                </div>
                <strong>{h.titulo}</strong>
                <ul>
                  {h.evidencias?.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
                {h.como_validar && (
                  <p className="loja-online-hint">
                    <strong>Como validar:</strong> {h.como_validar}
                  </p>
                )}
              </div>
            ))}
          </div>
        </Panel>
      )}

      {!!r.plano_de_acao?.length && (
        <Panel icon={<Sparkles size={18} />} title="Plano de ação priorizado" wide>
          <ol className="loja-ia-plano">
            {[...r.plano_de_acao]
              .sort((a, b) => a.prioridade - b.prioridade)
              .map((p) => (
                <li key={p.acao}>
                  <div>
                    <strong>{p.acao}</strong>
                    <span className="loja-ia-tag">{p.prazo}</span>
                  </div>
                  <p>{p.por_que}</p>
                  {p.kpi && <small>Acompanhe: {p.kpi}</small>}
                </li>
              ))}
          </ol>
        </Panel>
      )}

      {!!r.insights?.length && (
        <Panel icon={<Lightbulb size={18} />} title="Insights" wide>
          <div className="loja-ia-toolbar">
            {['todas', ...categorias].map((c) => (
              <button
                key={c}
                type="button"
                className={`btn btn--secondary btn--sm ${categoria === c ? 'dashboard-periodo-ativo' : ''}`}
                onClick={() => setCategoria(c)}
              >
                {c}
              </button>
            ))}
          </div>
          <div className="loja-ia-insights">
            {insights.map((i) => (
              <div key={i.titulo} className={`loja-ia-insight loja-ia-insight--${i.severidade}`}>
                <div className="loja-ia-hipotese-head">
                  <span className={`loja-ia-badge loja-ia-badge--${i.severidade}`}>{i.severidade}</span>
                  <span className="loja-ia-tag">{i.categoria}</span>
                  <span className="loja-ia-tag">esforço {i.esforco}</span>
                </div>
                <strong>{i.titulo}</strong>
                <p>
                  <em>Evidência:</em> {i.evidencia}
                </p>
                <p>
                  <em>O que fazer:</em> {i.recomendacao}
                </p>
                {i.impacto_estimado && <small>Impacto estimado: {i.impacto_estimado}</small>}
              </div>
            ))}
          </div>
        </Panel>
      )}

      <div className="loja-ia-grid">
        {!!r.produtos_atencao?.length && (
          <Panel icon={<ShoppingCart size={18} />} title="Produtos que merecem atenção">
            <ul className="loja-ia-list">
              {r.produtos_atencao.map((p) => (
                <li key={p.nome}>
                  <strong>{p.nome}</strong> — {p.problema}
                  <br />
                  <small>→ {p.acao}</small>
                </li>
              ))}
            </ul>
          </Panel>
        )}
        {!!r.segmentos_destaque?.length && (
          <Panel icon={<Users size={18} />} title="Segmentos em destaque">
            <ul className="loja-ia-list">
              {r.segmentos_destaque.map((s) => (
                <li key={s.segmento}>
                  <strong>{s.segmento}</strong> — {s.observacao}
                  <br />
                  <small>→ {s.acao}</small>
                </li>
              ))}
            </ul>
          </Panel>
        )}
        {!!r.experimentos_ab?.length && (
          <Panel icon={<Sparkles size={18} />} title="Testes A/B sugeridos">
            <ul className="loja-ia-list">
              {r.experimentos_ab.map((x) => (
                <li key={x.hipotese}>
                  <strong>{x.hipotese}</strong>
                  <br />
                  <small>
                    Variação: {x.variacao} · Métrica: {x.metrica}
                  </small>
                </li>
              ))}
            </ul>
          </Panel>
        )}
        {!!r.limitacoes_dos_dados?.length && (
          <Panel icon={<AlertTriangle size={18} />} title="Limitações dos dados">
            <ul className="loja-ia-list">
              {r.limitacoes_dos_dados.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          </Panel>
        )}
      </div>
    </div>
  )
}

function renderChatText(text: string) {
  return text.split('\n').map((line, i) => (
    <p key={i}>
      {line.split(/(\*\*[^*]+\*\*)/g).map((part, j) =>
        part.startsWith('**') && part.endsWith('**') ? <strong key={j}>{part.slice(2, -2)}</strong> : part
      )}
    </p>
  ))
}

function IaChatPanel({ empresaId, periodo, analiseId }: { empresaId: string; periodo: IaPeriodo; analiseId: string | null }) {
  const [messages, setMessages] = useState<IaChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMessages([])
  }, [analiseId])

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest' })
  }, [messages, loading])

  const send = async (text: string) => {
    const pergunta = text.trim()
    if (!pergunta || loading) return
    const next: IaChatMessage[] = [...messages, { role: 'user', content: pergunta }]
    setMessages(next)
    setInput('')
    setLoading(true)
    setError(null)
    try {
      const resposta = await iaChat(empresaId, { periodo, analiseId, messages: next })
      setMessages([...next, { role: 'assistant', content: resposta }])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao consultar a IA.')
    } finally {
      setLoading(false)
    }
  }

  const sugestoes = [
    'O abandono é mais por causa do frete ou do preço?',
    'Quais regiões devo priorizar com frete grátis?',
    'Quais produtos precisam de fotos ou descrição melhores?',
    'Em que horário devo anunciar?',
  ]

  return (
    <Panel icon={<MessageSquare size={18} />} title="Pergunte à IA sobre seus dados" wide>
      <div className="loja-ia-chat">
        {messages.length === 0 && (
          <div className="loja-ia-toolbar">
            {sugestoes.map((s) => (
              <button key={s} type="button" className="btn btn--secondary btn--sm" onClick={() => void send(s)}>
                {s}
              </button>
            ))}
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`loja-ia-chat-msg loja-ia-chat-msg--${m.role}`}>
            {m.role === 'assistant' ? renderChatText(m.content) : m.content}
          </div>
        ))}
        {loading && <div className="loja-ia-chat-msg loja-ia-chat-msg--assistant">Analisando…</div>}
        {error && <p className="loja-online-field-error">{error}</p>}
        <div ref={endRef} />
        <form
          className="loja-ia-chat-form"
          onSubmit={(e) => {
            e.preventDefault()
            void send(input)
          }}
        >
          <input
            className="input-el"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ex.: por que o pessoal de SP abandona mais?"
            maxLength={1000}
          />
          <Button type="submit" variant="primary" size="sm" disabled={loading || !input.trim()}>
            <Send size={16} />
          </Button>
        </form>
      </div>
    </Panel>
  )
}

function IaTab({
  empresaId,
  periodo,
  config,
  onConfigure,
}: {
  empresaId: string
  periodo: IaPeriodo
  config: IaConfigStatus | null
  onConfigure: () => void
}) {
  const { addToast } = useToast()
  const [analises, setAnalises] = useState<IaAnalise[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [foco, setFoco] = useState('')
  const [gerando, setGerando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    iaListarAnalises(empresaId)
      .then((list) => {
        setAnalises(list)
        setSelectedId((cur) => cur ?? list[0]?.id ?? null)
      })
      .catch(() => {})
  }, [empresaId])

  const gerar = async () => {
    setGerando(true)
    setError(null)
    try {
      const { analise } = await iaGerarAnalise(empresaId, periodo, foco.trim() || undefined)
      setAnalises((prev) => [analise, ...prev])
      setSelectedId(analise.id)
      addToast('success', 'Análise gerada.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao gerar análise.')
    } finally {
      setGerando(false)
    }
  }

  if (!config?.configured) {
    return (
      <Card className="page-card">
        <CardBody>
          <div className="loja-ia-empty">
            <Brain size={40} strokeWidth={1.5} />
            <h3>Conecte sua chave da OpenAI</h3>
            <p className="loja-online-hint">
              A análise usa o ChatGPT com a sua própria chave de API. O custo de cada análise é cobrado direto na sua conta OpenAI
              (normalmente centavos).
            </p>
            <Button variant="primary" onClick={onConfigure}>
              <KeyRound size={16} /> Configurar chave
            </Button>
          </div>
        </CardBody>
      </Card>
    )
  }

  const selected = analises.find((a) => a.id === selectedId) ?? null

  return (
    <>
      <Card className="page-card">
        <CardBody>
          <div className="loja-ia-gerar">
            <input
              className="input-el"
              value={foco}
              onChange={(e) => setFoco(e.target.value)}
              maxLength={500}
              placeholder="Foco opcional (ex.: entender o abandono no checkout, avaliar se o frete está caro…)"
            />
            <Button variant="primary" onClick={() => void gerar()} disabled={gerando}>
              {gerando ? <RefreshCw size={16} className="dashboard-spin" /> : <Sparkles size={16} />}
              {gerando ? 'Analisando…' : 'Gerar análise profunda'}
            </Button>
          </div>
          <p className="loja-online-hint" style={{ marginBottom: 0 }}>
            Modelo: <strong>{config.model}</strong>. A IA cruza funil, carrinho, frete, fotos, regiões, dispositivos, idade, horários e
            compara com o período anterior. Pode levar até 1 minuto.
          </p>
          {error && (
            <div className="dashboard-alert dashboard-alert--error" style={{ marginTop: 12 }}>
              <AlertTriangle size={18} />
              {error}
            </div>
          )}
        </CardBody>
      </Card>

      {analises.length > 0 && (
        <div className="loja-ia-toolbar" style={{ marginTop: 12 }}>
          <span className="loja-online-hint" style={{ margin: 0 }}>
            Histórico:
          </span>
          <select className="input-el" value={selectedId ?? ''} onChange={(e) => setSelectedId(e.target.value)}>
            {analises.map((a) => (
              <option key={a.id} value={a.id}>
                {fmtData(a.created_at)} · {new Date(a.periodo_inicio).toLocaleDateString('pt-BR')} a{' '}
                {new Date(a.periodo_fim).toLocaleDateString('pt-BR')}
                {a.foco ? ` · ${a.foco.slice(0, 40)}` : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      {selected ? (
        <AnaliseResultado key={selected.id} r={selected.resultado} />
      ) : (
        !gerando && <p className="loja-online-hint">Nenhuma análise gerada ainda.</p>
      )}

      <IaChatPanel empresaId={empresaId} periodo={periodo} analiseId={selected?.id ?? null} />
    </>
  )
}

function ConfigTab({
  empresaId,
  config,
  onChange,
}: {
  empresaId: string
  config: IaConfigStatus | null
  onChange: (c: IaConfigStatus) => void
}) {
  const { addToast } = useToast()
  const [apiKey, setApiKey] = useState('')
  const initialModel = config?.model ?? 'gpt-5-mini'
  const isPreset = MODELOS.some((m) => m.id === initialModel)
  const [model, setModel] = useState(isPreset ? initialModel : '__custom')
  const [customModel, setCustomModel] = useState(isPreset ? '' : initialModel)
  const [busy, setBusy] = useState(false)

  const save = async () => {
    const modelo = model === '__custom' ? customModel.trim() : model
    if (!modelo) {
      addToast('error', 'Informe o modelo.')
      return
    }
    setBusy(true)
    try {
      const c = await iaConfigSave(empresaId, { apiKey: apiKey.trim() || undefined, model: modelo })
      onChange(c)
      setApiKey('')
      addToast('success', 'Chave validada e salva com segurança.')
    } catch (e) {
      addToast('error', e instanceof Error ? e.message : 'Falha ao salvar.')
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    setBusy(true)
    try {
      onChange(await iaConfigDelete(empresaId))
      addToast('success', 'Chave removida.')
    } catch (e) {
      addToast('error', e instanceof Error ? e.message : 'Falha ao remover.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="page-card config-loja-card">
      <CardHeader>
        <span>
          <KeyRound size={20} /> Chave da API da OpenAI (ChatGPT)
        </span>
      </CardHeader>
      <CardBody className="loja-online-card-body">
        <p className="loja-online-hint">
          Crie uma chave em{' '}
          <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer">
            platform.openai.com/api-keys
          </a>{' '}
          e adicione créditos em Billing. A chave fica guardada apenas no servidor e nunca é exibida de novo.
        </p>
        {config?.configured && (
          <p className="loja-online-hint">
            Chave atual: <code>{config.keyMask}</code> · modelo <strong>{config.model}</strong>
          </p>
        )}
        <label className="input-wrap">
          <span className="input-label">{config?.configured ? 'Nova chave (deixe vazio para manter a atual)' : 'Chave da API'}</span>
          <input
            className="input-el"
            type="password"
            autoComplete="off"
            placeholder="sk-..."
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
        </label>
        <label className="input-wrap">
          <span className="input-label">Modelo</span>
          <select className="input-el" value={model} onChange={(e) => setModel(e.target.value)}>
            {MODELOS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
            <option value="__custom">Outro modelo…</option>
          </select>
        </label>
        {model === '__custom' && (
          <label className="input-wrap">
            <span className="input-label">Nome do modelo</span>
            <input className="input-el" value={customModel} onChange={(e) => setCustomModel(e.target.value)} placeholder="ex.: gpt-5.1" />
          </label>
        )}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Button variant="primary" onClick={() => void save()} disabled={busy || (!config?.configured && !apiKey.trim())}>
            {busy ? 'Validando…' : 'Salvar'}
          </Button>
          {config?.configured && (
            <Button variant="secondary" onClick={() => void remove()} disabled={busy}>
              Remover chave
            </Button>
          )}
        </div>
      </CardBody>
    </Card>
  )
}

export function LojaOnlineInteligenciaPage({ empresaId, slug }: Props) {
  const [aba, setAba] = useState<Aba>('visao')
  const [periodoId, setPeriodoId] = useState<PeriodoId>('30d')
  const [periodo, setPeriodo] = useState<IaPeriodo>(() => rangeFor('30d'))
  const [metricas, setMetricas] = useState<IaMetricas | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [config, setConfig] = useState<IaConfigStatus | null>(null)

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

  useEffect(() => {
    iaConfigStatus(empresaId)
      .then(setConfig)
      .catch(() => setConfig({ configured: false, keyMask: null, model: 'gpt-5-mini' }))
  }, [empresaId])

  const escolherPeriodo = (id: PeriodoId) => {
    setPeriodoId(id)
    setPeriodo(rangeFor(id))
  }

  const abas: { id: Aba; label: string; icon: React.ReactNode }[] = [
    { id: 'visao', label: 'Comportamento', icon: <TrendingUp size={16} /> },
    { id: 'heatmap', label: 'Mapa de calor', icon: <Flame size={16} /> },
    { id: 'ia', label: 'Análise com IA', icon: <Brain size={16} /> },
    { id: 'config', label: 'Chave OpenAI', icon: <KeyRound size={16} /> },
  ]

  return (
    <div className="loja-online-dashboard loja-ia-page">
      <header className="dashboard-header" style={{ marginBottom: 16 }}>
        <div>
          <h2 className="dashboard-header__title" style={{ fontSize: '1.35rem' }}>
            Inteligência da loja
          </h2>
          <p className="dashboard-header__subtitle">Comportamento dos visitantes, travamentos e diagnóstico com IA</p>
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
      {aba === 'ia' && <IaTab empresaId={empresaId} periodo={periodo} config={config} onConfigure={() => setAba('config')} />}
      {aba === 'config' && <ConfigTab empresaId={empresaId} config={config} onChange={setConfig} />}
    </div>
  )
}
