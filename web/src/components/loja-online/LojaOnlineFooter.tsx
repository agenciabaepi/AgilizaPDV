import { Instagram, Facebook, Mail, MapPin, Phone } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useLojaOnlineStore } from '../../hooks/useLojaOnlineStore'
import { getMainAppUrl } from '../../lib/loja-online'

export function LojaOnlineFooter() {
  const { store, titulo, link } = useLojaOnlineStore()
  if (!store) return null

  const rodape = store.loja_online_rodape_texto?.trim()

  return (
    <footer className="loja-store-footer">
      <div className="loja-store-footer-inner">
        <div className="loja-store-footer-col">
          <strong>{titulo}</strong>
          {rodape && <p>{rodape}</p>}
          {store.loja_online_descricao && !rodape && (
            <p>{store.loja_online_descricao}</p>
          )}
        </div>

        <div className="loja-store-footer-col">
          <strong>Contato</strong>
          {store.endereco && (
            <p><MapPin size={14} /> {store.endereco}</p>
          )}
          {store.telefone && (
            <p><Phone size={14} /> {store.telefone}</p>
          )}
          {store.loja_online_email_contato && (
            <p>
              <Mail size={14} />{' '}
              <a href={`mailto:${store.loja_online_email_contato}`}>{store.loja_online_email_contato}</a>
            </p>
          )}
        </div>

        <div className="loja-store-footer-col">
          <strong>Redes</strong>
          <div className="loja-store-footer-social">
            {store.loja_online_instagram && (
              <a href={store.loja_online_instagram} target="_blank" rel="noopener noreferrer">
                <Instagram size={18} /> Instagram
              </a>
            )}
            {store.loja_online_facebook && (
              <a href={store.loja_online_facebook} target="_blank" rel="noopener noreferrer">
                <Facebook size={18} /> Facebook
              </a>
            )}
          </div>
        </div>

        <div className="loja-store-footer-col loja-store-footer-legal">
          <strong>Informações</strong>
          <nav className="loja-store-footer-legal-links">
            <Link to={link('legal/privacidade')}>Privacidade</Link>
            <Link to={link('legal/termos')}>Termos de uso</Link>
            <Link to={link('legal/trocas')}>Trocas e devoluções</Link>
            <Link to={link('legal/entrega')}>Política de entrega</Link>
          </nav>
        </div>
      </div>
      <div className="loja-store-footer-bottom">
        <span>© {new Date().getFullYear()} {titulo}</span>
        <a href={getMainAppUrl('/')} target="_blank" rel="noopener noreferrer">
          Powered by Agiliza PDV
        </a>
      </div>
    </footer>
  )
}
