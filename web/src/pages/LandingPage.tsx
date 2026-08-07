import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  BarChart3,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Cloud,
  Gauge,
  Globe,
  ShieldCheck,
  Store,
  Users,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { LandingSectionLink, LandingSiteHeader } from '../components/landing/LandingSiteHeader'
import { LandingSiteFooter } from '../components/landing/LandingSiteFooter'
import { consumeLandingScroll, scrollToLandingSection } from '../lib/landing-scroll'
import heroVisual from '../imagens/hero.svg'
import promoIllustration from '../imagens/ilustracao1-transparent.png'
import video1 from '../videos/1.mp4'
import video2 from '../videos/2.mp4'
import { usePlanos } from '../hooks/usePlanos'

const HERO_TAG = 'VAREJO'
const HERO_TITLE = 'Sistema para loja que destaca seu negócio no varejo'
const HERO_SUBTITLE =
  'O essencial é centralizar sua operação e vender mais. Aqui você tem PDV web, gestão completa e loja online integrada.'

const LANDING_CAROUSEL_ITEMS: {
  icon: LucideIcon
  title: string
  description: string
}[] = [
  {
    icon: ClipboardList,
    title: 'Ordens de compra',
    description:
      'Simplifique a gestão de compras criando e enviando ordens diretamente aos fornecedores, garantindo previsibilidade no estoque.',
  },
  {
    icon: Users,
    title: 'Relação com clientes',
    description:
      'Acompanhe o histórico de compras e mantenha uma base organizada para um relacionamento pós-venda eficiente.',
  },
  {
    icon: BarChart3,
    title: 'Fluxo de caixa',
    description:
      'Contas a receber e a pagar atualizadas com as vendas do PDV, garantindo uma gestão financeira mais previsível.',
  },
  {
    icon: Store,
    title: 'PDV web',
    description:
      'Finalize vendas no navegador com rapidez, formas de pagamento variadas e controle de estoque em tempo real.',
  },
  {
    icon: Globe,
    title: 'Loja online',
    description:
      'Publique produtos, receba pedidos e integre vendas online com o estoque e o financeiro da sua loja física.',
  },
  {
    icon: ShieldCheck,
    title: 'Emissão fiscal',
    description:
      'Emita NFC-e e NF-e integradas às vendas, com menos retrabalho e mais segurança na operação comercial.',
  },
]

const LANDING_CAROUSEL_LOOP = [...LANDING_CAROUSEL_ITEMS, ...LANDING_CAROUSEL_ITEMS]

const LANDING_TESTIMONIALS = [
  {
    quote:
      'Antes eu fechava o caixa no fim do dia e ainda conferia planilha. Com o Agiliza, vendas e estoque ficam alinhados na hora — ganhei tempo e tranquilidade.',
    name: 'Marina',
    role: 'Proprietária da Casa Natura Boutique',
  },
  {
    quote:
      'A equipe aprendeu rápido porque é tudo no navegador. Hoje abrimos o PDV de manhã e já sabemos o que vendeu, o que falta repor e como está o caixa.',
    name: 'Rafael',
    role: 'Gerente da Rede Mercado do Bairro',
  },
] as const

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function LandingPage() {
  const { planosList } = usePlanos()
  const [carouselPaused, setCarouselPaused] = useState(false)
  const [carouselDirection, setCarouselDirection] = useState<'normal' | 'reverse'>('normal')
  const testimonialTrackRef = useRef<HTMLDivElement>(null)

  const scrollTestimonials = (direction: 'prev' | 'next') => {
    const track = testimonialTrackRef.current
    if (!track) return
    const card = track.querySelector<HTMLElement>('.landing-testimonial-item')
    const gap = 20
    const step = (card?.offsetWidth ?? 320) + gap
    track.scrollBy({ left: direction === 'next' ? step : -step, behavior: 'smooth' })
  }

  useEffect(() => {
    const target = consumeLandingScroll()
    if (!target) return
    const timer = window.setTimeout(() => {
      scrollToLandingSection(target)
    }, 80)
    return () => window.clearTimeout(timer)
  }, [])

  return (
    <div className="landing-page">
      <LandingSiteHeader onHero />

      <section className="landing-section landing-section--hero landing-section--hero--olist">
        <div className="landing-hero-split">
          <div className="landing-hero-copy">
            <span className="landing-hero-tag">{HERO_TAG}</span>
            <h1 className="landing-hero-title">{HERO_TITLE}</h1>
            <p className="landing-hero-subtitle">{HERO_SUBTITLE}</p>
            <div className="landing-hero-actions">
              <Link to="/cadastro" className="btn btn--lg landing-hero-btn landing-hero-btn--primary">
                teste grátis
              </Link>
              <LandingSectionLink sectionId="planos" className="landing-hero-link">
                conheça os planos →
              </LandingSectionLink>
            </div>
          </div>
          <div className="landing-hero-visual">
            <img
              src={heroVisual}
              alt="Lojista usando o Agiliza PDV no balcão com interface de finalização de venda"
              className="landing-hero-collage"
              width={574}
              height={653}
            />
          </div>
        </div>
        <div className="landing-hero-wave" aria-hidden="true" />
      </section>

      <section className="landing-section landing-section--carousel" aria-labelledby="landing-carousel-title">
        <div className="landing-carousel-inner">
          <div className="landing-carousel-head">
            <h2 className="landing-carousel-title" id="landing-carousel-title">
              Simplifique seu negócio com soluções integradas e facilite sua rotina
            </h2>
            <div className="landing-carousel-nav" aria-label="Controles do carrossel">
              <button
                type="button"
                className="landing-carousel-nav-btn"
                aria-label="Rolar para trás"
                onClick={() => {
                  setCarouselDirection('reverse')
                  setCarouselPaused(false)
                }}
              >
                <ChevronLeft size={22} strokeWidth={2} />
              </button>
              <button
                type="button"
                className="landing-carousel-nav-btn"
                aria-label="Rolar para frente"
                onClick={() => {
                  setCarouselDirection('normal')
                  setCarouselPaused(false)
                }}
              >
                <ChevronRight size={22} strokeWidth={2} />
              </button>
            </div>
          </div>

          <div
            className="landing-carousel-viewport"
            onMouseEnter={() => setCarouselPaused(true)}
            onMouseLeave={() => setCarouselPaused(false)}
          >
            <div
              className={`landing-carousel-track${carouselPaused ? ' landing-carousel-track--paused' : ''}`}
              style={{ animationDirection: carouselDirection }}
            >
              {LANDING_CAROUSEL_LOOP.map((item, index) => {
                const Icon = item.icon
                return (
                  <article
                    key={`${item.title}-${index}`}
                    className="landing-carousel-card"
                    aria-hidden={index >= LANDING_CAROUSEL_ITEMS.length}
                  >
                    <div className="landing-carousel-card-icon" aria-hidden="true">
                      <Icon size={22} strokeWidth={1.75} />
                    </div>
                    <h3 className="landing-carousel-card-title">{item.title}</h3>
                    <p className="landing-carousel-card-text">{item.description}</p>
                  </article>
                )
              })}
            </div>
          </div>

          <div className="landing-carousel-cta-wrap">
            <Link to="/cadastro" className="landing-carousel-cta">
              comece já
            </Link>
          </div>
        </div>
      </section>

      <section className="landing-section landing-section--promo" aria-labelledby="landing-promo-title">
        <div className="landing-promo-card">
          <div className="landing-promo-copy">
            <span className="landing-promo-eyebrow">Acesso de qualquer lugar</span>
            <p className="landing-promo-lead" id="landing-promo-title">
              Vendas, estoque, clientes e financeiro na palma da mão — do balcão, de casa ou onde você
              estiver.
            </p>
            <p className="landing-promo-highlight">Sua loja, online</p>
            <span className="landing-promo-note">100% web · sem instalar · atualizações automáticas</span>
          </div>
          <div className="landing-promo-visual">
            <img
              src={promoIllustration}
              alt=""
              className="landing-promo-illustration"
              width={1200}
              height={776}
              aria-hidden="true"
            />
          </div>
        </div>
      </section>

      <section className="landing-section landing-section--bridge">
        <div className="landing-inner">
          <h2 className="landing-bridge-title">
            Operação travada custa caro. Com o Agiliza, sua loja flui:
          </h2>
          <ul className="landing-bridge-metrics" aria-label="Destaques">
            <li>
              <strong>100% na nuvem</strong>
              <span>Funciona no navegador, em qualquer dispositivo</span>
            </li>
            <li>
              <strong>Sem instalação</strong>
              <span>Atualizações automáticas, sempre na versão mais recente</span>
            </li>
            <li>
              <strong>Planos flexíveis</strong>
              <span>Do PDV básico ao pacote com loja online</span>
            </li>
          </ul>
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
                <Cloud size={22} strokeWidth={1.75} />
              </div>
              <h3>Acesso web imediato</h3>
              <p>
                Entre com login e senha de qualquer computador ou tablet. Sem download, sem configuração
                de servidor local.
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
                Emissão de NFC-e e NF-e nos planos Pro e Ultra, com sincronização estável para operação
                comercial real.
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
              <Zap size={18} strokeWidth={1.75} />
              PDV e vendas
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
              <Globe size={18} strokeWidth={1.75} />
              Loja online
            </span>
            <span className="landing-module-chip">
              <CheckCircle2 size={18} strokeWidth={1.75} />
              Relatórios operacionais
            </span>
          </div>
        </div>
      </section>

      <section className="landing-section landing-section--testimonials" aria-labelledby="landing-testimonials-title">
        <div className="landing-testimonials-inner">
          <div className="landing-testimonials-head">
            <h2 className="landing-testimonials-title" id="landing-testimonials-title">
              Lojistas que simplificaram a operação com o Agiliza PDV.{' '}
              <span className="landing-testimonials-title-accent">Só falta você!</span>
            </h2>
            <div className="landing-testimonials-nav" aria-label="Navegar depoimentos">
              <button
                type="button"
                className="landing-testimonials-nav-btn"
                onClick={() => scrollTestimonials('prev')}
                aria-label="Depoimento anterior"
              >
                <ChevronLeft size={22} strokeWidth={2} />
              </button>
              <button
                type="button"
                className="landing-testimonials-nav-btn"
                onClick={() => scrollTestimonials('next')}
                aria-label="Próximo depoimento"
              >
                <ChevronRight size={22} strokeWidth={2} />
              </button>
            </div>
          </div>

          <div className="landing-testimonials-track-wrap">
            <div className="landing-testimonials-track" ref={testimonialTrackRef}>
              <div className="landing-testimonial-item landing-testimonial-item--video">
                <div className="landing-testimonial-video-ring">
                  <video
                    src={video1}
                    className="landing-testimonial-video"
                    autoPlay
                    muted
                    loop
                    playsInline
                    aria-label="Depoimento em vídeo de lojista"
                  />
                </div>
              </div>
              <article className="landing-testimonial-item landing-testimonial-item--quote">
                <blockquote className="landing-testimonial-quote">
                  &ldquo;{LANDING_TESTIMONIALS[0].quote}&rdquo;
                </blockquote>
                <footer className="landing-testimonial-author">
                  <strong>{LANDING_TESTIMONIALS[0].name}</strong>
                  <span>{LANDING_TESTIMONIALS[0].role}</span>
                </footer>
              </article>
              <div className="landing-testimonial-item landing-testimonial-item--video">
                <div className="landing-testimonial-video-ring">
                  <video
                    src={video2}
                    className="landing-testimonial-video"
                    autoPlay
                    muted
                    loop
                    playsInline
                    aria-label="Depoimento em vídeo de lojista"
                  />
                </div>
              </div>
              <article className="landing-testimonial-item landing-testimonial-item--quote">
                <blockquote className="landing-testimonial-quote">
                  &ldquo;{LANDING_TESTIMONIALS[1].quote}&rdquo;
                </blockquote>
                <footer className="landing-testimonial-author">
                  <strong>{LANDING_TESTIMONIALS[1].name}</strong>
                  <span>{LANDING_TESTIMONIALS[1].role}</span>
                </footer>
              </article>
            </div>
          </div>

          <div className="landing-testimonials-cta-wrap">
            <Link to="/cadastro" className="landing-testimonials-cta">
              Alavanque suas vendas
            </Link>
          </div>
        </div>
      </section>

      <section id="planos" className="landing-section landing-section--planos">
        <div className="landing-inner">
          <header className="landing-section-head landing-section-head--center">
            <span className="landing-eyebrow">Planos</span>
            <h2 className="landing-section-title">Escolha o pacote ideal para sua loja</h2>
            <p className="landing-section-lead">
              Todos os planos incluem teste gratuito de 7 dias. Escale quando precisar de emissão fiscal ou
              loja virtual.
            </p>
          </header>
          <div className="landing-planos-grid">
            {planosList.map((plano) => (
              <article
                key={plano.id}
                className={`landing-plano-card${plano.destaque ? ' landing-plano-card--destaque' : ''}`}
              >
                {plano.destaque && <span className="landing-plano-card__badge">Popular</span>}
                <h3 className="landing-plano-card__nome">{plano.nome}</h3>
                <p className="landing-plano-card__valor">
                  {formatCurrency(plano.valor)}
                  <span>/mês</span>
                </p>
                <p className="landing-plano-card__desc">{plano.descricao}</p>
                <ul className="landing-plano-card__lista">
                  {plano.recursos.map((item) => (
                    <li key={item}>
                      <Check size={14} strokeWidth={2.5} />
                      {item}
                    </li>
                  ))}
                </ul>
                <Link to="/cadastro" className="btn btn--outline btn--md landing-plano-card__cta">
                  Começar com {plano.nome}
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-section landing-section--cta">
        <div className="landing-inner landing-cta-row">
          <div className="landing-cta-copy">
            <h2 className="landing-section-title landing-section-title--on-dark">Comece agora pelo navegador</h2>
            <p>
              Crie sua conta, explore o sistema por 7 dias sem compromisso e escolha o plano quando estiver
              pronto para produção.
            </p>
          </div>
          <div className="landing-cta-actions">
            <Link to="/cadastro" className="btn btn--md landing-cta-btn">
              <Globe size={18} />
              Criar conta grátis
            </Link>
            <span className="landing-cta-note">Sem download · Acesso imediato · Cancele quando quiser</span>
          </div>
        </div>
      </section>

      <section id="faq" className="landing-section landing-section--faq">
        <div className="landing-inner">
          <header className="landing-section-head landing-section-head--center">
            <span className="landing-eyebrow">FAQ</span>
            <h2 className="landing-section-title">Perguntas frequentes</h2>
          </header>
          <div className="landing-faq-list">
            <article className="landing-faq-item">
              <h3>Preciso instalar algum programa?</h3>
              <p>
                Não. O Agiliza PDV é 100% web — basta acessar pelo navegador com login e senha. Funciona em
                Windows, Mac e tablets compatíveis.
              </p>
            </article>
            <article className="landing-faq-item">
              <h3>Posso testar antes de assinar?</h3>
              <p>
                Sim. Ao criar a conta, você tem 7 dias de teste gratuito com acesso aos recursos do plano
                escolhido.
              </p>
            </article>
            <article className="landing-faq-item">
              <h3>Qual plano inclui notas fiscais?</h3>
              <p>
                A emissão de NFC-e e NF-e está disponível nos planos <strong>Pro</strong> e{' '}
                <strong>Ultra</strong>. O plano Basic cobre PDV, estoque, clientes e financeiro.
              </p>
            </article>
            <article className="landing-faq-item">
              <h3>E se eu precisar de loja online?</h3>
              <p>
                O plano <strong>Ultra</strong> inclui catálogo virtual e subdomínio personalizado, além de
                tudo do Pro.
              </p>
            </article>
            <article className="landing-faq-item">
              <h3>Vários usuários podem usar ao mesmo tempo?</h3>
              <p>
                Sim. Cadastre usuários da equipe e opere em paralelo — ideal para caixa, estoque e gestão
                no mesmo ambiente online.
              </p>
            </article>
          </div>
        </div>
      </section>

      <LandingSiteFooter />
    </div>
  )
}
