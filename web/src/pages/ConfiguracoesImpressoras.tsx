import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { Layout } from '../components/Layout'
import { PageTitle, Card, CardHeader, CardBody, Button, Input, Alert, Select, ConfirmDialog, useOperationToast } from '../components/ui'
import { Printer, Download, Monitor, Plus, Trash2, Copy, RefreshCw, Pencil, Check, X } from 'lucide-react'
import {
  DESTINO_NAVEGADOR,
  criarImpressora,
  enviarTeste,
  estacaoOnline,
  excluirEstacao,
  excluirImpressora,
  gerarCodigoConexao,
  getDestinoLocal,
  listEstacoes,
  listImpressoras,
  listJobsRecentes,
  renomearImpressora,
  setDestinoLocal,
  type EstacaoImpressao,
  type ImpressoraLogica,
  type JobImpressao,
} from '../lib/impressao-agente'

/** Instalador sempre na versão mais nova (regravado a cada versão pelo GitHub Actions). */
const DOWNLOAD_URL =
  'https://github.com/agenciabaepi/AgilizaPDV/releases/download/impressao-atual/Agiliza-Impressao-Setup.exe'

const STATUS_JOB: Record<JobImpressao['status'], { label: string; cor: string }> = {
  pendente: { label: 'Na fila', cor: 'var(--color-text-secondary)' },
  imprimindo: { label: 'Imprimindo', cor: 'var(--color-primary)' },
  impresso: { label: 'Impresso', cor: 'var(--color-success, #16a34a)' },
  falhou: { label: 'Falhou', cor: 'var(--color-error, #dc2626)' },
}

function quando(iso: string | null): string {
  if (!iso) return 'nunca'
  const seg = Math.round((Date.now() - new Date(iso).getTime()) / 1000)
  if (seg < 60) return 'agora'
  if (seg < 3600) return `há ${Math.round(seg / 60)} min`
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export function ConfiguracoesImpressoras() {
  const { session } = useAuth()
  const op = useOperationToast()
  const empresaId = session && 'empresa_id' in session ? (session.empresa_id ?? '') : ''
  const usuarioNome = session && 'nome' in session ? String(session.nome ?? '') : ''

  const [impressoras, setImpressoras] = useState<ImpressoraLogica[]>([])
  const [estacoes, setEstacoes] = useState<EstacaoImpressao[]>([])
  const [jobs, setJobs] = useState<JobImpressao[]>([])
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [tabelasFaltando, setTabelasFaltando] = useState(false)

  const [novaImpressora, setNovaImpressora] = useState('')
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [editandoNome, setEditandoNome] = useState('')
  const [nomeComputador, setNomeComputador] = useState('')
  const [codigoGerado, setCodigoGerado] = useState<string | null>(null)
  const [gerando, setGerando] = useState(false)
  const [destino, setDestino] = useState<string>(() => (empresaId ? getDestinoLocal(empresaId) ?? '' : ''))
  const [excluir, setExcluir] = useState<
    { tipo: 'impressora'; item: ImpressoraLogica } | { tipo: 'estacao'; item: EstacaoImpressao } | null
  >(null)

  const carregar = useCallback(async () => {
    if (!empresaId) return
    try {
      const [imp, est, jb] = await Promise.all([
        listImpressoras(empresaId),
        listEstacoes(empresaId),
        listJobsRecentes(empresaId),
      ])
      setImpressoras(imp)
      setEstacoes(est)
      setJobs(jb)
      setTabelasFaltando(false)
      setErro('')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String((err as { message?: string })?.message ?? err)
      if (/impressao_|does not exist|schema cache/i.test(msg)) setTabelasFaltando(true)
      else setErro(msg)
    } finally {
      setCarregando(false)
    }
  }, [empresaId])

  useEffect(() => {
    void carregar()
    const t = window.setInterval(() => void carregar(), 15_000)
    return () => window.clearInterval(t)
  }, [carregar])

  const nomeImpressora = (id: string) => impressoras.find((i) => i.id === id)?.nome ?? 'Impressora'

  const adicionarImpressora = async () => {
    const nome = novaImpressora.trim()
    if (!nome) return
    try {
      await criarImpressora(empresaId, nome)
      setNovaImpressora('')
      op.saved('Impressora cadastrada.')
      await carregar()
    } catch (err) {
      op.failed(err, 'Erro ao cadastrar impressora.')
    }
  }

  const salvarNome = async () => {
    if (!editandoId || !editandoNome.trim()) return
    try {
      await renomearImpressora(editandoId, editandoNome)
      setEditandoId(null)
      op.saved('Nome alterado.')
      await carregar()
    } catch (err) {
      op.failed(err, 'Erro ao renomear impressora.')
    }
  }

  const gerarCodigo = async () => {
    const nome = nomeComputador.trim()
    if (!nome) {
      setErro('Dê um nome para o computador (ex.: Caixa 1).')
      return
    }
    setGerando(true)
    try {
      const codigo = await gerarCodigoConexao(empresaId, nome)
      setCodigoGerado(codigo)
      setNomeComputador('')
      await carregar()
    } catch (err) {
      op.failed(err, 'Erro ao gerar código.')
    } finally {
      setGerando(false)
    }
  }

  const copiarCodigo = async () => {
    if (!codigoGerado) return
    try {
      await navigator.clipboard.writeText(codigoGerado)
      op.saved('Código copiado.')
    } catch {
      setErro('Não foi possível copiar. Selecione o código e copie manualmente.')
    }
  }

  const testar = async (imp: ImpressoraLogica) => {
    try {
      await enviarTeste(empresaId, imp.id, usuarioNome || null)
      op.saved(`Teste enviado para ${imp.nome}.`)
      window.setTimeout(() => void carregar(), 3000)
    } catch (err) {
      op.failed(err, 'Erro ao enviar teste.')
    }
  }

  const mudarDestino = (valor: string) => {
    setDestino(valor)
    setDestinoLocal(empresaId, valor || null)
    op.saved('Preferência deste computador salva.')
  }

  const confirmarExclusao = async () => {
    if (!excluir) return
    try {
      if (excluir.tipo === 'impressora') await excluirImpressora(excluir.item.id)
      else {
        await excluirEstacao(excluir.item.id)
        setCodigoGerado(null)
      }
      op.saved(excluir.tipo === 'impressora' ? 'Impressora excluída.' : 'Computador desconectado.')
      await carregar()
    } catch (err) {
      op.failed(err, 'Erro ao excluir.')
    }
  }

  const algumOnline = estacoes.some(estacaoOnline)
  const ativas = impressoras.filter((i) => i.ativo)
  const destinoAutomatico =
    !algumOnline
      ? 'Navegador (nenhum computador com o programa está online)'
      : ativas.length === 1
        ? `${ativas[0].nome} (única impressora)`
        : 'Navegador (escolha uma impressora abaixo)'

  return (
    <Layout>
      <PageTitle
        title="Impressoras"
        subtitle="Imprima cupons direto na impressora térmica, sem a janela do navegador, com o programa Agiliza Impressão."
      />

      {erro && (
        <Alert variant="error" style={{ marginBottom: 16 }}>
          {erro}
        </Alert>
      )}
      {tabelasFaltando && (
        <Alert variant="error" style={{ marginBottom: 16 }}>
          A impressão direta ainda não foi ativada no banco de dados. Rode o arquivo
          <strong> web/sql/supabase-impressao-agente.sql </strong> no Supabase.
        </Alert>
      )}

      <div className="impressoras-page">
        <Card className="page-card">
          <CardHeader>
            <span className="fiscal-card-title">
              <Download size={20} />
              1. Instale o Agiliza Impressão
            </span>
          </CardHeader>
          <CardBody>
            <p className="impressoras-texto">
              Instale no computador (Windows) que tem a impressora térmica ligada. O programa fica ao lado do relógio,
              abre junto com o Windows e se atualiza sozinho.
            </p>
            <a className="btn btn--primary btn--md" href={DOWNLOAD_URL} target="_blank" rel="noreferrer">
              <Download size={18} />
              Baixar Agiliza Impressão
            </a>
          </CardBody>
        </Card>

        <Card className="page-card">
          <CardHeader>
            <span className="fiscal-card-title">
              <Printer size={20} />
              2. Impressoras da loja
            </span>
          </CardHeader>
          <CardBody>
            <p className="impressoras-texto">
              Cadastre um nome para cada impressora térmica (ex.: Caixa 1, Caixa 2). No programa, você liga cada nome à
              impressora do Windows.
            </p>
            <div className="impressoras-lista">
              {carregando ? (
                <div className="impressoras-vazio">Carregando…</div>
              ) : impressoras.length === 0 ? (
                <div className="impressoras-vazio">Nenhuma impressora cadastrada.</div>
              ) : (
                impressoras.map((imp) => (
                  <div key={imp.id} className="impressoras-item">
                    {editandoId === imp.id ? (
                      <div className="impressoras-item-edit">
                        <Input
                          value={editandoNome}
                          onChange={(e) => setEditandoNome(e.currentTarget.value)}
                          maxLength={40}
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') void salvarNome()
                            if (e.key === 'Escape') setEditandoId(null)
                          }}
                        />
                        <button type="button" className="produtos-acao-btn" onClick={() => void salvarNome()} title="Salvar">
                          <Check size={15} />
                        </button>
                        <button type="button" className="produtos-acao-btn" onClick={() => setEditandoId(null)} title="Cancelar">
                          <X size={15} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <span className="impressoras-item-nome">{imp.nome}</span>
                        <div className="impressoras-item-acoes">
                          <Button variant="secondary" size="sm" onClick={() => void testar(imp)} disabled={!algumOnline}>
                            Imprimir teste
                          </Button>
                          <button
                            type="button"
                            className="produtos-acao-btn"
                            onClick={() => {
                              setEditandoId(imp.id)
                              setEditandoNome(imp.nome)
                            }}
                            title="Renomear"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            type="button"
                            className="produtos-acao-btn produtos-acao-btn--danger"
                            onClick={() => setExcluir({ tipo: 'impressora', item: imp })}
                            title="Excluir"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
            <div className="impressoras-add">
              <Input
                placeholder="Nome da impressora (ex.: Caixa 1)"
                value={novaImpressora}
                maxLength={40}
                onChange={(e) => setNovaImpressora(e.currentTarget.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void adicionarImpressora()
                }}
              />
              <Button leftIcon={<Plus size={16} />} onClick={() => void adicionarImpressora()} disabled={!novaImpressora.trim()}>
                Adicionar
              </Button>
            </div>
          </CardBody>
        </Card>

        <Card className="page-card">
          <CardHeader>
            <span className="fiscal-card-title">
              <Monitor size={20} />
              3. Computadores conectados
            </span>
          </CardHeader>
          <CardBody>
            <p className="impressoras-texto">
              Gere um código, abra o Agiliza Impressão no computador e cole o código. Cada computador tem o seu código.
            </p>
            <div className="impressoras-lista">
              {estacoes.length === 0 ? (
                <div className="impressoras-vazio">Nenhum computador conectado.</div>
              ) : (
                estacoes.map((e) => {
                  const online = estacaoOnline(e)
                  return (
                    <div key={e.id} className="impressoras-item">
                      <span className="impressoras-item-nome">
                        <span className={`impressoras-dot ${online ? 'is-online' : ''}`} aria-hidden />
                        {e.nome}
                        <span className="impressoras-meta">
                          {online ? 'Online' : `Offline · visto ${quando(e.ultimo_contato)}`}
                          {e.versao ? ` · v${e.versao}` : ''}
                        </span>
                      </span>
                      <button
                        type="button"
                        className="produtos-acao-btn produtos-acao-btn--danger"
                        onClick={() => setExcluir({ tipo: 'estacao', item: e })}
                        title="Desconectar"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  )
                })
              )}
            </div>
            <div className="impressoras-add">
              <Input
                placeholder="Nome do computador (ex.: Caixa 1)"
                value={nomeComputador}
                maxLength={40}
                onChange={(e) => setNomeComputador(e.currentTarget.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void gerarCodigo()
                }}
              />
              <Button onClick={() => void gerarCodigo()} disabled={gerando || !nomeComputador.trim()}>
                {gerando ? 'Gerando…' : 'Conectar computador'}
              </Button>
            </div>
            {codigoGerado && (
              <div className="impressoras-codigo">
                <div className="impressoras-codigo-titulo">
                  Código de conexão (aparece só agora — copie e cole no Agiliza Impressão):
                </div>
                <textarea readOnly value={codigoGerado} rows={3} onFocus={(e) => e.currentTarget.select()} />
                <div className="impressoras-codigo-acoes">
                  <Button leftIcon={<Copy size={16} />} onClick={() => void copiarCodigo()}>
                    Copiar código
                  </Button>
                  <Button variant="ghost" onClick={() => setCodigoGerado(null)}>
                    Pronto
                  </Button>
                </div>
              </div>
            )}
          </CardBody>
        </Card>

        <Card className="page-card">
          <CardHeader>
            <span className="fiscal-card-title">
              <Printer size={20} />
              Onde este computador imprime
            </span>
          </CardHeader>
          <CardBody>
            <p className="impressoras-texto">
              Vale só para este navegador. Em cada caixa, escolha a impressora dele.
            </p>
            <Select
              label="Imprimir cupons em"
              value={destino}
              onChange={(e) => mudarDestino(e.currentTarget.value)}
              options={[
                { value: '', label: `Automático — ${destinoAutomatico}` },
                ...ativas.map((i) => ({ value: i.id, label: i.nome })),
                { value: DESTINO_NAVEGADOR, label: 'Sempre pelo navegador' },
              ]}
            />
            {destino && destino !== DESTINO_NAVEGADOR && !algumOnline && (
              <p className="impressoras-meta" style={{ marginTop: 8 }}>
                Nenhum computador com o programa está online agora; enquanto isso, os cupons saem pelo navegador.
              </p>
            )}
          </CardBody>
        </Card>

        <Card className="page-card">
          <CardHeader>
            <span className="fiscal-card-title" style={{ justifyContent: 'space-between', width: '100%' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <Printer size={20} />
                Últimas impressões
              </span>
              <Button variant="ghost" size="sm" leftIcon={<RefreshCw size={14} />} onClick={() => void carregar()}>
                Atualizar
              </Button>
            </span>
          </CardHeader>
          <CardBody>
            {jobs.length === 0 ? (
              <div className="impressoras-vazio">Nada enviado para o programa ainda.</div>
            ) : (
              <div className="impressoras-lista">
                {jobs.map((j) => (
                  <div key={j.id} className="impressoras-item">
                    <span className="impressoras-item-nome">
                      {j.titulo ?? (j.tipo === 'teste' ? 'Teste de impressão' : 'Documento')}
                      <span className="impressoras-meta">
                        {nomeImpressora(j.impressora_id)} · {quando(j.created_at)}
                        {j.erro ? ` · ${j.erro}` : ''}
                      </span>
                    </span>
                    <span style={{ color: STATUS_JOB[j.status]?.cor, fontWeight: 600, fontSize: 13 }}>
                      {STATUS_JOB[j.status]?.label ?? j.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      <ConfirmDialog
        open={excluir !== null}
        onClose={() => setExcluir(null)}
        onConfirm={confirmarExclusao}
        title={excluir?.tipo === 'impressora' ? 'Excluir impressora' : 'Desconectar computador'}
        message={
          excluir?.tipo === 'impressora'
            ? `Excluir "${excluir.item.nome}"? Os cupons na fila dela serão descartados.`
            : `Desconectar "${excluir?.item.nome ?? ''}"? Ele para de imprimir até receber um novo código.`
        }
        confirmLabel={excluir?.tipo === 'impressora' ? 'Excluir' : 'Desconectar'}
        variant="danger"
      />
    </Layout>
  )
}
