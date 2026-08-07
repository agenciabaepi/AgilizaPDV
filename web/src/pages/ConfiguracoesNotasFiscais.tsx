import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useEmpresaTheme } from '../hooks/useEmpresaTheme'
import { Layout } from '../components/Layout'
import { PageTitle, Card, CardHeader, CardBody, Button, Input, Alert, Select } from '../components/ui'
import { FileCheck, Save, Upload, Info, Trash2, Plus, Shield, CheckCircle2, FileKey2 } from 'lucide-react'
import type { EmpresaFiscalConfig, UpdateEmpresaConfigInput, UpdateFiscalConfigInput } from '../vite-env'
import {
  buildCupomFiscalAutoFormasJson,
  FORMAS_CUPOM_FISCAL_AUTO,
  parseCupomFiscalAutoFormas,
  type FormaPagamentoCupomAuto,
} from '../lib/cupom-fiscal-auto'

const MAX_CERT_MB = 5

export function ConfiguracoesNotasFiscais() {
  const { session } = useAuth()
  const { setEmpresaIdForTheme } = useEmpresaTheme()
  const navigate = useNavigate()
  const empresaId = session && 'empresa_id' in session ? session.empresa_id : null
  const certFileRef = useRef<HTMLInputElement>(null)

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

  const [cupomFiscalAutoEmitir, setCupomFiscalAutoEmitir] = useState(false)
  const [cupomFiscalTodasFormas, setCupomFiscalTodasFormas] = useState(true)
  const [cupomFiscalFormas, setCupomFiscalFormas] = useState<Record<FormaPagamentoCupomAuto, boolean>>(
    () =>
      FORMAS_CUPOM_FISCAL_AUTO.reduce(
        (acc, f) => ({ ...acc, [f.value]: false }),
        {} as Record<FormaPagamentoCupomAuto, boolean>
      )
  )

  const [certStatus, setCertStatus] = useState<{ hasCertificado: boolean; path: string | null; updatedAt: string | null }>({
    hasCertificado: false,
    path: null,
    updatedAt: null,
  })
  const [certSenha, setCertSenha] = useState('')
  const [certFile, setCertFile] = useState<File | null>(null)
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

  const loadEmpresaConfig = useCallback(() => {
    if (!empresaId) return
    window.electronAPI.empresas.getConfig(empresaId).then((c) => {
      if (c) {
        const autoParsed = parseCupomFiscalAutoFormas(c.cupom_fiscal_auto_formas_json)
        setCupomFiscalAutoEmitir(c.cupom_fiscal_auto_emitir === 1)
        setCupomFiscalTodasFormas(autoParsed.todas)
        setCupomFiscalFormas(
          FORMAS_CUPOM_FISCAL_AUTO.reduce(
            (acc, f) => ({
              ...acc,
              [f.value]: autoParsed.todas || autoParsed.formas.includes(f.value),
            }),
            {} as Record<FormaPagamentoCupomAuto, boolean>
          )
        )
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
    loadEmpresaConfig()
    loadCertStatus()
  }, [isAdmin, empresaId, navigate, loadFiscalConfig, loadEmpresaConfig, loadCertStatus])

  useEffect(() => {
    setEmpresaIdForTheme(empresaId || null)
    return () => setEmpresaIdForTheme(null)
  }, [empresaId, setEmpresaIdForTheme])

  const handleSaveFiscal = async () => {
    if (!empresaId) return
    const formasSelecionadas = FORMAS_CUPOM_FISCAL_AUTO.filter((f) => cupomFiscalFormas[f.value]).map(
      (f) => f.value
    )
    if (cupomFiscalAutoEmitir && !cupomFiscalTodasFormas && formasSelecionadas.length === 0) {
      setFiscalMessage({ type: 'error', text: 'Selecione ao menos uma forma de pagamento para emissão automática.' })
      return
    }

    setFiscalSaving(true)
    setFiscalMessage(null)
    try {
      const fiscalData: UpdateFiscalConfigInput = {
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
      const empresaData: UpdateEmpresaConfigInput = {
        cupom_fiscal_auto_emitir: cupomFiscalAutoEmitir,
        cupom_fiscal_auto_formas_json: cupomFiscalAutoEmitir
          ? buildCupomFiscalAutoFormasJson(cupomFiscalTodasFormas, formasSelecionadas)
          : null,
      }
      await window.electronAPI.empresas.updateFiscalConfig(empresaId, fiscalData)
      await window.electronAPI.empresas.updateConfig(empresaId, empresaData)
      setFiscalMessage({ type: 'success', text: 'Configurações de notas fiscais salvas com sucesso.' })
      loadFiscalConfig()
      loadEmpresaConfig()
    } catch {
      setFiscalMessage({ type: 'error', text: 'Erro ao salvar configurações fiscais.' })
    } finally {
      setFiscalSaving(false)
    }
  }

  const handleCertFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null
    setCertFile(file)
    setCertMessage(null)
    e.target.value = ''
  }

  const handleCertUpload = async () => {
    if (!empresaId) return
    if (!certFile) {
      setCertMessage({ type: 'error', text: 'Selecione o arquivo .pfx ou .p12.' })
      return
    }
    if (!certSenha.trim()) {
      setCertMessage({ type: 'error', text: 'Informe a senha do certificado.' })
      return
    }
    setCertUploading(true)
    setCertMessage(null)
    try {
      const result = await window.electronAPI.certificado.selectAndUpload(empresaId, certSenha, certFile)
      if (result.ok) {
        setCertMessage({ type: 'success', text: 'Certificado digital instalado com sucesso.' })
        setCertSenha('')
        setCertFile(null)
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
        setCertFile(null)
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

  const toggleCupomFiscalForma = (id: FormaPagamentoCupomAuto) => {
    setCupomFiscalFormas((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  if (!isAdmin) return null

  return (
    <Layout>
      <PageTitle
        title="Configurações de Notas Fiscais"
        subtitle="Ambiente SEFAZ, séries NF-e/NFC-e, CSC, emissão automática no PDV, certificado digital A1 e pessoas autorizadas a acessar o XML."
      />

      <div className="fiscal-config-page">
        <div className="fiscal-config-grid">
          <Card className="page-card fiscal-config-card fiscal-config-card--wide">
            <CardHeader>
              <span className="fiscal-card-title">
                <FileCheck size={20} />
                Dados para emissão NF-e e NFC-e
              </span>
            </CardHeader>
            <CardBody>
              <p className="fiscal-lead">
                Configure ambiente, séries e tokens para emissão pela SEFAZ. O certificado digital A1 (PFX) é obrigatório para assinar as notas.
              </p>

              <div className="fiscal-form">
                <section className="fiscal-section">
                  <h3 className="fiscal-section-title">Ambiente SEFAZ</h3>
                  <Select
                    value={ambiente}
                    onChange={(e) => setAmbiente(e.target.value as 'homologacao' | 'producao')}
                    options={[
                      { value: 'homologacao', label: 'Homologação (testes)' },
                      { value: 'producao', label: 'Produção' },
                    ]}
                    className="fiscal-field--sm"
                  />
                </section>

                <section className="fiscal-section">
                  <h3 className="fiscal-section-title">NF-e</h3>
                  <div className="fiscal-fields-grid">
                    <Input
                      label="Série NF-e"
                      type="number"
                      min={1}
                      value={serieNfe}
                      onChange={(e) => setSerieNfe(parseInt(e.target.value, 10) || 1)}
                    />
                    <Input
                      label="Última NF-e emitida"
                      type="number"
                      min={0}
                      value={ultimoNumeroNfe}
                      onChange={(e) => setUltimoNumeroNfe(parseInt(e.target.value, 10) || 0)}
                    />
                  </div>
                </section>

                <section className="fiscal-section">
                  <h3 className="fiscal-section-title">NFC-e</h3>
                  <div className="fiscal-fields-grid">
                    <Input
                      label="Série NFC-e"
                      type="number"
                      min={1}
                      value={serieNfce}
                      onChange={(e) => setSerieNfce(parseInt(e.target.value, 10) || 1)}
                    />
                    <Input
                      label="Última NFC-e emitida"
                      type="number"
                      min={0}
                      value={ultimoNumeroNfce}
                      onChange={(e) => setUltimoNumeroNfce(parseInt(e.target.value, 10) || 0)}
                    />
                  </div>
                  <div className="fiscal-fields-grid fiscal-fields-grid--3">
                    <Input
                      label="UF do emitente"
                      value={ufEmitente}
                      onChange={(e) => setUfEmitente(e.target.value.toUpperCase().slice(0, 2))}
                      placeholder="Ex: SP"
                    />
                    <Input
                      label="Inscrição Estadual (IE)"
                      value={ieEmitente}
                      onChange={(e) => setIeEmitente(e.target.value)}
                      placeholder="ISENTO ou número"
                    />
                    <div>
                      <label className="fiscal-label-with-tip">
                        NCM padrão
                        <span title="NCM usado quando o produto não tiver NCM cadastrado."><Info size={14} /></span>
                      </label>
                      <Input
                        type="text"
                        value={ncmPadrao}
                        onChange={(e) => setNcmPadrao(e.target.value.replace(/\D/g, '').slice(0, 8))}
                        placeholder="21069090"
                        maxLength={8}
                      />
                    </div>
                  </div>
                  <div className="fiscal-fields-grid">
                    <div>
                      <label className="fiscal-label-with-tip">
                        CSC (Token NFC-e)
                        <span title="Código de Segurança do Contribuinte fornecido pela SEFAZ."><Info size={14} /></span>
                      </label>
                      <Input type="text" value={cscNfce} onChange={(e) => setCscNfce(e.target.value)} placeholder="Token CSC" />
                    </div>
                    <div>
                      <label className="fiscal-label-with-tip">
                        ID do token CSC
                        <span title="Identificador do token (ex: 000001)."><Info size={14} /></span>
                      </label>
                      <Input type="text" value={cscIdNfce} onChange={(e) => setCscIdNfce(e.target.value)} placeholder="000001" />
                    </div>
                  </div>
                </section>

                <section className="fiscal-section">
                  <h3 className="fiscal-section-title">Emissão automática no PDV (NFC-e)</h3>
                  <p className="fiscal-hint" style={{ marginBottom: 16 }}>
                    Ao finalizar uma venda no PDV, o sistema pode emitir a NFC-e e imprimir o cupom fiscal sem ação
                    manual.
                  </p>

                  <label className="fiscal-checkbox">
                    <input
                      type="checkbox"
                      checked={cupomFiscalAutoEmitir}
                      onChange={(e) => setCupomFiscalAutoEmitir(e.target.checked)}
                    />
                    Emitir cupom fiscal automaticamente após finalizar a venda
                  </label>

                  {cupomFiscalAutoEmitir && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
                      <label className="fiscal-checkbox">
                        <input
                          type="radio"
                          name="cupom-fiscal-formas"
                          checked={cupomFiscalTodasFormas}
                          onChange={() => setCupomFiscalTodasFormas(true)}
                        />
                        Todas as formas de pagamento
                      </label>
                      <label className="fiscal-checkbox">
                        <input
                          type="radio"
                          name="cupom-fiscal-formas"
                          checked={!cupomFiscalTodasFormas}
                          onChange={() => setCupomFiscalTodasFormas(false)}
                        />
                        Somente formas selecionadas
                      </label>

                      {!cupomFiscalTodasFormas && (
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(148px, 1fr))',
                            gap: 8,
                          }}
                        >
                          {FORMAS_CUPOM_FISCAL_AUTO.map((f) => (
                            <label
                              key={f.value}
                              className="fiscal-checkbox"
                              style={{
                                padding: '8px 12px',
                                borderRadius: 'var(--radius-md)',
                                border: '1px solid var(--color-border)',
                                background: cupomFiscalFormas[f.value]
                                  ? 'var(--color-primary-light)'
                                  : 'transparent',
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={cupomFiscalFormas[f.value]}
                                onChange={() => toggleCupomFiscalForma(f.value)}
                              />
                              {f.label}
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </section>

                <section className="fiscal-section">
                  <h3 className="fiscal-section-title">Tributos aproximados (IBPT)</h3>
                  <label className="fiscal-checkbox">
                    <input
                      type="checkbox"
                      checked={indicarFonteIbpt}
                      onChange={(e) => setIndicarFonteIbpt(e.target.checked)}
                    />
                    Indicar fonte como IBPT no cupom NFC-e
                  </label>
                  <p className="fiscal-hint">
                    Percentuais sobre cada item (Lei 12.741/2012). Se marcado e os três campos forem zero, usa 5,33% / 10,03% / 0% até cadastrar os oficiais.
                  </p>
                  <div className="fiscal-tributos-grid">
                    <Input
                      label="Federal (%)"
                      type="number"
                      min={0}
                      step={0.01}
                      value={tributoFederalPct || ''}
                      onChange={(e) => setTributoFederalPct(parseFloat(e.target.value) || 0)}
                    />
                    <Input
                      label="Estadual (%)"
                      type="number"
                      min={0}
                      step={0.01}
                      value={tributoEstadualPct || ''}
                      onChange={(e) => setTributoEstadualPct(parseFloat(e.target.value) || 0)}
                    />
                    <Input
                      label="Municipal (%)"
                      type="number"
                      min={0}
                      step={0.01}
                      value={tributoMunicipalPct || ''}
                      onChange={(e) => setTributoMunicipalPct(parseFloat(e.target.value) || 0)}
                    />
                  </div>
                </section>

                <section className="fiscal-section">
                  <h3 className="fiscal-section-title">Autorizados a acessar o XML</h3>
                  <div className="fiscal-tags">
                    {xmlAutorizados.map((cpfCnpj) => (
                      <span key={cpfCnpj} className="fiscal-tag">
                        {cpfCnpj}
                        <button type="button" onClick={() => removeXmlAutorizado(cpfCnpj)} title="Remover">
                          <Trash2 size={14} />
                        </button>
                      </span>
                    ))}
                    {xmlAutorizados.length === 0 && (
                      <span className="fiscal-hint">Nenhum CPF/CNPJ autorizado.</span>
                    )}
                  </div>
                  <div className="fiscal-add-xml">
                    <Input
                      value={novoXmlCpfCnpj}
                      onChange={(e) => setNovoXmlCpfCnpj(e.target.value)}
                      placeholder="CPF ou CNPJ"
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addXmlAutorizado())}
                    />
                    <Button variant="secondary" leftIcon={<Plus size={18} />} onClick={addXmlAutorizado}>
                      Adicionar
                    </Button>
                  </div>
                </section>

                {fiscalMessage && <Alert variant={fiscalMessage.type}>{fiscalMessage.text}</Alert>}

                <div className="fiscal-actions">
                  <Button leftIcon={<Save size={18} />} onClick={handleSaveFiscal} disabled={fiscalSaving}>
                    {fiscalSaving ? 'Salvando…' : 'Salvar configurações fiscais'}
                  </Button>
                </div>
              </div>
            </CardBody>
          </Card>

          <Card className="page-card fiscal-config-card fiscal-config-card--cert">
            <CardHeader>
              <span className="fiscal-card-title">
                <Shield size={20} />
                Certificado digital A1
              </span>
            </CardHeader>
            <CardBody>
              <p className="fiscal-lead">
                Envie o certificado e-CNPJ A1 (.pfx ou .p12) para assinar NF-e e NFC-e. O arquivo fica no Supabase e a senha é criptografada.
              </p>

              {certStatus.hasCertificado ? (
                <div className="cert-status cert-status--installed">
                  <div className="cert-status-icon">
                    <CheckCircle2 size={28} />
                  </div>
                  <div className="cert-status-body">
                    <strong>Certificado instalado</strong>
                    {certStatus.updatedAt && (
                      <span className="cert-status-meta">
                        Atualizado em {new Date(certStatus.updatedAt).toLocaleString('pt-BR')}
                      </span>
                    )}
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    leftIcon={<Trash2 size={16} />}
                    onClick={handleCertRemove}
                    disabled={certUploading}
                  >
                    Remover
                  </Button>
                </div>
              ) : (
                <div className="cert-upload-form">
                  <label
                    className={`cert-upload-zone${certFile ? ' cert-upload-zone--has-file' : ''}`}
                    onClick={() => certFileRef.current?.click()}
                  >
                    <FileKey2 size={24} />
                    {certFile ? (
                      <>
                        <strong>{certFile.name}</strong>
                        <span>{(certFile.size / 1024).toFixed(1)} KB</span>
                      </>
                    ) : (
                      <>
                        <strong>Selecionar arquivo .pfx ou .p12</strong>
                        <span>Clique para escolher · máx. {MAX_CERT_MB} MB</span>
                      </>
                    )}
                    <input
                      ref={certFileRef}
                      type="file"
                      accept=".pfx,.p12,application/x-pkcs12"
                      onChange={handleCertFileChange}
                      hidden
                    />
                  </label>

                  <Input
                    type="password"
                    label="Senha do certificado"
                    value={certSenha}
                    onChange={(e) => setCertSenha(e.target.value)}
                    placeholder="Senha definida na emissão do certificado"
                    autoComplete="new-password"
                  />

                  <Button
                    leftIcon={<Upload size={18} />}
                    onClick={handleCertUpload}
                    disabled={certUploading || !certFile || !certSenha.trim()}
                    className="cert-upload-btn"
                  >
                    {certUploading ? 'Enviando…' : 'Enviar certificado'}
                  </Button>
                </div>
              )}

              <div className="fiscal-info-box">
                <Shield size={18} />
                <p>
                  O certificado fica armazenado de forma privada na nuvem, vinculado à sua empresa. Apenas administradores podem enviar ou remover.
                </p>
              </div>

              {certMessage && <Alert variant={certMessage.type}>{certMessage.text}</Alert>}
            </CardBody>
          </Card>
        </div>
      </div>
    </Layout>
  )
}
