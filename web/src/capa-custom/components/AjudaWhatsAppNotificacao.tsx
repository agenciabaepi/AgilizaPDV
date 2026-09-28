import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { WhatsAppIcon } from '../../components/loja-online/LojaOnlineWhatsAppFloat';
import { formatWhatsAppLink } from '../../lib/loja-online';

const INTERVALO_MS = 60_000;
const VISIVEL_MS = 12_000;

export function AjudaWhatsAppNotificacao({
  telefone,
  lojaNome,
  pausado,
}: {
  telefone: string | null | undefined;
  lojaNome: string;
  /** Enquanto um modal (modelo, finalizar) estiver aberto, não aparece. */
  pausado: boolean;
}) {
  const [devida, setDevida] = useState(false);
  const [aberta, setAberta] = useState(false);
  const [contatou, setContatou] = useState(false);
  const [ciclo, setCiclo] = useState(0);

  const href = telefone
    ? formatWhatsAppLink(
        telefone,
        `Vim do site ${lojaNome} e quero uma ajuda pra montar a arte pra minha capinha personalizada.`,
      )
    : '';

  useEffect(() => {
    if (!href || contatou) return;
    const t = window.setTimeout(() => setDevida(true), INTERVALO_MS);
    return () => window.clearTimeout(t);
  }, [href, contatou, ciclo]);

  useEffect(() => {
    if (devida && !pausado && !aberta) {
      setDevida(false);
      setAberta(true);
    }
  }, [devida, pausado, aberta]);

  useEffect(() => {
    if (!aberta) return;
    const t = window.setTimeout(() => fechar(), VISIVEL_MS);
    return () => window.clearTimeout(t);
  }, [aberta]);

  function fechar() {
    setAberta(false);
    setCiclo((c) => c + 1);
  }

  if (!href || !aberta || contatou) return null;

  return (
    <div className="cc-wa-notif" role="alert">
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="cc-wa-notif-link"
        onClick={() => {
          setAberta(false);
          setContatou(true);
        }}
      >
        <span className="cc-wa-notif-avatar">
          <WhatsAppIcon size={22} />
        </span>
        <span className="cc-wa-notif-body">
          <span className="cc-wa-notif-top">
            <strong>{lojaNome}</strong>
            <span className="cc-wa-notif-time">agora</span>
          </span>
          <span className="cc-wa-notif-title">Dificuldade em criar sua capa?</span>
          <span className="cc-wa-notif-text">
            Nós fazemos pra você! Clique aqui e chame nossa equipe no WhatsApp.
          </span>
        </span>
      </a>
      <button type="button" className="cc-wa-notif-close" onClick={fechar} aria-label="Fechar aviso">
        <X size={16} />
      </button>
    </div>
  );
}
