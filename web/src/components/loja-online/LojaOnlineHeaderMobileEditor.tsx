import type { CSSProperties, ChangeEvent } from 'react'
import { useEffect, useState } from 'react'
import { Menu, Search, ShoppingCart, Upload, X } from 'lucide-react'
import type { LojaOnlineHeaderMobileId } from '../../lib/loja-online-header'
import {
  LOJA_ONLINE_HEADER_MOBILE_TEMPLATES,
  LOJA_ONLINE_LOGO_HEADER_SIZE_MAX,
  LOJA_ONLINE_LOGO_HEADER_SIZE_MIN,
  parseLojaOnlineLogoHeaderSize,
} from '../../lib/loja-online-header'
import {
  LOJA_ONLINE_CORES_HEADER_PRESET,
  LOJA_ONLINE_COR_HEADER_PADRAO,
  LOJA_ONLINE_COR_MENU_PADRAO,
  lojaOnlineForegroundOn,
  normalizeLojaOnlineHexColor,
} from '../../lib/loja-online'
import { LojaOnlineHeaderMobilePicker } from './LojaOnlineHeaderMobilePicker'
import { Button, Input } from '../ui'

function ColorPickerRow({
  label,
  hint,
  value,
  fallback,
  onChange,
}: {
  label: string
  hint: string
  value: string
  fallback: string
  onChange: (hex: string) => void
}) {
  const normalized = normalizeLojaOnlineHexColor(value, fallback)
  return (
    <div className="loja-cards-color-field">
      <p className="loja-online-subsection-title">{label}</p>
      <p className="loja-online-hint">{hint}</p>
      <div className="config-loja-cor-row">
        <div className="config-loja-cor-presets">
          {LOJA_ONLINE_CORES_HEADER_PRESET.map((cor) => (
            <button
              key={cor}
              type="button"
              onClick={() => onChange(cor)}
              className="config-loja-cor-swatch"
              style={{
                width: 32,
                height: 32,
                borderRadius: 'var(--radius-full)',
                background: cor,
                border:
                  normalized === cor.toLowerCase()
                    ? '3px solid var(--color-text)'
                    : '2px solid #d4d4d8',
                cursor: 'pointer',
                boxShadow: 'var(--shadow-sm)',
              }}
              title={cor}
            />
          ))}
        </div>
        <div className="config-loja-cor-input">
          <input
            type="color"
            value={normalized}
            onChange={(e) => onChange(e.target.value)}
            style={{ width: 40, height: 32, border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}
            aria-label={`Seletor ${label}`}
          />
          <Input
            value={normalized}
            onChange={(e) => onChange(e.target.value)}
            placeholder={fallback}
            style={{ width: 120 }}
          />
        </div>
      </div>
    </div>
  )
}

function HeaderLivePreview({
  template,
  titulo,
  logo,
  logoSize,
  corPrimaria,
  corFundo,
  corHeader,
  corMenu,
}: {
  template: LojaOnlineHeaderMobileId
  titulo: string
  logo?: string | null
  logoSize: number
  corPrimaria: string
  corFundo: string
  corHeader: string
  corMenu: string
}) {
  const spec = LOJA_ONLINE_HEADER_MOBILE_TEMPLATES.find((t) => t.id === template)
  const nome = titulo.trim() || 'Minha Loja'
  const [menuOpen, setMenuOpen] = useState(false)
  const headerFg = lojaOnlineForegroundOn(corHeader)
  const menuFg = lojaOnlineForegroundOn(corMenu)

  useEffect(() => {
    setMenuOpen(false)
  }, [template])

  return (
    <div className="loja-header-live">
      <p className="loja-online-subsection-title">Preview no celular</p>
      <p className="loja-online-hint">
        {spec?.description} O logo aparece no tamanho real ({logoSize}px). Toque no menu para ver a lista.
      </p>
      <div
        className="loja-header-phone"
        style={
          {
            '--loja-cor': corPrimaria,
            '--loja-header-bg': corHeader,
            '--loja-header-fg': headerFg,
            '--loja-menu-bg': corMenu,
            '--loja-menu-fg': menuFg,
            '--loja-logo-h': `${logoSize}px`,
            background: corFundo,
          } as CSSProperties
        }
      >
        <div className="loja-header-phone-status">
          <span>9:41</span>
          <span className="loja-header-phone-notch" />
          <span>LTE</span>
        </div>
        <div className={`loja-header-live-bar loja-header-live-bar--${template}`}>
          <button
            type="button"
            className="loja-header-live-menu"
            aria-label="Abrir menu"
            onClick={() => setMenuOpen(true)}
          >
            <Menu size={18} />
          </button>
          <span className="loja-header-live-brand">
            {logo ? (
              <img src={logo} alt="" className="loja-header-live-logo" />
            ) : (
              <span className="loja-header-live-name">{nome}</span>
            )}
          </span>
          <span className="loja-header-live-cart" aria-hidden>
            <ShoppingCart size={18} />
            <span className="loja-header-live-badge">2</span>
          </span>
          <span className="loja-header-live-search">
            <Search size={14} />
            <span>Buscar produtos…</span>
          </span>
        </div>
        <div className="loja-header-live-grid">
          <span />
          <span />
          <span />
          <span />
        </div>
        <div className={`loja-header-live-drawer${menuOpen ? ' is-open' : ''}`}>
          <button
            type="button"
            className="loja-header-live-drawer-backdrop"
            aria-label="Fechar menu"
            onClick={() => setMenuOpen(false)}
          />
          <div className="loja-header-live-drawer-panel">
            <div className="loja-header-live-drawer-head">
              {logo ? (
                <img src={logo} alt="" className="loja-header-live-drawer-logo" />
              ) : (
                <span>{nome}</span>
              )}
              <button type="button" aria-label="Fechar" onClick={() => setMenuOpen(false)}>
                <X size={14} />
              </button>
            </div>
            <div className="loja-header-live-drawer-nav">
              <span>Início</span>
              <span>Entrar</span>
              <span className="loja-header-live-drawer-cta">Criar conta</span>
            </div>
            <p>Categorias</p>
            <div className="loja-header-live-drawer-nav">
              <span className="is-active">Todos</span>
              <span>Novidades</span>
              <span>Ofertas</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function LojaOnlineHeaderMobileEditor({
  value,
  onChange,
  titulo,
  logoHeader,
  logoSistema,
  onLogoHeaderChange,
  logoHeaderSize,
  onLogoHeaderSizeChange,
  corPrimaria,
  corFundo,
  corHeader,
  onCorHeaderChange,
  corMenu,
  onCorMenuChange,
}: {
  value: LojaOnlineHeaderMobileId
  onChange: (id: LojaOnlineHeaderMobileId) => void
  titulo: string
  logoHeader: string | null
  logoSistema?: string | null
  onLogoHeaderChange: (value: string | null) => void
  logoHeaderSize: number
  onLogoHeaderSizeChange: (size: number) => void
  corPrimaria: string
  corFundo: string
  corHeader: string
  onCorHeaderChange: (hex: string) => void
  corMenu: string
  onCorMenuChange: (hex: string) => void
}) {
  const [logoError, setLogoError] = useState<string | null>(null)
  const previewLogo = logoHeader?.trim() || logoSistema?.trim() || null
  const size = parseLojaOnlineLogoHeaderSize(logoHeaderSize)

  const handleLogoUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setLogoError('Envie um arquivo de imagem (PNG, JPG ou WEBP).')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const data = reader.result as string
      if (data.length > 500 * 1024) {
        setLogoError('Imagem muito grande. Use até 500KB.')
        return
      }
      setLogoError(null)
      onLogoHeaderChange(data)
    }
    reader.onerror = () => setLogoError('Não foi possível ler a imagem.')
    reader.readAsDataURL(file)
  }

  return (
    <div className="loja-header-editor">
      <div className="loja-header-editor-options">
        <p className="loja-online-hint">
          Toque em um modelo para aplicar. A busca fica sempre na linha de baixo.
        </p>
        <LojaOnlineHeaderMobilePicker value={value} onChange={onChange} />
        <div className="loja-header-logo-field">
          <p className="loja-online-subsection-title">Logo do cabeçalho</p>
          <p className="loja-online-hint">
            Só aparece no header da loja online. O logo do PDV e do sistema continua o de
            Configurações → Dados da loja. PNG, JPG ou WEBP, até 500KB.
          </p>
          <div className="config-loja-logo-row">
            <div className="config-loja-logo-preview loja-header-logo-preview">
              {previewLogo ? (
                <img src={previewLogo} alt="Logo do cabeçalho" />
              ) : (
                <span>Sem logo</span>
              )}
            </div>
            <div className="loja-header-logo-actions">
              <label className="btn btn--secondary btn--sm" style={{ cursor: 'pointer' }}>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  onChange={handleLogoUpload}
                  hidden
                />
                <Upload size={16} />
                Enviar logo
              </label>
              {logoHeader && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  leftIcon={<X size={16} />}
                  onClick={() => {
                    setLogoError(null)
                    onLogoHeaderChange(null)
                  }}
                >
                  Usar logo do sistema
                </Button>
              )}
            </div>
          </div>
          {logoError && <p className="loja-header-logo-error">{logoError}</p>}
          {!logoHeader && logoSistema && (
            <p className="loja-online-hint">Mostrando o logo do sistema até você enviar um específico.</p>
          )}
          <div className="loja-header-logo-size">
            <div className="loja-header-logo-size-head">
              <p className="loja-online-subsection-title">Tamanho do logo</p>
              <span>{size}px</span>
            </div>
            <p className="loja-online-hint">
              Altura real no celular. Arraste para ver no preview ao lado, no mesmo tamanho.
            </p>
            <input
              type="range"
              min={LOJA_ONLINE_LOGO_HEADER_SIZE_MIN}
              max={LOJA_ONLINE_LOGO_HEADER_SIZE_MAX}
              step={1}
              value={size}
              onChange={(e) => onLogoHeaderSizeChange(parseLojaOnlineLogoHeaderSize(e.target.value))}
              aria-label="Tamanho do logo no cabeçalho"
              className="loja-header-logo-slider"
            />
            <div className="loja-header-logo-size-scale" aria-hidden>
              <span>Menor</span>
              <span>Maior</span>
            </div>
          </div>
        </div>
        <ColorPickerRow
          label="Cor do cabeçalho"
          hint="Barra do site com logo, menu, carrinho e busca."
          value={corHeader}
          fallback={LOJA_ONLINE_COR_HEADER_PADRAO}
          onChange={onCorHeaderChange}
        />
        <ColorPickerRow
          label="Cor do header do menu"
          hint="Faixa de cima do menu lateral, com o nome da loja e o botão de fechar."
          value={corMenu}
          fallback={LOJA_ONLINE_COR_MENU_PADRAO}
          onChange={onCorMenuChange}
        />
      </div>
      <HeaderLivePreview
        template={value}
        titulo={titulo}
        logo={previewLogo}
        logoSize={size}
        corPrimaria={corPrimaria}
        corFundo={corFundo}
        corHeader={corHeader}
        corMenu={corMenu}
      />
    </div>
  )
}
