import { useParams } from 'react-router-dom'
import { useLojaOnlineStore } from '../../hooks/useLojaOnlineStore'
import { useLojaOnlineSeo } from '../../hooks/useLojaOnlineSeo'
import { getLojaOnlineCanonicalUrl } from '../../lib/loja-online-seo'

const TITLES: Record<string, string> = {
  privacidade: 'Política de privacidade',
  termos: 'Termos de uso',
  trocas: 'Trocas e devoluções',
  entrega: 'Política de entrega',
}

const FIELD_MAP = {
  privacidade: 'loja_online_politica_privacidade',
  termos: 'loja_online_termos_uso',
  trocas: 'loja_online_politica_trocas',
  entrega: 'loja_online_politica_entrega',
} as const

type LegalSlug = keyof typeof FIELD_MAP

export function LojaOnlineLegalPage() {
  const { legalSlug } = useParams<{ legalSlug: string }>()
  const { store, titulo, slug, link } = useLojaOnlineStore()
  const key = legalSlug as LegalSlug
  const field = FIELD_MAP[key]
  const pageTitle = TITLES[key] ?? 'Informações'
  const content = field && store ? (store[field] as string | null | undefined)?.trim() : ''

  useLojaOnlineSeo(
    store
      ? {
          title: `${pageTitle} | ${titulo}`,
          description: `${pageTitle} — ${titulo}`,
          url: getLojaOnlineCanonicalUrl(slug, link(`legal/${legalSlug}`), store.loja_online_dominio_custom),
        }
      : null
  )

  if (!field || !TITLES[key]) {
    return (
      <div className="loja-store-page">
        <p className="loja-catalogo-empty">Página não encontrada.</p>
      </div>
    )
  }

  return (
    <div className="loja-store-page loja-store-legal">
      <h1>{pageTitle}</h1>
      {content ? (
        <div className="loja-store-legal-body">{content}</div>
      ) : (
        <p className="loja-catalogo-empty">
          Esta loja ainda não publicou o conteúdo desta página. Entre em contato com o vendedor.
        </p>
      )}
    </div>
  )
}
