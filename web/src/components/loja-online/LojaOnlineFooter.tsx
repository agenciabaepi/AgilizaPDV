import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { CircleHelp, Instagram, Facebook, ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useLojaOnlineStore } from '../../hooks/useLojaOnlineStore'
import { useLojaOnlineMenuCategorias } from '../../hooks/useLojaOnlineMenuCategorias'
import { formatWhatsAppLink, getMainAppUrl } from '../../lib/loja-online'
import { LOJA_ONLINE_SEM_CATEGORIA } from '../../lib/loja-online-categorias'
import { formatPhone } from '../../lib/validators'

function WhatsAppIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden fill="currentColor">
      <path d="M19.05 4.91A9.82 9.82 0 0 0 12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38c1.45.79 3.08 1.21 4.79 1.21h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.91-7.01zm-7.01 15.24h-.01c-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.25-8.24 2.2 0 4.27.86 5.82 2.42a8.18 8.18 0 0 1 2.41 5.83c.01 4.54-3.69 8.23-8.22 8.23zm4.52-6.16c-.25-.12-1.47-.72-1.7-.81-.23-.08-.39-.12-.56.12-.17.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-2-1.23-.74-.66-1.24-1.47-1.39-1.72-.14-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.12-.14.17-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.4-.42-.56-.43h-.48c-.17 0-.43.06-.66.31-.23.25-.87.85-.87 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.14-1.18-.07-.1-.23-.16-.48-.29z" />
    </svg>
  )
}

function toExternalHref(
  value: string | null | undefined,
  network: 'instagram' | 'facebook'
): string | null {
  const raw = value?.trim()
  if (!raw) return null
  if (/^https?:\/\//i.test(raw)) return raw
  if (raw.startsWith('//')) return `https:${raw}`
  const handle = raw.replace(/^@/, '').replace(/^\/+/, '')
  if (!handle) return null
  if (raw.startsWith('@') || !raw.includes('.')) {
    const host = network === 'facebook' ? 'facebook.com' : 'instagram.com'
    return `https://${host}/${handle}`
  }
  return `https://${raw.replace(/^\/+/, '')}`
}

function telHref(phone: string): string | null {
  const digits = phone.replace(/[^\d+]/g, '')
  return digits ? `tel:${digits}` : null
}

function PayBadge({ label }: { label: string }) {
  return <span className="loja-joog-pay-badge">{label}</span>
}

export function LojaOnlineFooter() {
  const { store, titulo, link } = useLojaOnlineStore()
  const { menuCategorias, temSemCategoria } = useLojaOnlineMenuCategorias()
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [aceite, setAceite] = useState(false)
  const [newsDone, setNewsDone] = useState(false)
  const [newsError, setNewsError] = useState('')

  const year = new Date().getFullYear()

  const homePath = link()
  const categoriaTo = (categoria: string | null) =>
    categoria ? `${homePath}?categoria=${encodeURIComponent(categoria)}` : homePath

  const socials = useMemo(() => {
    if (!store) return [] as { href: string; label: string; icon: ReactNode }[]
    const instagram = toExternalHref(store.loja_online_instagram, 'instagram')
    const facebook = toExternalHref(store.loja_online_facebook, 'facebook')
    return [
      instagram ? { href: instagram, label: 'Oficial', icon: <Instagram size={18} /> } : null,
      facebook ? { href: facebook, label: 'Facebook', icon: <Facebook size={18} /> } : null,
    ].filter((item): item is { href: string; label: string; icon: ReactNode } => item !== null)
  }, [store])

  if (!store) return null

  const whatsapp = store.loja_online_whatsapp?.trim()
    ? formatWhatsAppLink(store.loja_online_whatsapp, `Olá! Vim pela loja ${titulo}.`)
    : ''
  const emailContato = store.loja_online_email_contato?.trim() || ''
  const telefone = store.telefone?.trim() || ''
  const phoneHref = telefone ? telHref(telefone) : null
  const phoneLabel = telefone ? formatPhone(telefone) || telefone : ''
  const ajudaHref = emailContato
    ? `mailto:${emailContato}`
    : whatsapp || link('legal/trocas')

  const showCards = !!(store.loja_online_pag_mercadopago || store.loja_online_pag_asaas)
  const showManual = !!store.loja_online_pag_manual

  const onNewsletter = (e: FormEvent) => {
    e.preventDefault()
    setNewsError('')
    const n = nome.trim()
    const em = email.trim()
    if (n.length < 2) {
      setNewsError('Nome inválido')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
      setNewsError('E-mail inválido')
      return
    }
    if (!aceite) {
      setNewsError('Aceite os termos para continuar')
      return
    }
    setNewsDone(true)
  }

  return (
    <footer className="loja-store-footer loja-store-footer--joog">
      <section className="loja-joog-newsletter" aria-label="Newsletter">
        {newsDone ? (
          <div className="loja-joog-newsletter-success">
            <strong>Cadastro feito com sucesso!</strong>
            <p>Muito bem. Agora você faz parte da nossa lista e irá receber os melhores conteúdos.</p>
          </div>
        ) : (
          <>
            <h2 className="loja-joog-newsletter-title">Cadastre-se e receba ofertas e novidades</h2>
            <form className="loja-joog-newsletter-form" onSubmit={onNewsletter} noValidate>
              <input
                type="text"
                name="nome"
                autoComplete="name"
                placeholder="Seu nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                aria-label="Seu nome"
              />
              <input
                type="email"
                name="email"
                autoComplete="email"
                placeholder="Seu e-mail"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-label="Seu e-mail"
              />
              <button type="submit" className="loja-joog-newsletter-submit">
                Cadastrar
                <ArrowRight size={18} strokeWidth={2.25} aria-hidden />
              </button>
              <label className="loja-joog-newsletter-check">
                <input
                  type="checkbox"
                  checked={aceite}
                  onChange={(e) => setAceite(e.target.checked)}
                />
                <span>
                  Ao me cadastrar, declaro que estou de acordo com os{' '}
                  <Link to={link('legal/termos')}>termos de uso</Link> e{' '}
                  <Link to={link('legal/privacidade')}>privacidade</Link>
                </span>
              </label>
              {newsError ? <p className="loja-joog-newsletter-error">{newsError}</p> : null}
            </form>
          </>
        )}
      </section>

      <div className="loja-joog-footer-shell">
        <div className="loja-joog-footer-main">
          <div className="loja-joog-footer-lists">
            <div className="loja-joog-footer-list">
              <h3 className="loja-joog-footer-list-title">Sobre nós</h3>
              <ul>
                <li>
                  <Link to={homePath} className="loja-joog-footer-link">
                    Nossa loja
                  </Link>
                </li>
                {store.loja_online_descricao?.trim() ? (
                  <li className="loja-joog-footer-about">{store.loja_online_descricao.trim()}</li>
                ) : null}
              </ul>
            </div>

            <div className="loja-joog-footer-list">
              <h3 className="loja-joog-footer-list-title">Ajuda</h3>
              <ul>
                <li>
                  <Link to={link('legal/privacidade')} className="loja-joog-footer-link">
                    Política de Privacidade
                  </Link>
                </li>
                <li>
                  <Link to={link('legal/trocas')} className="loja-joog-footer-link">
                    Trocas e Devoluções
                  </Link>
                </li>
                <li>
                  <Link to={link('legal/entrega')} className="loja-joog-footer-link">
                    Política de entrega
                  </Link>
                </li>
                <li>
                  <Link to={link('legal/termos')} className="loja-joog-footer-link">
                    Termos de uso
                  </Link>
                </li>
              </ul>
            </div>

            {(menuCategorias.length > 0 || temSemCategoria) && (
              <div className="loja-joog-footer-list">
                <h3 className="loja-joog-footer-list-title">Categorias</h3>
                <ul>
                  {menuCategorias.map((cat) => (
                    <li key={cat.id}>
                      <Link to={categoriaTo(cat.id)} className="loja-joog-footer-link">
                        {cat.nome}
                      </Link>
                    </li>
                  ))}
                  {temSemCategoria ? (
                    <li>
                      <Link to={categoriaTo(LOJA_ONLINE_SEM_CATEGORIA)} className="loja-joog-footer-link">
                        Outros
                      </Link>
                    </li>
                  ) : null}
                </ul>
              </div>
            )}
          </div>

          <div className="loja-joog-footer-contact">
            <h3 className="loja-joog-footer-list-title loja-joog-footer-list-title--contact">Atendimento</h3>
            {phoneLabel ? (
              <div className="loja-joog-footer-sac">
                <span className="loja-joog-footer-sac-label">SAC</span>
                {phoneHref ? (
                  <a href={phoneHref} className="loja-joog-footer-phone">
                    {phoneLabel}
                  </a>
                ) : (
                  <span className="loja-joog-footer-phone">{phoneLabel}</span>
                )}
              </div>
            ) : null}

            {whatsapp ? (
              <a
                href={whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className="loja-joog-footer-whatsapp"
              >
                <WhatsAppIcon size={18} />
                Converse por WhatsApp
              </a>
            ) : null}

            <a
              href={ajudaHref}
              className="loja-joog-footer-help"
              {...(ajudaHref.startsWith('http') || ajudaHref.startsWith('mailto:')
                ? { target: '_blank', rel: 'noopener noreferrer' }
                : {})}
            >
              <CircleHelp size={16} strokeWidth={2} />
              Central de atendimento
            </a>

            {socials.length > 0 ? (
              <div className="loja-joog-footer-social">
                <span className="loja-joog-footer-social-label">Siga-nos</span>
                <div className="loja-joog-footer-social-list">
                  {socials.map((item) => (
                    <a
                      key={item.label}
                      href={item.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="loja-joog-footer-social-item"
                      aria-label={item.label}
                    >
                      <span className="loja-joog-footer-social-icon">{item.icon}</span>
                      <span>{item.label}</span>
                    </a>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="loja-joog-footer-payments">
          <span className="loja-joog-footer-payments-label">Pague com</span>
          <div className="loja-joog-footer-payments-list" aria-label="Formas de pagamento">
            <PayBadge label="PIX" />
            {showCards ? (
              <>
                <PayBadge label="Visa" />
                <PayBadge label="Master" />
                <PayBadge label="Elo" />
                <PayBadge label="Amex" />
              </>
            ) : null}
            {showManual ? <PayBadge label="Na loja" /> : null}
            {!showCards && !showManual ? (
              <>
                <PayBadge label="Visa" />
                <PayBadge label="Master" />
                <PayBadge label="Elo" />
              </>
            ) : null}
          </div>
        </div>

        <div className="loja-joog-footer-bottom">
          <p className="loja-joog-footer-copy">
            {titulo} © {year} | Todos os direitos reservados
            {store.loja_online_rodape_texto?.trim()
              ? ` | ${store.loja_online_rodape_texto.trim()}`
              : ''}
          </p>
          <div className="loja-joog-footer-badges">
            <a
              href={getMainAppUrl('/')}
              target="_blank"
              rel="noopener noreferrer"
              className="loja-joog-footer-badge"
            >
              <span>Feito com</span>
              <strong>Agiliza PDV</strong>
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
