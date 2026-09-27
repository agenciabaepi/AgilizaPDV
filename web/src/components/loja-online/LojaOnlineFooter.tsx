import type { ReactNode } from 'react'
import { Instagram, Facebook, Mail, MapPin, Phone, Home, Search, ShoppingBag, User } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useLojaOnlineStore } from '../../hooks/useLojaOnlineStore'
import { formatWhatsAppLink, getMainAppUrl, resolveLojaOnlineLogoHeader } from '../../lib/loja-online'
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

export function LojaOnlineFooter() {
  const { store, titulo, link } = useLojaOnlineStore()
  if (!store) return null

  const logo = resolveLojaOnlineLogoHeader(store)
  const descricao = store.loja_online_descricao?.trim() || ''
  const rodape = store.loja_online_rodape_texto?.trim() || ''
  const about = [descricao, rodape].filter((text, index, list) => text && list.indexOf(text) === index)
  const instagram = toExternalHref(store.loja_online_instagram, 'instagram')
  const facebook = toExternalHref(store.loja_online_facebook, 'facebook')
  const whatsapp = store.loja_online_whatsapp?.trim()
    ? formatWhatsAppLink(store.loja_online_whatsapp, `Olá! Vim pela loja ${titulo}.`)
    : ''
  const email = store.loja_online_email_contato?.trim() || ''
  const telefone = store.telefone?.trim() || ''
  const endereco = store.endereco?.trim() || ''
  const phoneHref = telefone ? telHref(telefone) : null
  const hasContact = Boolean(endereco || telefone || email || whatsapp)
  const socials: { href: string; label: string; icon: ReactNode }[] = [
    instagram ? { href: instagram, label: 'Instagram', icon: <Instagram size={18} /> } : null,
    facebook ? { href: facebook, label: 'Facebook', icon: <Facebook size={18} /> } : null,
    whatsapp ? { href: whatsapp, label: 'WhatsApp', icon: <WhatsAppIcon /> } : null,
  ].filter((item): item is { href: string; label: string; icon: ReactNode } => item !== null)

  return (
    <footer className="loja-store-footer">
      <div className={`loja-store-footer-inner${hasContact ? '' : ' loja-store-footer-inner--no-contact'}`}>
        <div className="loja-store-footer-brand">
          <Link to={link()} className="loja-store-footer-brand-link">
            {logo ? (
              <span className="loja-store-footer-logo">
                <img src={logo} alt="" />
              </span>
            ) : null}
            <strong>{titulo}</strong>
          </Link>
          {about.map((text) => (
            <p key={text}>{text}</p>
          ))}
          {socials.length > 0 && (
            <div className="loja-store-footer-social" aria-label="Redes sociais">
              {socials.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={item.label}
                  title={item.label}
                >
                  {item.icon}
                </a>
              ))}
            </div>
          )}
        </div>

        {hasContact && (
          <div className="loja-store-footer-col">
            <h2>Contato</h2>
            <div className="loja-store-footer-contact">
              {endereco && (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(endereco)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <MapPin size={16} />
                  <span>{endereco}</span>
                </a>
              )}
              {telefone && phoneHref && (
                <a href={phoneHref}>
                  <Phone size={16} />
                  <span>{formatPhone(telefone) || telefone}</span>
                </a>
              )}
              {whatsapp && (
                <a href={whatsapp} target="_blank" rel="noopener noreferrer">
                  <WhatsAppIcon size={16} />
                  <span>WhatsApp</span>
                </a>
              )}
              {email && (
                <a href={`mailto:${email}`}>
                  <Mail size={16} />
                  <span>{email}</span>
                </a>
              )}
            </div>
          </div>
        )}

        <div className="loja-store-footer-col">
          <h2>Loja</h2>
          <nav className="loja-store-footer-links" aria-label="Atalhos da loja">
            <Link to={link()}><Home size={15} /> Início</Link>
            <Link to={link('busca')}><Search size={15} /> Buscar produtos</Link>
            <Link to={link('carrinho')}><ShoppingBag size={15} /> Carrinho</Link>
            <Link to={link('conta')}><User size={15} /> Minha conta</Link>
          </nav>
        </div>

        <div className="loja-store-footer-col">
          <h2>Informações</h2>
          <nav className="loja-store-footer-links" aria-label="Informações da loja">
            <Link to={link('legal/privacidade')}>Privacidade</Link>
            <Link to={link('legal/termos')}>Termos de uso</Link>
            <Link to={link('legal/trocas')}>Trocas e devoluções</Link>
            <Link to={link('legal/entrega')}>Política de entrega</Link>
          </nav>
        </div>
      </div>

      <div className="loja-store-footer-bottom">
        <span>© {new Date().getFullYear()} {titulo}. Todos os direitos reservados.</span>
        <a href={getMainAppUrl('/')} target="_blank" rel="noopener noreferrer">
          Feito com Agiliza PDV
        </a>
      </div>
    </footer>
  )
}
