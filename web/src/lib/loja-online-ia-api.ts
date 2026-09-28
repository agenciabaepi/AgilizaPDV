import { WEB_SESSION_KEY } from './auth-session'

function sessionHeaders(): Record<string, string> {
  try {
    const raw = localStorage.getItem(WEB_SESSION_KEY)
    if (!raw) return {}
    return { 'X-Agiliza-Session': btoa(raw) }
  } catch {
    return {}
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/loja-online/${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...sessionHeaders(), ...(init?.headers ?? {}) },
  })
  const text = await res.text()
  let data: (T & { ok?: boolean; error?: string }) | null = null
  try {
    data = text ? (JSON.parse(text) as T & { ok?: boolean; error?: string }) : null
  } catch {
    throw new Error(`Resposta inválida do servidor (HTTP ${res.status}).`)
  }
  if (!res.ok || !data || data.ok === false) {
    throw new Error(data?.error || `Falha na requisição (HTTP ${res.status}).`)
  }
  return data
}

export type IaPeriodo = { inicio: string; fim: string }

export type NomeTotal = { nome: string; total: number }

export type SegmentoRow = {
  nome: string
  sessoes: number
  carrinhos: number
  compras: number
  conversao_pct: number
  abandono_carrinho_pct: number | null
}

export type FaixaAbandono = { faixa: string; sessoes: number; compras: number; abandono_pct: number }

export type IaFreteConsultas = {
  total_consultas: number
  consultas_com_sucesso: number
  consultas_com_erro: number
  sessoes_que_consultaram: number
  consultas_por_sessao_media: number
  sessoes_que_recalcularam_varias_vezes: number
  frete_cotado_medio: number | null
  frete_cotado_mediana: number | null
  frete_gratis_pct_das_consultas: number
  por_origem: { origem: string; consultas: number; sessoes: number; compras: number; conversao_pct: number; frete_medio: number }[]
  pagina_produto: {
    consultas: number
    adicionaram_ao_carrinho_pct: number
    compraram_pct: number
    frete_medio_quem_adicionou: number | null
    frete_medio_quem_nao_adicionou: number | null
    por_faixa_frete: { faixa: string; consultas: number; adicionaram: number; compraram: number; desistiram_pct: number }[]
  }
  erros_top: { nome: string; total: number }[]
  ultimas: {
    quando: string
    origem: string
    uf: string | null
    subtotal: number | null
    frete: number | null
    prazo: number | null
    tipo: string | null
    erro: string | null
    resultado: string
  }[]
}

export type IaCapaPersonalizada = {
  tracking_por_sessao: {
    sessoes_que_comecaram: number
    abandonaram: number
    abandono_pct: number
    valor_no_carrinho_nao_comprado: number
    usaram_texto_pct: number
    trocaram_de_modelo: number
    tempo_medio_no_editor_s: number | null
    tempo_mediano_no_editor_s: number | null
  }
  funil: {
    etapa: string
    sessoes: number
    pct_de_quem_comecou: number | null
    queda_da_etapa_anterior_pct: number | null
  }[]
  abandonaram_em: { nome: string; total: number }[]
  modelos_mais_escolhidos: { nome: string; total: number }[]
  modelos_no_carrinho: { nome: string; total: number }[]
  erros_top: { nome: string; total: number }[]
  artes_salvas: {
    capas_colocadas_no_carrinho: number
    capas_vendidas: number
    capas_nao_compradas: number
    conversao_carrinho_para_venda_pct: number
    vendas_por_modelo: { nome: string; total: number }[]
  }
}

export type IaMetricas = {
  periodo: { inicio: string; fim: string; dias: number }
  qualidade_dados: {
    sessoes_total: number
    sessoes_com_tracking_avancado: number
    tracking_avancado_desde: string | null
    eventos_funil: number
    eventos_comportamento: number
    dados_truncados: boolean
    clientes_com_data_nascimento: number
  }
  visao_geral: {
    sessoes: number
    visitantes_unicos: number | null
    visitantes_recorrentes_pct: number | null
    pedidos: number
    pedidos_cancelados: number
    receita: number
    ticket_medio: number
    conversao_pct: number
    tempo_medio_sessao_s: number
    tempo_mediano_sessao_s: number
    paginas_por_sessao: number
    rejeicao_pct: number
  }
  funil: { etapa: string; sessoes: number; pct_do_topo: number; queda_da_etapa_anterior_pct: number }[]
  carrinho: {
    sessoes_com_carrinho: number
    sessoes_que_compraram: number
    abandono_pct: number
    valor_abandonado_estimado: number
    carrinho_medio_abandonado: number | null
    tempo_medio_sessao_abandono_s: number
    abandonaram_em: NomeTotal[]
    produtos_mais_removidos: NomeTotal[]
  }
  checkout: {
    etapas_abertas: { etapa: string; sessoes: number }[]
    modo_entrega: NomeTotal[]
    metodos_pagamento: { metodo: string; escolhas: number; compras: number; conclusao_pct: number }[]
    cupons: { tentativas: number; sucesso: number; falhas_top: NomeTotal[] }
    erros_checkout_top: NomeTotal[]
    erros_frete_top: NomeTotal[]
  }
  frete: {
    sessoes_com_cotacao: number
    conversao_apos_cotacao_pct: number
    frete_medio_compradores: number | null
    frete_medio_abandonos: number | null
    frete_sobre_carrinho_compradores_pct: number | null
    frete_sobre_carrinho_abandonos_pct: number | null
    prazo_medio_compradores_dias: number | null
    prazo_medio_abandonos_dias: number | null
    abandono_por_valor_frete: FaixaAbandono[]
    abandono_por_peso_no_carrinho: FaixaAbandono[]
    por_uf: { uf: string; cotacoes: number; compras: number; abandono_pct: number; frete_medio: number }[]
    pedidos_frete_medio: number
    consultas?: IaFreteConsultas
  }
  preco: {
    por_faixa: { faixa: string; views: number; adds: number; compras: number; taxa_add_pct: number; taxa_compra_pct: number }[]
    pedidos_com_cupom_pct: number
  }
  galeria: {
    visualizacoes_produto_com_varias_midias: number
    media_midias_vistas_pct: number | null
    viram_todas_pct: number
    viram_so_a_primeira_pct: number
    taxa_add_quem_viu_todas_pct: number
    taxa_add_quem_nao_viu_todas_pct: number
  }
  produtos: {
    produto_id: string
    nome: string
    preco: number | null
    visualizacoes: number
    add_carrinho: number
    compras: number
    taxa_add_pct: number
    taxa_compra_pct: number
    abandono_carrinho_pct: number | null
    tempo_medio_pagina_s: number | null
    fotos_vistas_media_pct: number | null
    removido_do_carrinho: number
  }[]
  /** Ausente em análises antigas; null quando a loja não usa capa personalizada. */
  capa_personalizada?: IaCapaPersonalizada | null
  engajamento: {
    tempo_por_tipo_pagina: { tipo: string; amostras: number; media_s: number; mediana_s: number }[]
    scroll_por_tipo_pagina: { tipo: string; amostras: number; media_pct: number; chegaram_50_pct: number; chegaram_ao_fim_pct: number }[]
    paginas_de_saida_sem_compra: NomeTotal[]
    cliques_top: NomeTotal[]
    rage_clicks_top: NomeTotal[]
    erros_js_top: NomeTotal[]
    buscas_top: NomeTotal[]
    buscas_sem_resultado: NomeTotal[]
    variacoes_mais_escolhidas: NomeTotal[]
  }
  segmentos: {
    dispositivo: SegmentoRow[]
    origem: SegmentoRow[]
    regiao_uf: SegmentoRow[]
    cidade: SegmentoRow[]
    novos_vs_recorrentes: SegmentoRow[]
    faixa_etaria_sessoes: SegmentoRow[]
    faixa_etaria_pedidos: NomeTotal[]
    hora_do_dia: { hora: string; sessoes: number; compras: number; conversao_pct: number }[]
    dia_da_semana: { dia: string; sessoes: number; compras: number; conversao_pct: number }[]
  }
}

export type IaHeatmap = {
  alvo: string
  device: 'desktop' | 'mobile'
  viewportMedio: number
  pontos: { x: number; y: number; dh: number; rage: boolean }[]
  elementosTop: NomeTotal[]
  scroll: { amostras: number; faixas: { limite: number; pct: number }[] }
  tipos: NomeTotal[]
  paginas: NomeTotal[]
}

export type IaSeveridade = 'critica' | 'alta' | 'media' | 'baixa'

export type IaResultado = {
  resumo_executivo?: string
  nota_saude?: number
  diagnostico_principal?: string
  metricas_chave?: { nome: string; valor: string; leitura: 'bom' | 'atencao' | 'critico'; comentario: string }[]
  hipoteses_abandono?: {
    causa: string
    titulo: string
    probabilidade: 'alta' | 'media' | 'baixa'
    evidencias: string[]
    como_validar: string
  }[]
  insights?: {
    categoria: string
    titulo: string
    severidade: IaSeveridade
    evidencia: string
    recomendacao: string
    impacto_estimado: string
    esforco: 'baixo' | 'medio' | 'alto'
  }[]
  produtos_atencao?: { nome: string; problema: string; acao: string }[]
  segmentos_destaque?: { segmento: string; observacao: string; acao: string }[]
  plano_de_acao?: { prioridade: number; acao: string; por_que: string; prazo: string; kpi: string }[]
  experimentos_ab?: { hipotese: string; variacao: string; metrica: string }[]
  limitacoes_dos_dados?: string[]
}

export type IaAnalise = {
  id: string
  periodo_inicio: string
  periodo_fim: string
  modelo: string | null
  foco: string | null
  resultado: IaResultado
  tokens_entrada: number | null
  tokens_saida: number | null
  created_at: string
}

export type IaConfigStatus = { configured: boolean; keyMask: string | null; model: string }

export type IaChatMessage = { role: 'user' | 'assistant'; content: string }

function qs(params: Record<string, string>) {
  return new URLSearchParams(params).toString()
}

export function iaConfigStatus(empresaId: string) {
  return request<IaConfigStatus>(`ia-config?${qs({ empresaId })}`)
}

export function iaConfigSave(empresaId: string, input: { apiKey?: string; model: string }) {
  return request<IaConfigStatus>('ia-config', { method: 'POST', body: JSON.stringify({ empresaId, ...input }) })
}

export function iaConfigDelete(empresaId: string) {
  return request<IaConfigStatus>(`ia-config?${qs({ empresaId })}`, { method: 'DELETE' })
}

export async function iaMetricas(empresaId: string, periodo: IaPeriodo) {
  const r = await request<{ metricas: IaMetricas }>(`ia-metricas?${qs({ empresaId, ...periodo })}`)
  return r.metricas
}

export type PresencaRow = {
  session_id: string
  path: string | null
  titulo: string | null
  device: string | null
  country: string | null
  region: string | null
  city: string | null
  carrinho: boolean
  checkout: boolean
  oculto: boolean
  desde: string
  pagina_desde: string
  last_seen: string
}

export async function presencaListar(empresaId: string) {
  return request<{ agora: number; visitantes: PresencaRow[] }>(`presenca?${qs({ empresaId })}`)
}

export async function capaMetricas(empresaId: string, periodo: IaPeriodo) {
  const r = await request<{ capa: IaCapaPersonalizada | null }>(`capa-metricas?${qs({ empresaId, ...periodo })}`)
  return r.capa
}

export function iaHeatmap(empresaId: string, periodo: IaPeriodo, alvo: string, device: 'desktop' | 'mobile') {
  return request<IaHeatmap>(`ia-heatmap?${qs({ empresaId, ...periodo, alvo, device })}`)
}

export async function iaListarAnalises(empresaId: string) {
  const r = await request<{ analises: IaAnalise[] }>(`ia-analisar?${qs({ empresaId })}`)
  return r.analises
}

export async function iaGerarAnalise(empresaId: string, periodo: IaPeriodo, foco?: string) {
  const r = await request<{ analise: IaAnalise; metricas: IaMetricas }>('ia-analisar', {
    method: 'POST',
    body: JSON.stringify({ empresaId, ...periodo, foco: foco ?? '' }),
  })
  return r
}

export async function iaChat(
  empresaId: string,
  input: { periodo: IaPeriodo; analiseId?: string | null; messages: IaChatMessage[] }
) {
  const r = await request<{ resposta: string }>('ia-chat', {
    method: 'POST',
    body: JSON.stringify({ empresaId, ...input.periodo, analiseId: input.analiseId ?? '', messages: input.messages }),
  })
  return r.resposta
}
