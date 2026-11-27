/**
 * Integração com o programa Agiliza Impressão (impressão direta na térmica, sem o navegador).
 *
 * Cada loja cadastra "impressoras" (ex.: Caixa 1). Cada computador com o programa
 * liga uma delas à impressora do Windows. Este navegador guarda qual impressora
 * usar; se não houver escolha e a loja tiver só uma, usa ela. Quando nenhum
 * computador com o programa está online, o sistema volta a imprimir pelo navegador.
 */
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase'
import type { DocumentoImpressao } from './cupom-escpos'

export type ImpressoraLogica = { id: string; empresa_id: string; nome: string; ativo: boolean; created_at: string }
export type EstacaoImpressao = {
  id: string
  empresa_id: string
  nome: string
  ultimo_contato: string | null
  versao: string | null
  created_at: string
}
export type JobImpressao = {
  id: string
  impressora_id: string
  tipo: string
  titulo: string | null
  status: 'pendente' | 'imprimindo' | 'impresso' | 'falhou'
  erro: string | null
  created_at: string
  concluido_em: string | null
}

/** Computador visto há menos disso conta como online (o programa avisa a cada 2 min). */
const ONLINE_MS = 5 * 60 * 1000
/** Valor salvo neste navegador para forçar a impressão pelo navegador. */
export const DESTINO_NAVEGADOR = 'navegador'

const chaveDestino = (empresaId: string) => `agiliza:impressao:destino:${empresaId}`

export function getDestinoLocal(empresaId: string): string | null {
  try {
    return window.localStorage.getItem(chaveDestino(empresaId))
  } catch {
    return null
  }
}

export function setDestinoLocal(empresaId: string, valor: string | null): void {
  try {
    if (valor) window.localStorage.setItem(chaveDestino(empresaId), valor)
    else window.localStorage.removeItem(chaveDestino(empresaId))
  } catch {
    /* navegador sem armazenamento: usa a regra automática */
  }
  cache.delete(empresaId)
}

export function estacaoOnline(e: Pick<EstacaoImpressao, 'ultimo_contato'>): boolean {
  if (!e.ultimo_contato) return false
  return Date.now() - new Date(e.ultimo_contato).getTime() < ONLINE_MS
}

// ── Cadastro ────────────────────────────────────────────────────────────────

export async function listImpressoras(empresaId: string): Promise<ImpressoraLogica[]> {
  const { data, error } = await supabase
    .from('impressao_impressoras')
    .select('id, empresa_id, nome, ativo, created_at')
    .eq('empresa_id', empresaId)
    .order('nome')
  if (error) throw error
  return (data ?? []) as ImpressoraLogica[]
}

export async function criarImpressora(empresaId: string, nome: string): Promise<void> {
  const { error } = await supabase.from('impressao_impressoras').insert({ empresa_id: empresaId, nome: nome.trim() })
  if (error) {
    if (error.code === '23505') throw new Error('Já existe uma impressora com esse nome.')
    throw error
  }
  cache.delete(empresaId)
}

export async function renomearImpressora(id: string, nome: string): Promise<void> {
  const { error } = await supabase.from('impressao_impressoras').update({ nome: nome.trim() }).eq('id', id)
  if (error) {
    if (error.code === '23505') throw new Error('Já existe uma impressora com esse nome.')
    throw error
  }
  cache.clear()
}

export async function excluirImpressora(id: string): Promise<void> {
  const { error } = await supabase.from('impressao_impressoras').delete().eq('id', id)
  if (error) throw error
  cache.clear()
}

export async function listEstacoes(empresaId: string): Promise<EstacaoImpressao[]> {
  const { data, error } = await supabase
    .from('impressao_estacoes')
    .select('id, empresa_id, nome, ultimo_contato, versao, created_at')
    .eq('empresa_id', empresaId)
    .order('created_at')
  if (error) throw error
  return (data ?? []) as EstacaoImpressao[]
}

export async function excluirEstacao(id: string): Promise<void> {
  const { error } = await supabase.from('impressao_estacoes').delete().eq('id', id)
  if (error) throw error
  cache.clear()
}

/** Cria o computador e devolve o código AGILIZA-… para colar no programa (aparece uma única vez). */
export async function gerarCodigoConexao(empresaId: string, nomeComputador: string): Promise<string> {
  const { data, error } = await supabase.rpc('criar_estacao_impressao', {
    p_empresa_id: empresaId,
    p_nome: nomeComputador.trim(),
  })
  if (error) throw new Error(error.message)
  const json = JSON.stringify({ v: 1, url: SUPABASE_URL, key: SUPABASE_ANON_KEY, token: String(data) })
  const base64url = btoa(unescape(encodeURIComponent(json))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `AGILIZA-${base64url}`
}

export async function listJobsRecentes(empresaId: string, limite = 30): Promise<JobImpressao[]> {
  const { data, error } = await supabase
    .from('impressao_jobs')
    .select('id, impressora_id, tipo, titulo, status, erro, created_at, concluido_em')
    .eq('empresa_id', empresaId)
    .order('created_at', { ascending: false })
    .limit(limite)
  if (error) throw error
  return (data ?? []) as JobImpressao[]
}

export async function enviarTeste(empresaId: string, impressoraId: string, enviadoPor?: string | null): Promise<void> {
  const { error } = await supabase.from('impressao_jobs').insert({
    empresa_id: empresaId,
    impressora_id: impressoraId,
    tipo: 'teste',
    titulo: 'Teste de impressão',
    payload: { enviado_por: enviadoPor ?? null, created_at: new Date().toLocaleString('pt-BR') },
  })
  if (error) throw error
}

// ── Envio dos cupons ────────────────────────────────────────────────────────

type Destino = { impressoraId: string } | null
const cache = new Map<string, { at: number; destino: Destino }>()
const CACHE_MS = 30 * 1000

/**
 * Para qual impressora mandar a partir deste navegador, ou null para usar o navegador.
 * Só usa o programa quando algum computador da loja está online.
 */
export async function resolverDestino(empresaId: string): Promise<Destino> {
  if (!empresaId) return null
  const salvo = getDestinoLocal(empresaId)
  if (salvo === DESTINO_NAVEGADOR) return null
  const emCache = cache.get(empresaId)
  if (emCache && Date.now() - emCache.at < CACHE_MS) return emCache.destino

  let destino: Destino = null
  try {
    const [impressoras, estacoes] = await Promise.all([listImpressoras(empresaId), listEstacoes(empresaId)])
    const ativas = impressoras.filter((i) => i.ativo)
    const algumOnline = estacoes.some(estacaoOnline)
    if (algumOnline && ativas.length) {
      const escolhida = salvo ? ativas.find((i) => i.id === salvo) : ativas.length === 1 ? ativas[0] : undefined
      if (escolhida) destino = { impressoraId: escolhida.id }
    }
  } catch {
    // Tabelas ainda não criadas ou sem internet: segue pelo navegador.
    destino = null
  }
  cache.set(empresaId, { at: Date.now(), destino })
  return destino
}

/** true quando os cupons deste navegador vão para o Agiliza Impressão (sem janela do navegador). */
export async function impressaoDiretaAtiva(empresaId: string): Promise<boolean> {
  return (await resolverDestino(empresaId)) !== null
}

/**
 * Tenta mandar o documento para o Agiliza Impressão.
 * `usado: false` = não há programa disponível; quem chamou imprime pelo navegador.
 */
export async function imprimirViaAgente(
  empresaId: string,
  titulo: string,
  documento: DocumentoImpressao
): Promise<{ usado: boolean; ok: boolean; error?: string }> {
  const destino = await resolverDestino(empresaId)
  if (!destino) return { usado: false, ok: false }
  const { error } = await supabase.from('impressao_jobs').insert({
    empresa_id: empresaId,
    impressora_id: destino.impressoraId,
    tipo: 'documento',
    titulo: titulo.slice(0, 120),
    payload: documento,
  })
  if (error) {
    cache.delete(empresaId)
    return { usado: false, ok: false, error: error.message }
  }
  return { usado: true, ok: true }
}
