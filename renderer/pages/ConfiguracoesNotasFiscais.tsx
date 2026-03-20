import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useEmpresaTheme } from '../hooks/useEmpresaTheme'
import { Layout } from '../components/Layout'
import { PageTitle, Card, CardHeader, CardBody, Button, Input, Alert, Select } from '../components/ui'
import { FileCheck, Save, Upload, Info, Trash2, Plus, Shield } from 'lucide-react'
import type { EmpresaFiscalConfig, UpdateFiscalConfigInput } from '../vite-env'

export function ConfiguracoesNotasFiscais() {
  const { session } = useAuth()
  const { setEmpresaIdForTheme } = useEmpresaTheme()
  const navigate = useNavigate()
  const empresaId = session && 'empresa_id' in session ? session.empresa_id : null

  const [fiscalSaving, setFiscalSaving] = useState(false)
  const [fiscalMessage, setFiscalMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [ambiente, setAmbiente] = useState<'homologacao' | 'producao'>('producao')
  const [serieNfe, setSerieNfe] = useState(1)
  const [ultimoNumeroNfe, setUltimoNumeroNfe] = useState(0)
  const [serieNfce, setSerieNfce] = useState(1)
  const [ultimoNumeroNfce, setUltimoNumeroNfce] = useState(0)
  const [cscNfce, setCscNfce] = useState('')
  const [cscIdNfce, setCscIdNfce] = useState('')
  const [ufEmitente, setUfEmitente] = useState('SP')
  const [ieEmitente, setIeEmitente] = useState('ISENTO')
  const [ncmPadrao, setNcmPadrao] = useState('21069090')
  const [indicarFonteIbpt, setIndicarFonteIbpt] = useState(true)
  const [tributoFederalPct, setTributoFederalPct] = useState(0)
  const [tributoEstadualPct, setTributoEstadualPct] = useState(0)
  const [tributoMunicipalPct, setTributoMunicipalPct] = useState(0)
  const [xmlAutorizados, setXmlAutorizados] = useState<string[]>([])
  const [novoXmlCpfCnpj, setNovoXmlCpfCnpj] = useState('')

  const [certStatus, setCertStatus] = useState<{ hasCertificado: boolean; path: string | null; updatedAt: string | null }>({
    hasCertificado: false,
    path: null,
    updatedAt: null,
  })
  const [certSenha, setCertSenha] = useState('')
  const [certUploading, setCertUploading] = useState(false)
  const [certMessage, setCertMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const isAdmin = session && 'role' in session && session.role?.toLowerCase() === 'admin'

  const loadFiscalConfig = useCallback(() => {
    if (!empresaId) return
    window.electronAPI.empresas.getFiscalConfig(empresaId).then((f: EmpresaFiscalConfig | null) => {
      if (f) {
        setAmbiente(f.ambiente)
        setSerieNfe(f.serie_nfe)
        setUltimoNumeroNfe(f.ultimo_numero_nfe)
        setSerieNfce(f.serie_nfce)
        setUltimoNumeroNfce(f.ultimo_numero_nfce)
        setCscNfce(f.csc_nfce ?? '')
        setCscIdNfce(f.csc_id_nfce ?? '')
        setUfEmitente(f.uf_emitente ?? 'SP')
        setIeEmitente(f.ie_emitente ?? 'ISENTO')
        setNcmPadrao(f.ncm_padrao ?? '21069090')
        setIndicarFonteIbpt(f.indicar_fonte_ibpt)
        setTributoFederalPct(f.tributo_aprox_federal_pct ?? 0)
        setTributoEstadualPct(f.tributo_aprox_estadual_pct ?? 0)
        setTributoMunicipalPct(f.tributo_aprox_municipal_pct ?? 0)
        setXmlAutorizados(f.xml_autorizados ?? [])
      }
    })
  }, [empresaId])

  const loadCertStatus = useCallback(() => {
    if (!empresaId) return
    window.electronAPI.certificado.getStatus(empresaId).then(setCertStatus)
  }, [empresaId])

  useEffect(() => {
    if (!isAdmin) {
      navigate('/dashboard', { replace: true })
      return
    }
    if (!empresaId) {
      navigate('/dashboard', { replace: true })
      return
    }
    loadFiscalConfig()
    loadCertStatus()
  }, [isAdmin, empresaId, navigate, loadFiscalConfig, loadCertStatus])

  useEffect(() => {
    setEmpresaIdForTheme(empresaId || null)
    return () => setEmpresaIdForTheme(null)
  }, [empresaId, setEmpresaIdForTheme])

  const handleSaveFiscal = async () => {
    if (!empresaId) return
    setFiscalSaving(true)
    setFiscalMessage(null)
    try {
      const data: UpdateFiscalConfigInput = {
        ambiente,
        serie_nfe: serieNfe,
        ultimo_numero_nfe: ultimoNumeroNfe,
        serie_nfce: serieNfce,
        ultimo_numero_nfce: ultimoNumeroNfce,
        csc_nfce: cscNfce.trim() || null,
        csc_id_nfce: cscIdNfce.trim() || null,
        uf_emitente: ufEmitente.trim().toUpperCase().slice(0, 2) || 'SP',
        ie_emitente: ieEmitente.trim() || 'ISENTO',
        ncm_padrao: ncmPadrao.replace(/\D/g, '').slice(0, 8) || null,
        indicar_fonte_ibpt: indicarFonteIbpt,
        tributo_aprox_federal_pct: tributoFederalPct,
        tributo_aprox_estadual_pct: tributoEstadualPct,
        tributo_aprox_municipal_pct: tributoMunicipalPct,
        xml_autorizados: xmlAutorizados,
      }
      await window.electronAPI.empresas.updateFiscalConfig(empresaId, data)
      setFiscalMessage({ type: 'success', text: 'Configurações de notas fiscais salvas com sucesso.' })
      loadFiscalConfig()
    } catch {
      setFiscalMessage({ type: 'error', text: 'Erro ao salvar configurações fiscais.' })
    } finally {
      setFiscalSaving(false)
    }
  }

  const handleCertUpload = async () => {
    if (!empresaId) return
    setCertUploading(true)
    setCertMessage(null)
    try {
      const result = await window.electronAPI.certificado.selectAndUpload(empresaId, certSenha)
      if (result.ok) {
        setCertMessage({ type: 'success', text: 'Certificado digital instalado com sucesso.' })
        setCertSenha('')
        loadCertStatus()
      } else {
        setCertMessage({ type: 'error', text: result.error ?? 'Erro ao instalar certificado.' })
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setCertMessage({ type: 'error', text: msg || 'Erro ao instalar certificado.' })
    } finally {
      setCertUploading(false)
    }
  }

  const handleCertRemove = async () => {
    if (!empresaId) return
    setCertUploading(true)
    setCertMessage(null)
    try {
      const result = await window.electronAPI.certificado.remove(empresaId)
      if (result.ok) {
        setCertMessage({ type: 'success', text: 'Certificado removido.' })
        loadCertStatus()
      } else {
        setCertMessage({ type: 'error', text: result.error ?? 'Erro ao remover certificado.' })
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setCertMessage({ type: 'error', text: msg || 'Erro ao remover certificado.' })
    } finally {
      setCertUploading(false)
    }
  }

  const addXmlAutorizado = () => {
    const v = novoXmlCpfCnpj.replace(/\D/g, '')
    if (v.length >= 11) {
      setXmlAutorizados((prev) => (prev.includes(v) ? prev : [...prev, v]))
      setNovoXmlCpfCnpj('')
    }
  }

  const removeXmlAutorizado = (cpfCnpj: string) => {
    setXmlAutorizados((prev) => prev.filter((x) => x !== cpfCnpj))
  }

  if (!isAdmin) return null

  return (
    <Layout>
      <PageTitle
        title="Configurações de Notas Fiscais"
        subtitle="Ambiente, séries NF-e/NFC-e, CSC, certificado digital A1 e pessoas autorizadas a acessar o XML."
      />
      <div className="config-loja-page" style={{ maxWidth: 800 }}>
        <Card className="page-card suporte-config-card">
          <CardHeader>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <FileCheck size={20} />
              Dados para emissão NF-e e NFC-e
            </span>
          </CardHeader>
          <CardBody>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)', marginBottom: 20 }}>
              Configure ambiente, séries e tokens para emissão pela SEFAZ. O certificado digital A1 (PFX) é obrigatório para assinar as notas.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {/* Ambiente */}
              <div>
                <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 8 }}>
                  Ambiente
                </label>
                <Select
                  value={ambiente}
                  onChange={(e) => setAmbiente(e.target.value as 'homologacao' | 'producao')}
                  options={[
                    { value: 'homologacao', label: 'Homologação' },
                    { value: 'producao', label: 'Produção' },
                  ]}
                  style={{ maxWidth: 280 }}
                />
              </div>

              {/* NF-e */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
                <Input
                  label="Série NF-e"
                  type="number"
                  min={1}
                  value={serieNfe}
                  onChange={(e) => setSerieNfe(parseInt(e.target.value, 10) || 1)}
                />
                <Input
                  label="Número da última NF-e emitida"
                  type="number"
                  min={0}
                  value={ultimoNumeroNfe}
                  onChange={(e) => setUltimoNumeroNfe(parseInt(e.target.value, 10) || 0)}
                />
              </div>

              {/* NFC-e */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
                <Input
                  label="Série NFC-e"
                  type="number"
                  min={1}
                  value={serieNfce}
                  onChange={(e) => setSerieNfce(parseInt(e.target.value, 10) || 1)}
                />
                <Input
                  label="Número da última NFC-e emitida"
                  type="number"
                  min={0}
                  value={ultimoNumeroNfce}
                  onChange={(e) => setUltimoNumeroNfce(parseInt(e.target.value, 10) || 0)}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
                <Input
                  label="UF do emitente"
                  value={ufEmitente}
                  onChange={(e) => setUfEmitente(e.target.value.toUpperCase().slice(0, 2))}
                  placeholder="Ex: SP"
                  title="UF do estabelecimento (obrigatório para NFC-e)"
                />
                <Input
                  label="Inscrição Estadual (IE)"
                  value={ieEmitente}
                  onChange={(e) => setIeEmitente(e.target.value)}
                  placeholder="Ex: ISENTO ou número"
                  title="IE do emitente. Use ISENTO se aplicável."
                />
                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 8 }}>
                    NCM padrão
                    <span title="NCM (8 dígitos) usado nos itens da NFC-e quando o produto não tiver NCM cadastrado. Deve existir na tabela TIPI da SEFAZ."><Info size={14} style={{ color: 'var(--color-text-muted)' }} /></span>
                  </label>
                  <Input
                    type="text"
                    value={ncmPadrao}
                    onChange={(e) => setNcmPadrao(e.target.value.replace(/\D/g, '').slice(0, 8))}
                    placeholder="Ex: 21069090"
                    maxLength={8}
                  />
                  <p style={{ marginTop: 6, fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                    Produtos sem NCM usarão este código na emissão.
                  </p>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 8 }}>
                    CSC (Token para NFC-e)
                    <span title="Código de Segurança do Contribuinte fornecido pela SEFAZ."><Info size={14} style={{ color: 'var(--color-text-muted)' }} /></span>
                  </label>
                  <Input
                    type="text"
                    value={cscNfce}
                    onChange={(e) => setCscNfce(e.target.value)}
                    placeholder="Token CSC"
                  />
                </div>
                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 8 }}>
                    ID do token CSC
                    <span title="Identificador do token (ex: 000001)."><Info size={14} style={{ color: 'var(--color-text-muted)' }} /></span>
                  </label>
                  <Input
                    type="text"
                    value={cscIdNfce}
                    onChange={(e) => setCscIdNfce(e.target.value)}
                    placeholder="Ex: 000001"
                  />
                </div>
              </div>

              {/* Tributos / IBPT */}
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 'var(--text-sm)' }}>
                  <input
                    type="checkbox"
                    checked={indicarFonteIbpt}
                    onChange={(e) => setIndicarFonteIbpt(e.target.checked)}
                    style={{ width: 18, height: 18, accentColor: 'var(--color-primary)' }}
                  />
                  Indicar fonte como IBPT (valor aproximado de tributos no cupom)
                </label>
                <p style={{ marginTop: 8, marginBottom: 12, fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                  Percentuais aplicados sobre cada item da venda no cupom NFC-e (Lei 12.741/2012). Use os valores da
                  tabela IBPT para sua UF e NCM. Se esta opção estiver marcada e os três campos abaixo forem zero, o
                  cupom usa os percentuais de exemplo 5,33% / 10,03% / 0% até você cadastrar os oficiais.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, maxWidth: 360 }}>
                  <div>
                    <label style={{ fontSize: 'var(--text-xs)', fontWeight: 600, marginBottom: 4, display: 'block' }}>Federal (%)</label>
                    <Input
                      type="number"
                      min={0}
                      step={0.01}
                      value={tributoFederalPct || ''}
                      onChange={(e) => setTributoFederalPct(parseFloat(e.target.value) || 0)}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 'var(--text-xs)', fontWeight: 600, marginBottom: 4, display: 'block' }}>Estadual (%)</label>
                    <Input
                      type="number"
                      min={0}
                      step={0.01}
                      value={tributoEstadualPct || ''}
                      onChange={(e) => setTributoEstadualPct(parseFloat(e.target.value) || 0)}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 'var(--text-xs)', fontWeight: 600, marginBottom: 4, display: 'block' }}>Municipal (%)</label>
                    <Input
                      type="number"
                      min={0}
                      step={0.01}
                      value={tributoMunicipalPct || ''}
                      onChange={(e) => setTributoMunicipalPct(parseFloat(e.target.value) || 0)}
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>

              {/* Pessoas autorizadas a acessar o XML */}
              <div>
                <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 8 }}>
                  Pessoas autorizadas a acessar o XML da nota (CPF/CNPJ)
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                  {xmlAutorizados.map((cpfCnpj) => (
                    <span
                      key={cpfCnpj}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '6px 10px',
                        borderRadius: 'var(--radius-md)',
                        background: 'var(--color-surface)',
                        border: '1px solid var(--color-border)',
                        fontSize: 'var(--text-sm)',
                      }}
                    >
                      {cpfCnpj}
                      <button
                        type="button"
                        onClick={() => removeXmlAutorizado(cpfCnpj)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}
                        title="Remover"
                      >
                        <Trash2 size={14} />
                      </button>
                    </span>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <Input
                    value={novoXmlCpfCnpj}
                    onChange={(e) => setNovoXmlCpfCnpj(e.target.value)}
                    placeholder="CPF ou CNPJ (apenas números)"
                    style={{ maxWidth: 280 }}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addXmlAutorizado())}
                  />
                  <Button variant="secondary" leftIcon={<Plus size={18} />} onClick={addXmlAutorizado}>
                    Adicionar CPF/CNPJ
                  </Button>
                </div>
              </div>

              {fiscalMessage && (
                <Alert variant={fiscalMessage.type}>{fiscalMessage.text}</Alert>
              )}

              <Button leftIcon={<Save size={18} />} onClick={handleSaveFiscal} disabled={fiscalSaving}>
                {fiscalSaving ? 'Salvando…' : 'Salvar configurações de notas fiscais'}
              </Button>
            </div>
          </CardBody>
        </Card>

        {/* Certificado digital A1 */}
        <Card className="page-card suporte-config-card" style={{ marginTop: 24 }}>
          <CardHeader>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Shield size={20} />
              Certificado digital A1 (PFX/P12)
            </span>
          </CardHeader>
          <CardBody>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)', marginBottom: 16 }}>
              Faça o upload do certificado digital e‑CNPJ A1 para assinar as notas fiscais. O arquivo .pfx ou .p12 e a senha são armazenados de forma segura.
            </p>
            {certStatus.hasCertificado ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-success)' }}>
                  Certificado instalado
                  {certStatus.updatedAt && (
                    <span style={{ color: 'var(--color-text-muted)', marginLeft: 8 }}>
                      (atualizado em {new Date(certStatus.updatedAt).toLocaleDateString('pt-BR')})
                    </span>
                  )}
                </span>
                <Button variant="secondary" size="sm" leftIcon={<Trash2 size={16} />} onClick={handleCertRemove} disabled={certUploading}>
                  Remover certificado
                </Button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>Nenhum certificado instalado.</span>
                <Input
                  type="password"
                  value={certSenha}
                  onChange={(e) => setCertSenha(e.target.value)}
                  placeholder="Senha do certificado"
                  style={{ width: 220 }}
                />
                <Button size="sm" leftIcon={<Upload size={16} />} onClick={handleCertUpload} disabled={certUploading || !certSenha.trim()}>
                  {certUploading ? 'Enviando…' : 'Selecionar e enviar certificado'}
                </Button>
              </div>
            )}
            <p style={{ marginTop: 12, fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
              Ao clicar em &quot;Selecionar e enviar certificado&quot;, será aberto um diálogo para escolher o arquivo .pfx ou .p12. A senha é criptografada e armazenada de forma segura.
            </p>
            {certMessage && (
              <Alert variant={certMessage.type} style={{ marginTop: 12 }}>
                {certMessage.text}
              </Alert>
            )}
          </CardBody>
        </Card>
      </div>
    </Layout>
  )
}
