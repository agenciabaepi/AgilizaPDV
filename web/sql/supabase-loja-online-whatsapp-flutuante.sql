-- Botão flutuante de WhatsApp na loja online
ALTER TABLE public.empresas_config
  ADD COLUMN IF NOT EXISTS loja_online_whatsapp_flutuante INTEGER DEFAULT 0;

ALTER TABLE public.empresas_config
  ADD COLUMN IF NOT EXISTS loja_online_whatsapp_flutuante_msg TEXT;

COMMENT ON COLUMN public.empresas_config.loja_online_whatsapp_flutuante IS
  '1 = exibe botão flutuante de WhatsApp na loja online';

COMMENT ON COLUMN public.empresas_config.loja_online_whatsapp_flutuante_msg IS
  'Mensagem inicial ao abrir o WhatsApp pelo botão flutuante';
