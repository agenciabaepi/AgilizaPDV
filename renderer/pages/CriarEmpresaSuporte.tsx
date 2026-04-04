import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { LayoutSuporte } from '../components/LayoutSuporte'
import { PageTitle, Card, CardHeader, CardBody, Button, Input, Alert, Select, useToast } from '../components/ui'
import {
  Building2,
  Image,
  Palette,
  Save,
  Upload,
  X,
  Check,
  Printer,
  FileCheck,
  Info,
  Trash2,
  Plus,
  Shield,
  Factory,
} from 'lucide-react'
import type {
  CupomLayoutPagina,
  ModuloId,
  UpdateEmpresaConfigInput,
  UpdateFiscalConfigInput,
} from '../vite-env'

const MODULOS: { id: ModuloId; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'produtos', label: 'Produtos' },
  { id: 'etiquetas', label: 'Etiquetas' },
  { id: 'categorias', label: 'Categorias' },
  { id: 'marcas', label: 'Marcas' },
  { id: 'clientes', label: 'Clientes' },
  { id: 'fornecedores', label: 'Fornecedores' },
  { id: 'estoque', label: 'Estoque' },
  { id: 'caixa', label: 'Caixa' },
  { id: 'vendas', label: 'Vendas' },
  { id: 'pdv', label: 'PDV' },
]

const CORES_PRESET = [
  '#1d4ed8', '#065f46', '#2563eb', '#7c3aed', '#db2777',
  '#ea580c', '#ca8a04', '#16a34a', '#0ea5e9', '#6366f1',
]

const CUPOM_LAYOUT_OPTIONS: { value: CupomLayoutPagina; label: string; hint: string }[] = [
  {
    value: 'compat',
    label: 'Compatível (recomendado)',
    hint: 'Largura fixa (~302 px). Costuma funcionar melhor no Windows com impressoras térmicas.',
  },
  {
    value: 'thermal_80_full',
    label: 'Papel 80 mm — largura total',
    hint: 'Página definida em 80 mm; o conteúdo usa quase toda a largura do papel.',
  },
  {
    value: 'thermal_80_72',
    label: 'Papel 80 mm — área útil ~72 mm',
    hint: 'Simula margens físicas estreitas. Se a impressão sair vazia, volte para Compatível.',
  },
]

function toCupomLayoutPagina(raw: string | null | undefined): CupomLayoutPagina {
  const v = (raw ?? '').trim()
  if (v === 'thermal_80_72' || v === 'thermal_80_full') return v
  return 'compat'
}

const defaultModulos = (): Record<ModuloId, boolean> =>
  MODULOS.reduce((acc, m) => ({ ...acc, [m.id]: true }), {} as Record<ModuloId, boolean>)

export function CriarEmpresaSuporte() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const isSuporte = session && 'suporte' in session && session.suporte

  const [nome, setNome] = useState('')
  /** Número que o cliente digita no login (ex.: 5748). */
  const [codigoEmpresa, setCodigoEmpresa] = useState('')
  const [razaoSocial, setRazaoSocial] = useState('')
  const [cnpj, setCnpj] = useState('')
  const [endereco, setEndereco] = useState('')
  const [telefone, setTelefone] = useState('')
  const [email, setEmail] = useState('')
  const [logo, setLogo] = useState<string | null>(null)
  const [corPrimaria, setCorPrimaria] = useState('#1d4ed8')
  const [impressoraCupom, setImpressoraCupom] = useState('')
  const [cupomLayoutPagina, setCupomLayoutPagina] = useState<CupomLayoutPagina>('compat')
  const [cupomPreviewHtml, setCupomPreviewHtml] = useState('')
  const [printers, setPrinters] = useState<{ name: string; isDefault: boolean }[]>([])
  const [modulos, setModulos] = useState<Record<ModuloId, boolean>>(defaultModulos)

  const [ambiente, setAmbiente] = useState<'homologacao' | 'producao'>('producao')
  const [serieNfe, setSerieNfe] = useState(1)
  const [ultimoNumeroNfe, setUltimoNumeroNfe] = useState(0)
  const [serieNfce, setSerieNfce] = useState(1)
  const [ultimoNumeroNfce, setUltimoNumeroNfce] = useState(0)
  const [cscNfce, setCscNfce] = useState('')
  const [cscIdNfce, setCscIdNfce] = useState('')
  const [ufEmitente, setUfEmitente] = useState('SP')
  const [ieEmitente, setIeEmitente] = useState('ISENTO')
  const [cMunEmitente, setCMunEmitente] = useState('3550308')
  const [ncmPadrao, setNcmPadrao] = useState('21069090')
  const [indicarFonteIbpt, setIndicarFonteIbpt] = useState(true)
  const [tributoFederalPct, setTributoFederalPct] = useState(0)
  const [tributoEstadualPct, setTributoEstadualPct] = useState(0)
  const [tributoMunicipalPct, setTributoMunicipalPct] = useState(0)
  const [xmlAutorizados, setXmlAutorizados] = useState<string[]>([])
  const [novoXmlCpfCnpj, setNovoXmlCpfCnpj] = useState('')

  const [criarAdminPadrao, setCriarAdminPadrao] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [formMessage, setFormMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [createdEmpresaId, setCreatedEmpresaId] = useState<string | null>(null)
  const [createdEmpresaNome, setCreatedEmpresaNome] = useState('')
  const [createdEmpresaCodigo, setCreatedEmpresaCodigo] = useState<number | null>(null)

  const [certSenha, setCertSenha] = useState('')
  const [certUploading, setCertUploading] = useState(false)
  const [certMessage, setCertMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [certStatus, setCertStatus] = useState<{ hasCertificado: boolean; path: string | null; updatedAt: string | null }>({
    hasCertificado: false,
    path: null,
    updatedAt: null,
  })

  useEffect(() => {
    if (!isSuporte) {
      navigate('/dashboard', { replace: true })
    }
  }, [isSuporte, navigate])

  useEffect(() => {
    if (typeof window.electronAPI?.cupom?.listPrinters !== 'function') return
    window.electronAPI.cupom.listPrinters().then(setPrinters).catch(() => setPrinters([]))
  }, [])

  useEffect(() => {
    const loadPreview = window.electronAPI?.cupom?.getPreviewHtml
    if (typeof loadPreview !== 'function') {
      setCupomPreviewHtml('')
      return
    }
    let cancelled = false
    void loadPreview(cupomLayoutPagina).then((html) => {
      if (!cancelled) setCupomPreviewHtml(html ?? '')
    })
    return () => {
      cancelled = true
    }
  }, [cupomLayoutPagina])

  useEffect(() => {
    if (!createdEmpresaId) {
      setCertStatus({ hasCertificado: false, path: null, updatedAt: null })
      return
    }
    if (typeof window.electronAPI?.certificado?.getStatus !== 'function') return
    window.electronAPI.certificado.getStatus(createdEmpresaId).then(setCertStatus).catch(() =>
      setCertStatus({ hasCertificado: false, path: null, updatedAt: null })
    )
  }, [createdEmpresaId])

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = () => {
      const data = reader.result as string
      if (data.length > 500 * 1024) {
        setFormMessage({ type: 'error', text: 'Imagem muito grande. Use até 500KB.' })
        return
      }
      setLogo(data)
      setFormMessage(null)
    }
    reader.readAsDataURL(file)
  }

  const toggleModulo = (id: ModuloId) => {
    setModulos((prev) => ({ ...prev, [id]: !prev[id] }))
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

  const parseCMun = (): number | null => {
    const n = parseInt(cMunEmitente.replace(/\D/g, ''), 10)
    if (!Number.isFinite(n) || n <= 0) return null
    return n
  }

  const handleCriarEmpresa = async () => {
    const nomeTrim = nome.trim()
    if (!nomeTrim) {
      setFormMessage({ type: 'error', text: 'Informe o nome fantasia da empresa.' })
      return
    }
    const codDigits = codigoEmpresa.trim().replace(/\D/g, '')
    if (codDigits.length < 3 || codDigits.length > 12) {
      setFormMessage({ type: 'error', text: 'Informe o número da empresa para o login (3 a 12 dígitos, ex.: 5748).' })
      return
    }
    const codNum = parseInt(codDigits, 10)
    if (!Number.isFinite(codNum) || codNum < 1) {
      setFormMessage({ type: 'error', text: 'Número da empresa inválido.' })
      return
    }
    setSubmitting(true)
    setFormMessage(null)
    try {
      const created = await window.electronAPI.empresas.create({
        nome: nomeTrim,
        cnpj: cnpj.trim() || undefined,
        codigo_acesso: codNum,
      })
      const empresaId = created.id

      const configPayload: UpdateEmpresaConfigInput = {
        nome: nomeTrim,
        cnpj: cnpj.trim() || null,
        razao_social: razaoSocial.trim() || null,
        endereco: endereco.trim() || null,
        telefone: telefone.trim() || null,
        email: email.trim() || null,
        logo: logo || null,
        cor_primaria: corPrimaria || null,
        impressora_cupom: impressoraCupom.trim() || null,
        cupom_layout_pagina: toCupomLayoutPagina(cupomLayoutPagina),
        modulos,
      }
      await window.electronAPI.empresas.updateConfig(empresaId, configPayload)

      const cmun = parseCMun()
      const fiscalPayload: UpdateFiscalConfigInput = {
        ambiente,
        serie_nfe: serieNfe,
        ultimo_numero_nfe: ultimoNumeroNfe,
        serie_nfce: serieNfce,
        ultimo_numero_nfce: ultimoNumeroNfce,
        csc_nfce: cscNfce.trim() || null,
        csc_id_nfce: cscIdNfce.trim() || null,
        uf_emitente: ufEmitente.trim().toUpperCase().slice(0, 2) || 'SP',
        ie_emitente: ieEmitente.trim() || 'ISENTO',
        ...(cmun != null ? { c_mun_emitente: cmun } : {}),
        ncm_padrao: ncmPadrao.replace(/\D/g, '').slice(0, 8) || null,
        indicar_fonte_ibpt: indicarFonteIbpt,
        tributo_aprox_federal_pct: tributoFederalPct,
        tributo_aprox_estadual_pct: tributoEstadualPct,
        tributo_aprox_municipal_pct: tributoMunicipalPct,
        xml_autorizados: xmlAutorizados,
      }
      await window.electronAPI.empresas.updateFiscalConfig(empresaId, fiscalPayload)

      if (criarAdminPadrao && typeof window.electronAPI?.auth?.ensureAdminUser === 'function') {
        await window.electronAPI.auth.ensureAdminUser(empresaId)
      }

      setCreatedEmpresaId(empresaId)
      setCreatedEmpresaNome(nomeTrim)
      setCreatedEmpresaCodigo(created.codigo_acesso ?? codNum)
      toast.addToast('success', 'Empresa criada e configurada.')
      setFormMessage({
        type: 'success',
        text:
          `Empresa criada. No login do PDV o cliente usa o número ${created.codigo_acesso ?? codNum}, usuário e senha. Se marcou “Criar usuário admin”, use admin / admin até alterar em Usuários. Certificado A1 abaixo se for emitir NFC-e/NF-e neste computador.`,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao criar empresa.'
      setFormMessage({ type: 'error', text: msg })
      toast.addToast('error', msg)
    } finally {
      setSubmitting(false)
    }
  }

  const handleCertUpload = async () => {
    if (!createdEmpresaId) return
    setCertUploading(true)
    setCertMessage(null)
    try {
      const result = await window.electronAPI.certificado.selectAndUpload(createdEmpresaId, certSenha)
      if (result.ok) {
        setCertMessage({ type: 'success', text: 'Certificado digital instalado com sucesso.' })
        setCertSenha('')
        const st = await window.electronAPI.certificado.getStatus(createdEmpresaId)
        setCertStatus(st)
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
    if (!createdEmpresaId) return
    setCertUploading(true)
    setCertMessage(null)
    try {
      const result = await window.electronAPI.certificado.remove(createdEmpresaId)
      if (result.ok) {
        setCertMessage({ type: 'success', text: 'Certificado removido.' })
        const st = await window.electronAPI.certificado.getStatus(createdEmpresaId)
        setCertStatus(st)
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

  const handleNovaCadastro = () => {
    setNome('')
    setCodigoEmpresa('')
    setRazaoSocial('')
    setCnpj('')
    setEndereco('')
    setTelefone('')
    setEmail('')
    setLogo(null)
    setCorPrimaria('#1d4ed8')
    setImpressoraCupom('')
    setCupomLayoutPagina('compat')
    setModulos(defaultModulos())
    setAmbiente('producao')
    setSerieNfe(1)
    setUltimoNumeroNfe(0)
    setSerieNfce(1)
    setUltimoNumeroNfce(0)
    setCscNfce('')
    setCscIdNfce('')
    setUfEmitente('SP')
    setIeEmitente('ISENTO')
    setCMunEmitente('3550308')
    setNcmPadrao('21069090')
    setIndicarFonteIbpt(true)
    setTributoFederalPct(0)
    setTributoEstadualPct(0)
    setTributoMunicipalPct(0)
    setXmlAutorizados([])
    setNovoXmlCpfCnpj('')
    setCriarAdminPadrao(true)
    setCreatedEmpresaId(null)
    setCreatedEmpresaNome('')
    setCreatedEmpresaCodigo(null)
    setFormMessage(null)
    setCertMessage(null)
    setCertSenha('')
  }

  if (!isSuporte) return null

  const formDisabled = Boolean(createdEmpresaId)

  return (
    <LayoutSuporte>
      <PageTitle
        title="Nova empresa"
        subtitle="Cadastro completo: dados da loja, aparência, módulos, fiscal (NF-e/NFC-e) e certificado."
      />
      <div className="suporte-config-stack">
        {createdEmpresaId && (
          <Alert variant="success">
            <strong>{createdEmpresaNome}</strong> — número para login: <strong>{createdEmpresaCodigo ?? '—'}</strong> — ID interno{' '}
            <code style={{ fontSize: '0.9em' }}>{createdEmpresaId}</code>.
            {' '}
            <Link to="/configuracoes/loja">Abrir Configurar Loja</Link> para ajustes finos ou{' '}
            <button
              type="button"
              onClick={handleNovaCadastro}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                color: 'var(--color-primary)',
                cursor: 'pointer',
                textDecoration: 'underline',
                font: 'inherit',
              }}
            >
              cadastrar outra empresa
            </button>
            .
          </Alert>
        )}

        <Card className="page-card suporte-config-card">
          <CardHeader>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Building2 size={20} />
              Dados cadastrais
            </span>
          </CardHeader>
          <CardBody>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
              <Input
                label="Número da empresa (login no PDV)"
                value={codigoEmpresa}
                onChange={(e) => setCodigoEmpresa(e.target.value.replace(/[^\d]/g, '').slice(0, 12))}
                placeholder="Ex.: 5748"
                inputMode="numeric"
                disabled={formDisabled}
                required
              />
              <Input
                label="Nome fantasia"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex.: Loja do João"
                disabled={formDisabled}
                required
              />
              <Input
                label="Razão social"
                value={razaoSocial}
                onChange={(e) => setRazaoSocial(e.target.value)}
                placeholder="Ex.: João Comércio Ltda"
                disabled={formDisabled}
              />
              <Input label="CNPJ" value={cnpj} onChange={(e) => setCnpj(e.target.value)} placeholder="00.000.000/0001-00" disabled={formDisabled} />
              <Input label="Endereço" value={endereco} onChange={(e) => setEndereco(e.target.value)} placeholder="Rua, número, bairro, cidade" disabled={formDisabled} />
              <Input label="Telefone" value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(00) 00000-0000" disabled={formDisabled} />
              <Input label="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="contato@loja.com" type="email" disabled={formDisabled} />
            </div>
          </CardBody>
        </Card>

        <Card className="page-card suporte-config-card">
          <CardHeader>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Image size={20} />
              Logo e cor
            </span>
          </CardHeader>
          <CardBody>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)', marginBottom: 16 }}>
              Logo (PNG/JPG, máx. 500KB) e cor principal do sistema.
            </p>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
              <div
                className="config-loja-logo-preview"
                style={{
                  width: 160,
                  height: 80,
                  border: '2px dashed var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  background: 'var(--color-bg)',
                }}
              >
                {logo ? (
                  <img src={logo} alt="Logo" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                ) : (
                  <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>Sem logo</span>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label className="btn btn--secondary btn--md" style={{ cursor: formDisabled ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8, opacity: formDisabled ? 0.6 : 1 }}>
                  <input type="file" accept="image/png,image/jpeg,image/jpg,image/webp" onChange={handleLogoChange} style={{ display: 'none' }} disabled={formDisabled} />
                  <Upload size={18} />
                  Enviar imagem
                </label>
                {logo && !formDisabled && (
                  <Button variant="secondary" leftIcon={<X size={18} />} onClick={() => setLogo(null)}>
                    Remover logo
                  </Button>
                )}
              </div>
            </div>
            <p style={{ fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 8 }}>Cor do sistema</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {CORES_PRESET.map((cor) => (
                  <button
                    key={cor}
                    type="button"
                    disabled={formDisabled}
                    onClick={() => setCorPrimaria(cor)}
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 'var(--radius-full)',
                      background: cor,
                      border: corPrimaria === cor ? '3px solid var(--color-text)' : '2px solid transparent',
                      cursor: formDisabled ? 'not-allowed' : 'pointer',
                      boxShadow: 'var(--shadow-sm)',
                    }}
                    title={cor}
                  />
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="color"
                  value={corPrimaria}
                  onChange={(e) => setCorPrimaria(e.target.value)}
                  disabled={formDisabled}
                  style={{ width: 48, height: 36, border: 'none', borderRadius: 'var(--radius-sm)', cursor: formDisabled ? 'not-allowed' : 'pointer' }}
                />
                <Input value={corPrimaria} onChange={(e) => setCorPrimaria(e.target.value)} placeholder="#1d4ed8" style={{ width: 120 }} disabled={formDisabled} />
              </div>
            </div>
          </CardBody>
        </Card>

        <Card className="page-card suporte-config-card">
          <CardHeader>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Printer size={20} />
              Cupom e módulos
            </span>
          </CardHeader>
          <CardBody>
            <Select
              label="Impressora de cupom"
              value={impressoraCupom}
              onChange={(e) => setImpressoraCupom(e.target.value)}
              options={[
                { value: '', label: '(Usar diálogo padrão)' },
                ...printers.map((p) => ({ value: p.name, label: p.isDefault ? `${p.name} (padrão)` : p.name })),
              ]}
              placeholder="Selecione a impressora"
              style={{ maxWidth: 400, marginBottom: 16 }}
              disabled={formDisabled}
            />
            <Select
              label="Layout da página do cupom"
              value={cupomLayoutPagina}
              onChange={(e) => setCupomLayoutPagina(e.target.value as CupomLayoutPagina)}
              options={CUPOM_LAYOUT_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
              style={{ maxWidth: 400, marginBottom: 8 }}
              disabled={formDisabled}
            />
            <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)', marginBottom: 16 }}>
              {CUPOM_LAYOUT_OPTIONS.find((o) => o.value === cupomLayoutPagina)?.hint}
            </p>
            {cupomPreviewHtml ? (
              <div
                style={{
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                  background: 'repeating-linear-gradient(90deg, #f0f0f0, #f0f0f0 1px, #fafafa 1px, #fafafa 8px)',
                  padding: 16,
                  display: 'flex',
                  justifyContent: 'center',
                  minHeight: 160,
                  overflow: 'auto',
                  marginBottom: 24,
                }}
              >
                <iframe
                  title="Pré-visualização do cupom"
                  srcDoc={cupomPreviewHtml}
                  style={{
                    width: cupomLayoutPagina === 'compat' ? 318 : 340,
                    minHeight: 320,
                    border: 'none',
                    background: '#fff',
                    boxShadow: 'var(--shadow-md)',
                  }}
                />
              </div>
            ) : (
              <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', marginBottom: 24 }}>
                Pré-visualização do cupom disponível no app desktop.
              </p>
            )}
            <p style={{ fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 12 }}>Módulos visíveis no menu</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12 }}>
              {MODULOS.map((m) => (
                <label
                  key={m.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                    cursor: formDisabled ? 'not-allowed' : 'pointer',
                    background: modulos[m.id] ? 'var(--color-primary-light)' : 'transparent',
                    opacity: formDisabled ? 0.7 : 1,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={modulos[m.id]}
                    onChange={() => toggleModulo(m.id)}
                    disabled={formDisabled}
                    style={{ width: 18, height: 18, accentColor: 'var(--color-primary)' }}
                  />
                  <span style={{ fontSize: 'var(--text-sm)', fontWeight: modulos[m.id] ? 600 : 400 }}>{m.label}</span>
                  {modulos[m.id] ? <Check size={16} color="var(--color-success)" /> : null}
                </label>
              ))}
            </div>
          </CardBody>
        </Card>

        <Card className="page-card suporte-config-card">
          <CardHeader>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <FileCheck size={20} />
              Notas fiscais (NF-e / NFC-e)
            </span>
          </CardHeader>
          <CardBody>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)', marginBottom: 20 }}>
              Ambiente SEFAZ, séries, CSC, dados do emitente e tributos aproximados no cupom.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <Select
                label="Ambiente"
                value={ambiente}
                onChange={(e) => setAmbiente(e.target.value as 'homologacao' | 'producao')}
                options={[
                  { value: 'homologacao', label: 'Homologação' },
                  { value: 'producao', label: 'Produção' },
                ]}
                style={{ maxWidth: 280 }}
                disabled={formDisabled}
              />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
                <Input
                  label="Série NF-e"
                  type="number"
                  min={1}
                  value={serieNfe}
                  onChange={(e) => setSerieNfe(parseInt(e.target.value, 10) || 1)}
                  disabled={formDisabled}
                />
                <Input
                  label="Última NF-e emitida (número)"
                  type="number"
                  min={0}
                  value={ultimoNumeroNfe}
                  onChange={(e) => setUltimoNumeroNfe(parseInt(e.target.value, 10) || 0)}
                  disabled={formDisabled}
                />
                <Input
                  label="Série NFC-e"
                  type="number"
                  min={1}
                  value={serieNfce}
                  onChange={(e) => setSerieNfce(parseInt(e.target.value, 10) || 1)}
                  disabled={formDisabled}
                />
                <Input
                  label="Última NFC-e emitida (número)"
                  type="number"
                  min={0}
                  value={ultimoNumeroNfce}
                  onChange={(e) => setUltimoNumeroNfce(parseInt(e.target.value, 10) || 0)}
                  disabled={formDisabled}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
                <Input
                  label="UF do emitente"
                  value={ufEmitente}
                  onChange={(e) => setUfEmitente(e.target.value.toUpperCase().slice(0, 2))}
                  placeholder="SP"
                  disabled={formDisabled}
                />
                <Input
                  label="Inscrição estadual (IE)"
                  value={ieEmitente}
                  onChange={(e) => setIeEmitente(e.target.value)}
                  placeholder="ISENTO"
                  disabled={formDisabled}
                />
                <Input
                  label="Código IBGE do município (emitente)"
                  value={cMunEmitente}
                  onChange={(e) => setCMunEmitente(e.target.value.replace(/\D/g, '').slice(0, 7))}
                  placeholder="3550308"
                  disabled={formDisabled}
                />
                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 8 }}>
                    NCM padrão
                    <span title="Usado quando o produto não tiver NCM."><Info size={14} style={{ color: 'var(--color-text-muted)' }} /></span>
                  </label>
                  <Input
                    type="text"
                    value={ncmPadrao}
                    onChange={(e) => setNcmPadrao(e.target.value.replace(/\D/g, '').slice(0, 8))}
                    placeholder="21069090"
                    maxLength={8}
                    disabled={formDisabled}
                  />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
                <Input label="CSC (token NFC-e)" value={cscNfce} onChange={(e) => setCscNfce(e.target.value)} disabled={formDisabled} />
                <Input label="ID do token CSC" value={cscIdNfce} onChange={(e) => setCscIdNfce(e.target.value)} placeholder="000001" disabled={formDisabled} />
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: formDisabled ? 'not-allowed' : 'pointer', fontSize: 'var(--text-sm)' }}>
                <input
                  type="checkbox"
                  checked={indicarFonteIbpt}
                  onChange={(e) => setIndicarFonteIbpt(e.target.checked)}
                  disabled={formDisabled}
                  style={{ width: 18, height: 18, accentColor: 'var(--color-primary)' }}
                />
                Indicar fonte IBPT (tributos aproximados no cupom)
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, maxWidth: 360 }}>
                <Input
                  label="Federal (%)"
                  type="number"
                  min={0}
                  step={0.01}
                  value={tributoFederalPct || ''}
                  onChange={(e) => setTributoFederalPct(parseFloat(e.target.value) || 0)}
                  disabled={formDisabled}
                />
                <Input
                  label="Estadual (%)"
                  type="number"
                  min={0}
                  step={0.01}
                  value={tributoEstadualPct || ''}
                  onChange={(e) => setTributoEstadualPct(parseFloat(e.target.value) || 0)}
                  disabled={formDisabled}
                />
                <Input
                  label="Municipal (%)"
                  type="number"
                  min={0}
                  step={0.01}
                  value={tributoMunicipalPct || ''}
                  onChange={(e) => setTributoMunicipalPct(parseFloat(e.target.value) || 0)}
                  disabled={formDisabled}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 8 }}>
                  Autorizados a acessar XML (CPF/CNPJ)
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
                      <button type="button" onClick={() => removeXmlAutorizado(cpfCnpj)} disabled={formDisabled} style={{ background: 'none', border: 'none', cursor: formDisabled ? 'not-allowed' : 'pointer', padding: 0, display: 'flex' }} title="Remover">
                        <Trash2 size={14} />
                      </button>
                    </span>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <Input
                    value={novoXmlCpfCnpj}
                    onChange={(e) => setNovoXmlCpfCnpj(e.target.value)}
                    placeholder="CPF ou CNPJ"
                    style={{ maxWidth: 280 }}
                    disabled={formDisabled}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addXmlAutorizado())}
                  />
                  <Button variant="secondary" type="button" leftIcon={<Plus size={18} />} onClick={addXmlAutorizado} disabled={formDisabled}>
                    Adicionar
                  </Button>
                </div>
              </div>
            </div>
          </CardBody>
        </Card>

        <Card className="page-card suporte-config-card">
          <CardHeader>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Factory size={20} />
              Primeiro acesso
            </span>
          </CardHeader>
          <CardBody>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: formDisabled ? 'not-allowed' : 'pointer', fontSize: 'var(--text-sm)' }}>
              <input
                type="checkbox"
                checked={criarAdminPadrao}
                onChange={(e) => setCriarAdminPadrao(e.target.checked)}
                disabled={formDisabled}
                style={{ width: 18, height: 18, accentColor: 'var(--color-primary)' }}
              />
              Criar ou redefinir usuário <strong>admin</strong> com senha <strong>admin</strong> (recomendado para a loja entrar no PDV)
            </label>
          </CardBody>
        </Card>

        {!createdEmpresaId && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <Button leftIcon={<Save size={18} />} onClick={handleCriarEmpresa} disabled={submitting}>
              {submitting ? 'Criando…' : 'Criar empresa'}
            </Button>
            {formMessage && <Alert variant={formMessage.type}>{formMessage.text}</Alert>}
          </div>
        )}
        {createdEmpresaId && formMessage && <Alert variant={formMessage.type}>{formMessage.text}</Alert>}

        {createdEmpresaId && (
          <Card className="page-card suporte-config-card">
            <CardHeader>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Shield size={20} />
                Certificado digital A1 (opcional nesta etapa)
              </span>
            </CardHeader>
            <CardBody>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)', marginBottom: 16 }}>
                Instale o PFX/P12 neste computador se for o equipamento que emite NFC-e/NF-e. Em terminais da rede, o certificado fica no PC servidor.
              </p>
              {certStatus.hasCertificado ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-success)' }}>
                    Certificado instalado
                    {certStatus.updatedAt && (
                      <span style={{ color: 'var(--color-text-muted)', marginLeft: 8 }}>
                        ({new Date(certStatus.updatedAt).toLocaleDateString('pt-BR')})
                      </span>
                    )}
                  </span>
                  <Button variant="secondary" size="sm" leftIcon={<Trash2 size={16} />} onClick={handleCertRemove} disabled={certUploading}>
                    Remover
                  </Button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
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
              {certMessage && (
                <Alert variant={certMessage.type} style={{ marginTop: 12 }}>
                  {certMessage.text}
                </Alert>
              )}
            </CardBody>
          </Card>
        )}
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
          <Link to="/configuracoes/empresas">Empresas e acesso (lista / logins)</Link>
          {' · '}
          <Link to="/configuracoes/loja">Configurar Loja</Link>
        </p>
      </div>
    </LayoutSuporte>
  )
}
