import type { CSSProperties } from 'react'
import type {
  LojaOnlineCardSlot,
  LojaOnlineCardStyleConfig,
  LojaOnlineCardsConfig,
  LojaOnlineCardTemplateSpec,
} from '../../lib/loja-online-cards'
import {
  LOJA_ONLINE_CARD_CORES_CTA_PRESET,
  LOJA_ONLINE_CARD_CORES_FUNDO_PRESET,
  LOJA_ONLINE_CARD_TEMPLATES,
} from '../../lib/loja-online-cards'
import { normalizeLojaOnlineHexColor } from '../../lib/loja-online'
import { Input } from '../ui'

function ColorPickerRow({
  label,
  hint,
  value,
  presets,
  fallback,
  onChange,
}: {
  label: string
  hint?: string
  value: string
  presets: readonly string[]
  fallback: string
  onChange: (hex: string) => void
}) {
  const normalized = normalizeLojaOnlineHexColor(value, fallback)
  return (
    <div className="loja-cards-color-field">
      <p className="loja-online-subsection-title">{label}</p>
      {hint ? <p className="loja-online-hint">{hint}</p> : null}
      <div className="config-loja-cor-row">
        <div className="config-loja-cor-presets">
          {presets.map((cor) => (
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

function TemplatePicker({
  slot,
  selected,
  style,
  onSelect,
}: {
  slot: LojaOnlineCardSlot
  selected: LojaOnlineCardStyleConfig
  style: LojaOnlineCardStyleConfig
  onSelect: (templateId: LojaOnlineCardStyleConfig['template']) => void
}) {
  const templates = LOJA_ONLINE_CARD_TEMPLATES[slot]

  return (
    <div className="loja-cards-template-grid">
      {templates.map((spec) => (
        <TemplateTile
          key={spec.id}
          spec={spec}
          active={selected.template === spec.id}
          previewStyle={{
            background: spec.id === selected.template ? style.corFundo : spec.previewCorFundo,
            '--preview-cta': spec.id === selected.template ? style.corCta : spec.previewCorCta,
          } as CSSProperties}
          onSelect={() => spec.available && onSelect(spec.id)}
        />
      ))}
    </div>
  )
}

function TemplateTile({
  spec,
  active,
  previewStyle,
  onSelect,
}: {
  spec: LojaOnlineCardTemplateSpec
  active: boolean
  previewStyle: CSSProperties
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      className={`loja-cards-template-tile${active ? ' is-active' : ''}${!spec.available ? ' is-soon' : ''}`}
      onClick={onSelect}
      disabled={!spec.available}
      aria-pressed={active}
    >
      <span className="loja-cards-template-preview" style={previewStyle}>
        <span className="loja-cards-template-preview-img" />
        <span className="loja-cards-template-preview-line" />
        <span
          className="loja-cards-template-preview-btn"
          style={{ background: (previewStyle as CSSProperties & { '--preview-cta'?: string })['--preview-cta'] ?? '#000' }}
        />
      </span>
      <span className="loja-cards-template-meta">
        <strong>{spec.label}</strong>
        {!spec.available ? <em>Em breve</em> : null}
        <small>{spec.description}</small>
      </span>
    </button>
  )
}

function CardSlotEditor({
  slot,
  title,
  style,
  onChange,
}: {
  slot: LojaOnlineCardSlot
  title: string
  style: LojaOnlineCardStyleConfig
  onChange: (next: LojaOnlineCardStyleConfig) => void
}) {
  const update = (patch: Partial<LojaOnlineCardStyleConfig>) => onChange({ ...style, ...patch })

  return (
    <div className="loja-cards-slot-editor">
      <h3 className="loja-cards-slot-title">{title}</h3>
      <p className="loja-online-hint loja-cards-slot-hint">
        {slot === 'produto'
          ? 'Usado no catálogo e no carrossel Destaques da semana. Novos templates serão adicionados aqui.'
          : 'Escolha o modelo visual. Novos templates serão adicionados aqui, no estilo Elementor.'}
      </p>

      <p className="loja-online-subsection-title">Modelo do card</p>
      <TemplatePicker
        slot={slot}
        selected={style}
        style={style}
        onSelect={(template) => update({ template })}
      />

      <ColorPickerRow
        label="Cor de fundo do card"
        hint="Plano de fundo atrás da imagem e textos."
        value={style.corFundo}
        presets={LOJA_ONLINE_CARD_CORES_FUNDO_PRESET}
        fallback={style.corFundo}
        onChange={(corFundo) => update({ corFundo: normalizeLojaOnlineHexColor(corFundo, style.corFundo) })}
      />

      <ColorPickerRow
        label="Cor do botão"
        hint="Botão Comprar / Adicionar ao carrinho."
        value={style.corCta}
        presets={LOJA_ONLINE_CARD_CORES_CTA_PRESET}
        fallback="#000000"
        onChange={(corCta) => update({ corCta: normalizeLojaOnlineHexColor(corCta, '#000000') })}
      />

      <div
        className={`loja-cards-live-preview loja-cards-live-preview--${slot}`}
        style={
          {
            '--loja-card-produto-cor': style.corFundo,
            '--loja-card-produto-cta': style.corCta,
            '--loja-card-categoria-cor': style.corFundo,
            '--loja-card-categoria-cta': style.corCta,
          } as CSSProperties
        }
      >
        {slot === 'produto' && (
          <article
            className="loja-galaxy-card loja-card-produto loja-card-produto--galaxy"
            style={{ backgroundColor: style.corFundo } as CSSProperties}
          >
            <h3 className="loja-galaxy-card-title">Produto exemplo</h3>
            <div className="loja-galaxy-card-media" style={{ backgroundColor: style.corFundo }}>
              <span className="loja-cards-preview-placeholder" />
            </div>
            <p className="loja-galaxy-card-price">
              R$ 99,90 <span className="loja-galaxy-card-price-tag">à vista</span>
            </p>
            <span className="loja-galaxy-card-cta loja-cards-preview-cta">Comprar agora</span>
          </article>
        )}
        {slot === 'categoria' && (
          <article className="loja-eco-card loja-card-categoria loja-card-categoria--eco">
            <div className="loja-eco-card-media">
              <span className="loja-cards-preview-placeholder" />
            </div>
            <h3 className="loja-eco-card-title">Categoria</h3>
            <p className="loja-eco-card-subtitle">Pague em até 18x</p>
            <span className="loja-eco-card-cta loja-cards-preview-cta">Comprar</span>
          </article>
        )}
      </div>
    </div>
  )
}

export function LojaOnlineCardsConfigEditor({
  value,
  onChange,
}: {
  value: LojaOnlineCardsConfig
  onChange: (next: LojaOnlineCardsConfig) => void
}) {
  return (
    <div className="loja-cards-config-editor">
      <CardSlotEditor
        slot="produto"
        title="Cards de produto"
        style={value.produto}
        onChange={(produto) => onChange({ ...value, produto })}
      />
      <hr className="loja-cards-config-divider" />
      <CardSlotEditor
        slot="categoria"
        title="Cards de categoria"
        style={value.categoria}
        onChange={(categoria) => onChange({ ...value, categoria })}
      />
    </div>
  )
}
