import { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  BarChart3,
  CheckCircle2,
  Download,
  Gauge,
  MonitorSmartphone,
  Receipt,
  ShieldCheck,
  Store,
  Users,
  Zap,
} from 'lucide-react'
import logoAgiliza from '../../SVG/logo.svg'

const RELEASES_URL = 'https://github.com/agenciabaepi/AgilizaPDV/releases/latest'

const HERO_TITLE_PHRASES = [
  'Transforme sua loja com um PDV moderno, rápido e confiável',
  'NFC-e e NF-e integradas: menos papel, mais agilidade',
  'Caixa, estoque e clientes conectados em tempo real',
  'Um sistema pensado para o dia a dia do varejo',
]

const TITLE_TYPE_MS = 42
const TITLE_DELETE_MS = 26
const TITLE_PAUSE_END_MS = 2400
const TITLE_PAUSE_BETWEEN_MS = 500

function delay(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

/** Banner do hero: renderer/public/bginstaller.jpg */
function landingHeroBannerUrl(): string {
  if (typeof window === 'undefined') return ''
  return new URL('bginstaller.jpg', window.location.href).href
}

const NAV_SOLID_AFTER_PX = 16

export function LandingPage() {
  const heroBanner = landingHeroBannerUrl()
  const [navSolid, setNavSolid] = useState(false)
  const [heroPhraseIndex, setHeroPhraseIndex] = useState(0)
  const [heroVisibleCount, setHeroVisibleCount] = useState(0)
  const titleReduceMotion = useMemo(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  )

  const heroPhrase = HERO_TITLE_PHRASES[titleReduceMotion ? 0 : heroPhraseIndex]
  const heroVisibleLen = titleReduceMotion ? heroPhrase.length : heroVisibleCount

  useEffect(() => {
    document.documentElement.classList.add('landing-route')
    return () => {
      document.documentElement.classList.remove('landing-route')
    }
  }, [])

  useEffect(() => {
    const readScroll = () => {
      const root = document.getElementById('root')
      const y = Math.max(
        window.scrollY,
        document.documentElement.scrollTop,
        document.body.scrollTop,
        root?.scrollTop ?? 0,
      )
      setNavSolid(y > NAV_SOLID_AFTER_PX)
    }

    readScroll()
    window.addEventListener('scroll', readScroll, { passive: true })
    const root = document.getElementById('root')
    root?.addEventListener('scroll', readScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', readScroll)
      root?.removeEventListener('scroll', readScroll)
    }
  }, [])

  useEffect(() => {
    if (titleReduceMotion) return

    let cancelled = false

    void (async () => {
      let phraseIx = 0
      while (!cancelled) {
        const text = HERO_TITLE_PHRASES[phraseIx]
        for (let i = 1; i <= text.length && !cancelled; i += 1) {
          setHeroPhraseIndex(phraseIx)
          setHeroVisibleCount(i)
          await delay(TITLE_TYPE_MS)
        }
        if (cancelled) return
        await delay(TITLE_PAUSE_END_MS)
        for (let i = text.length - 1; i >= 0 && !cancelled; i -= 1) {
          setHeroPhraseIndex(phraseIx)
          setHeroVisibleCount(i)
          await delay(TITLE_DELETE_MS)
        }
        if (cancelled) return
        await delay(TITLE_PAUSE_BETWEEN_MS)
        phraseIx = (phraseIx + 1) % HERO_TITLE_PHRASES.length
      }
    })()

    return () => {
      cancelled = true
    }
  }, [titleReduceMotion])

  return (
    <div className="landing-page">
      <header
        className={`landing-section landing-section--nav${navSolid ? ' landing-section--nav--solid' : ''}`}
      >
        <div className="landing-inner landing-nav">
          <Link to="/" className="landing-nav-brand" aria-label="Agiliza PDV — início">
            <img src={logoAgiliza} alt="" className="landing-logo" />
          </Link>
          <Link to="/login" className="btn btn--outline btn--md landing-nav-cta">
            <span className="landing-nav-cta-short">Entrar</span>
            <span className="landing-nav-cta-full">Entrar no sistema</span>
          </Link>
        </div>
      </header>

      <section
        className={`landing-section landing-section--hero${heroBanner ? ' landing-section--hero--banner' : ''}`}
        style={
          heroBanner
            ? ({
                '--landing-hero-banner': `url(${JSON.stringify(heroBanner)})`,
              } as React.CSSProperties)
            : undefined
        }
      >
        <div className="landing-inner landing-hero-inner">
          <div className="landing-hero-copy">
            <span className="landing-eyebrow">Solução completa para varejo</span>
            <h1 className="landing-title" aria-label={HERO_TITLE_PHRASES.join('. ')}>
              <span className="landing-title-chars" aria-hidden="true">
                {heroPhrase.split('').map((ch, i) => (
                  <span
                    key={`${heroPhraseIndex}-${i}`}
                    className="landing-title-char"
                    style={{ opacity: i < heroVisibleLen ? 1 : 0 }}
                  >
                    {ch}
                  </span>
                ))}
                {!titleReduceMotion ? <span className="landing-title-cursor" aria-hidden="true" /> : null}
              </span>
            </h1>
            <p className="landing-subtitle">
              O Agiliza PDV reúne vendas, estoque, clientes, financeiro e emissão fiscal em uma única
              plataforma. Mais controle para o gestor e mais velocidade para o time no balcão.
            </p>
            <div className="landing-hero-actions">
              <a href={RELEASES_URL} target="_blank" rel="noreferrer" className="btn btn--primary btn--lg">
                <Download size={22} />
                Baixar versão mais recente
              </a>
              <Link to="/login" className="btn btn--secondary btn--lg">
                Acessar painel
              </Link>
            </div>
            <ul className="landing-metrics" aria-label="Destaques">
              <li>
                <strong>PDV ágil</strong>
                <span>Atendimento rápido e fluido no caixa</span>
              </li>
              <li>
                <strong>Fiscal integrado</strong>
                <span>NFC-e e NF-e no mesmo ambiente</span>
              </li>
              <li>
                <strong>Gestão unificada</strong>
                <span>Operação e indicadores em tempo real</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section className="landing-section landing-section--features">
        <div className="landing-inner">
          <header className="landing-section-head">
            <span className="landing-eyebrow">Por que Agiliza</span>
            <h2 className="landing-section-title">Tudo o que a loja precisa, sem complicar o dia a dia</h2>
            <p className="landing-section-lead">
              Menos telas, menos retrabalho — foco em velocidade no caixa e clareza na gestão.
            </p>
          </header>
          <div className="landing-features">
            <article className="landing-feature">
              <div className="landing-feature-icon">
                <Zap size={22} strokeWidth={1.75} />
              </div>
              <h3>Venda com agilidade</h3>
              <p>
                PDV otimizado para operação rápida com atalhos, leitura de código de barras e fechamento
                prático.
              </p>
            </article>
            <article className="landing-feature">
              <div className="landing-feature-icon">
                <Store size={22} strokeWidth={1.75} />
              </div>
              <h3>Gestão da loja</h3>
              <p>
                Controle de produtos, clientes, fornecedores, fluxo de caixa e relatórios para decisão diária.
              </p>
            </article>
            <article className="landing-feature">
              <div className="landing-feature-icon">
                <ShieldCheck size={22} strokeWidth={1.75} />
              </div>
              <h3>Fiscal e segurança</h3>
              <p>
                Recursos de NFC-e/NF-e e sincronização com foco em estabilidade para operação comercial real.
              </p>
            </article>
          </div>
        </div>
      </section>

      <section className="landing-section landing-section--modules">
        <div className="landing-inner">
          <header className="landing-section-head landing-section-head--center">
            <span className="landing-eyebrow">Módulos</span>
            <h2 className="landing-section-title">Prontos para o dia a dia da loja</h2>
          </header>
          <div className="landing-modules-grid">
            <span className="landing-module-chip">
              <Receipt size={18} strokeWidth={1.75} />
              Vendas e caixa
            </span>
            <span className="landing-module-chip">
              <BarChart3 size={18} strokeWidth={1.75} />
              Financeiro e fluxo
            </span>
            <span className="landing-module-chip">
              <Users size={18} strokeWidth={1.75} />
              Clientes e usuários
            </span>
            <span className="landing-module-chip">
              <Gauge size={18} strokeWidth={1.75} />
              Estoque e produtos
            </span>
            <span className="landing-module-chip">
              <Store size={18} strokeWidth={1.75} />
              NFC-e e NF-e
            </span>
            <span className="landing-module-chip">
              <CheckCircle2 size={18} strokeWidth={1.75} />
              Relatórios operacionais
            </span>
          </div>
        </div>
      </section>

      <section className="landing-section landing-section--cta">
        <div className="landing-inner landing-cta-row">
          <div className="landing-cta-copy">
            <h2 className="landing-section-title landing-section-title--on-dark">Comece com a versão mais recente</h2>
            <p>
              Instale o Agiliza PDV e mantenha sua operação atualizada com melhorias contínuas do sistema.
            </p>
          </div>
          <div className="landing-cta-actions">
            <a href={RELEASES_URL} target="_blank" rel="noreferrer" className="btn btn--md landing-cta-btn">
              <MonitorSmartphone size={18} />
              Download atualizado
            </a>
            <span className="landing-cta-note">Windows (.exe) via GitHub Releases</span>
          </div>
        </div>
      </section>

      <section className="landing-section landing-section--faq">
        <div className="landing-inner">
          <header className="landing-section-head landing-section-head--center">
            <span className="landing-eyebrow">FAQ</span>
            <h2 className="landing-section-title">Perguntas frequentes</h2>
          </header>
          <div className="landing-faq-list">
            <article className="landing-faq-item">
              <h3>Posso testar antes de colocar em produção?</h3>
              <p>Sim. Você pode iniciar com instalação em ambiente de teste e validar fluxo de vendas da sua loja.</p>
            </article>
            <article className="landing-faq-item">
              <h3>Como faço para manter atualizado?</h3>
              <p>Basta baixar a versão mais recente na seção de download ou no histórico de releases.</p>
            </article>
            <article className="landing-faq-item">
              <h3>Funciona para operação com múltiplos terminais?</h3>
              <p>Sim. O modo servidor e terminal permite operação compartilhada para equipes maiores.</p>
            </article>
          </div>
        </div>
      </section>

      <footer className="landing-section landing-section--footer">
        <div className="landing-inner landing-footer-inner">
          <span className="landing-footer-brand">Agiliza PDV</span>
          <Link to="/login" className="landing-footer-link">
            Acessar sistema
          </Link>
        </div>
      </footer>
    </div>
  )
}
