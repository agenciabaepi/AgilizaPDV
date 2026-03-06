import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useEmpresaTheme } from '../hooks/useEmpresaTheme'
import { LayoutSuporte } from '../components/LayoutSuporte'
import { PageTitle, Card, CardHeader, CardBody, Button, Input, Alert, Select } from '../components/ui'
import {
  Building2,
  Image,
  Palette,
  LayoutGrid,
  Save,
  Upload,
  X,
  Check,
} from 'lucide-react'
import type { EmpresaConfig, ModuloId, UpdateEmpresaConfigInput } from '../vite-env'

const MODULOS: { id: ModuloId; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'produtos', label: 'Produtos' },
  { id: 'etiquetas', label: 'Etiquetas' },
  { id: 'categorias', label: 'Categorias' },
  { id: 'clientes', label: 'Clientes' },
  { id: 'fornecedores', label: 'Fornecedores' },
  { id: 'estoque', label: 'Estoque' },
  { id: 'caixa', label: 'Caixa' },
  { id: 'vendas', label: 'Vendas' },
  { id: 'pdv', label: 'PDV' },
]

const CORES_PRESET = [
  '#ea1d2c', '#065f46', '#1d4ed8', '#7c3aed', '#db2777',
  '#ea580c', '#ca8a04', '#16a34a', '#0ea5e9', '#6366f1',
]

function parseModulos(json: string | null): Record<ModuloId, boolean> {
  const defaults: Record<ModuloId, boolean> = {
    dashboard: true, produtos: true, etiquetas: true, categorias: true,
    clientes: true, fornecedores: true, estoque: true, caixa: true,
    vendas: true, pdv: true,
  }
  if (!json?.trim()) return defaults
  try {
    const parsed = JSON.parse(json) as Record<string, boolean>
    return { ...defaults, ...parsed }
  } catch {
    return defaults
  }
}

export function ConfigurarLoja() {
  const { session } = useAuth()
  const { setEmpresaIdForTheme } = useEmpresaTheme()
  const navigate = useNavigate()
  const [empresas, setEmpresas] = useState<{ id: string; nome: string }[]>([])
  const [empresaId, setEmpresaId] = useState('')
  const [config, setConfig] = useState<EmpresaConfig | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const [nome, setNome] = useState('')
  const [razaoSocial, setRazaoSocial] = useState('')
  const [cnpj, setCnpj] = useState('')
  const [endereco, setEndereco] = useState('')
  const [telefone, setTelefone] = useState('')
  const [email, setEmail] = useState('')
  const [logo, setLogo] = useState<string | null>(null)
  const [corPrimaria, setCorPrimaria] = useState('#ea1d2c')
  const [modulos, setModulos] = useState<Record<ModuloId, boolean>>(() =>
    MODULOS.reduce((acc, m) => ({ ...acc, [m.id]: true }), {} as Record<ModuloId, boolean>)
  )

  const isSuporte = session && 'suporte' in session && session.suporte

  const loadEmpresas = useCallback(() => {
    window.electronAPI.empresas.list().then((list: { id: string; nome: string }[]) => {
      setEmpresas(list)
      if (list.length === 1 && !empresaId) setEmpresaId(list[0].id)
    }).catch(() => setEmpresas([]))
  }, [empresaId])

  const loadConfig = useCallback(() => {
    if (!empresaId) {
      setConfig(null)
      return
    }
    setLoading(true)
    window.electronAPI.empresas.getConfig(empresaId)
      .then((c) => {
        setConfig(c ?? null)
        if (c) {
          setNome(c.nome)
          setRazaoSocial(c.razao_social ?? '')
          setCnpj(c.cnpj ?? '')
          setEndereco(c.endereco ?? '')
          setTelefone(c.telefone ?? '')
          setEmail(c.email ?? '')
          setLogo(c.logo ?? null)
          setCorPrimaria(c.cor_primaria ?? '#ea1d2c')
          setModulos(parseModulos(c.modulos_json))
        }
      })
      .catch(() => setConfig(null))
      .finally(() => setLoading(false))
  }, [empresaId])

  useEffect(() => {
    if (!isSuporte) {
      navigate('/dashboard', { replace: true })
      return
    }
    loadEmpresas()
  }, [isSuporte, navigate, loadEmpresas])

  useEffect(() => {
    loadConfig()
  }, [loadConfig])

  useEffect(() => {
    setEmpresaIdForTheme(empresaId || null)
    return () => setEmpresaIdForTheme(null)
  }, [empresaId, setEmpresaIdForTheme])

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = () => {
      const data = reader.result as string
      if (data.length > 500 * 1024) {
        setMessage({ type: 'error', text: 'Imagem muito grande. Use até 500KB.' })
        return
      }
      setLogo(data)
      setMessage(null)
    }
    reader.readAsDataURL(file)
  }

  const handleSave = async () => {
    if (!empresaId) {
      setMessage({ type: 'error', text: 'Selecione uma empresa.' })
      return
    }
    setSaving(true)
    setMessage(null)
    try {
      const data: UpdateEmpresaConfigInput = {
        nome: nome.trim() || undefined,
        cnpj: cnpj.trim() || null,
        razao_social: razaoSocial.trim() || null,
        endereco: endereco.trim() || null,
        telefone: telefone.trim() || null,
        email: email.trim() || null,
        logo: logo || null,
        cor_primaria: corPrimaria || null,
        modulos,
      }
      await window.electronAPI.empresas.updateConfig(empresaId, data)
      setMessage({ type: 'success', text: 'Configuração salva com sucesso. O cliente verá as alterações ao recarregar.' })
      loadConfig()
    } catch {
      setMessage({ type: 'error', text: 'Erro ao salvar configuração.' })
    } finally {
      setSaving(false)
    }
  }

  const toggleModulo = (id: ModuloId) => {
    setModulos((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  if (!isSuporte) return null

  return (
    <LayoutSuporte>
      <PageTitle
        title="Configurar loja"
        subtitle="Personalize dados da empresa, logo, cor e módulos para o usuário."
      />
      <div className="suporte-config-stack">
        <Card className="page-card suporte-config-card">
          <CardHeader>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Building2 size={20} />
              Selecionar empresa
            </span>
          </CardHeader>
          <CardBody>
            <Select
              label="Empresa"
              value={empresaId}
              onChange={(e) => setEmpresaId(e.target.value)}
              options={empresas.map((e) => ({ value: e.id, label: e.nome }))}
              placeholder="Selecione a empresa"
              style={{ maxWidth: 400 }}
            />
            {loading && (
              <p style={{ marginTop: 8, color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
                Carregando…
              </p>
            )}
          </CardBody>
        </Card>

        {empresaId && (
          <>
            <Card className="page-card suporte-config-card">
              <CardHeader>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Building2 size={20} />
                  Dados da empresa
                </span>
              </CardHeader>
              <CardBody>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
                  <Input label="Nome fantasia" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Loja do João" />
                  <Input label="Razão social" value={razaoSocial} onChange={(e) => setRazaoSocial(e.target.value)} placeholder="Ex.: João Comércio Ltda" />
                  <Input label="CNPJ" value={cnpj} onChange={(e) => setCnpj(e.target.value)} placeholder="00.000.000/0001-00" />
                  <Input label="Endereço" value={endereco} onChange={(e) => setEndereco(e.target.value)} placeholder="Rua, número, bairro" />
                  <Input label="Telefone" value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(00) 00000-0000" />
                  <Input label="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="contato@loja.com" type="email" />
                </div>
              </CardBody>
            </Card>

            <Card className="page-card suporte-config-card">
              <CardHeader>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Image size={20} />
                  Logo
                </span>
              </CardHeader>
              <CardBody>
                <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)', marginBottom: 16 }}>
                  Faça upload da logo da loja. Será exibida no topo do sistema. Formatos: PNG, JPG. Máx. 500KB.
                </p>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
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
                    <label className="btn btn--secondary btn--md" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/jpg,image/webp"
                        onChange={handleLogoChange}
                        style={{ display: 'none' }}
                      />
                      <Upload size={18} />
                      Enviar imagem
                    </label>
                    {logo && (
                      <Button variant="secondary" leftIcon={<X size={18} />} onClick={() => setLogo(null)}>
                        Remover logo
                      </Button>
                    )}
                  </div>
                </div>
              </CardBody>
            </Card>

            <Card className="page-card suporte-config-card">
              <CardHeader>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Palette size={20} />
                  Cor do sistema
                </span>
              </CardHeader>
              <CardBody>
                <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)', marginBottom: 16 }}>
                  Escolha a cor principal que aparecerá em botões, links e destaques.
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {CORES_PRESET.map((cor) => (
                      <button
                        key={cor}
                        type="button"
                        onClick={() => setCorPrimaria(cor)}
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 'var(--radius-full)',
                          background: cor,
                          border: corPrimaria === cor ? '3px solid var(--color-text)' : '2px solid transparent',
                          cursor: 'pointer',
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
                      style={{ width: 48, height: 36, border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}
                    />
                    <Input
                      value={corPrimaria}
                      onChange={(e) => setCorPrimaria(e.target.value)}
                      placeholder="#ea1d2c"
                      style={{ width: 120 }}
                    />
                  </div>
                </div>
                <div
                  style={{
                    marginTop: 16,
                    padding: 12,
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  <p style={{ fontSize: 'var(--text-sm)', marginBottom: 8 }}>Preview:</p>
                  <Button style={{ background: corPrimaria, borderColor: corPrimaria }}>
                    Botão de exemplo
                  </Button>
                </div>
              </CardBody>
            </Card>

            <Card className="page-card suporte-config-card">
              <CardHeader>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <LayoutGrid size={20} />
                  Módulos
                </span>
              </CardHeader>
              <CardBody>
                <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)', marginBottom: 16 }}>
                  Ative ou desative os módulos que o usuário verá no menu. Módulos desativados ficam ocultos.
                </p>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                    gap: 12,
                  }}
                >
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
                        cursor: 'pointer',
                        background: modulos[m.id] ? 'var(--color-primary-light)' : 'transparent',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={modulos[m.id]}
                        onChange={() => toggleModulo(m.id)}
                        style={{ width: 18, height: 18, accentColor: 'var(--color-primary)' }}
                      />
                      <span style={{ fontSize: 'var(--text-sm)', fontWeight: modulos[m.id] ? 600 : 400 }}>
                        {m.label}
                      </span>
                      {modulos[m.id] ? <Check size={16} color="var(--color-success)" /> : null}
                    </label>
                  ))}
                </div>
              </CardBody>
            </Card>

            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <Button leftIcon={<Save size={18} />} onClick={handleSave} disabled={saving}>
                {saving ? 'Salvando…' : 'Salvar configuração'}
              </Button>
              {message && (
                <Alert variant={message.type}>
                  {message.text}
                </Alert>
              )}
            </div>
          </>
        )}

        {empresas.length === 0 && !loading && (
          <Alert variant="info">
            Nenhuma empresa cadastrada. Crie uma empresa primeiro nas configurações do sistema.
          </Alert>
        )}
      </div>
    </LayoutSuporte>
  )
}
