import { useCallback, useEffect, useMemo, useState } from 'react'
import { clearCheckoutPedidoId } from '../lib/loja-online-checkout-session'
import {
  consultarStatusPagamentoLojaOnline,
  retomarPagamentoLojaOnline,
} from '../lib/loja-online-pagamentos-api'
import type { LojaOnlinePedido } from '../lib/loja-online-types'
import { pedidoAguardandoPagamentoOnline } from '../lib/loja-online-types'
import { supabase } from '../lib/supabase'

function pedidoJaPago(pedido: LojaOnlinePedido): boolean {
  return pedido.pagamento_status === 'pago'
}

function deveVerificarPagamento(pedido: LojaOnlinePedido, pago: boolean, pix?: boolean | null): boolean {
  if (pago || pedidoJaPago(pedido)) return false
  if (pix) return true
  if (pedidoAguardandoPagamentoOnline(pedido)) return true
  const forma = pedido.forma_pagamento ?? 'manual'
  return (forma === 'asaas_pix' || forma === 'mercadopago') && pedido.pagamento_status !== 'na_entrega'
}

async function lerPagamentoNoBanco(pedidoId: string): Promise<boolean> {
  const { data } = await supabase
    .from('loja_online_pedidos')
    .select('pagamento_status')
    .eq('id', pedidoId)
    .maybeSingle()
  return data?.pagamento_status === 'pago'
}

/** Polling + realtime para confirmar pagamento PIX/cartão online. */
export function useLojaOnlineConfirmacaoPagamento(
  pedido: LojaOnlinePedido,
  slug: string,
  options?: { pix?: boolean | null; empresaId?: string }
) {
  const [pago, setPago] = useState(() => pedidoJaPago(pedido))
  const [verificando, setVerificando] = useState(false)

  const verificar = useMemo(
    () => deveVerificarPagamento(pedido, pago, options?.pix),
    [pedido, pago, options?.pix]
  )

  const marcarPago = useCallback(() => {
    setPago(true)
    if (options?.empresaId) clearCheckoutPedidoId(options.empresaId)
    window.dispatchEvent(new CustomEvent('agiliza:lojaOnlinePedidosUpdated'))
  }, [options?.empresaId])

  const checar = useCallback(async () => {
    if (!slug) return false
    try {
      if (await lerPagamentoNoBanco(pedido.id)) {
        marcarPago()
        return true
      }

      const status = await consultarStatusPagamentoLojaOnline(pedido.id, slug)
      if (status.status === 'pago' && (await lerPagamentoNoBanco(pedido.id))) {
        marcarPago()
        return true
      }

      const retomar = await retomarPagamentoLojaOnline(pedido.id, slug)
      if ('alreadyPaid' in retomar && retomar.alreadyPaid && (await lerPagamentoNoBanco(pedido.id))) {
        marcarPago()
        return true
      }
    } catch {
      /* próxima tentativa */
    }
    return false
  }, [pedido.id, slug, marcarPago])

  const verificarAgora = useCallback(async () => {
    setVerificando(true)
    try {
      await checar()
    } finally {
      setVerificando(false)
    }
  }, [checar])

  useEffect(() => {
    if (!verificar || !slug) return

    let ativo = true

    const poll = async () => {
      if (!ativo) return
      await checar()
    }

    void poll()
    const interval = window.setInterval(() => void poll(), options?.pix ? 2000 : 2500)

    const channel = supabase
      .channel(`loja-pedido-pagamento-${pedido.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'loja_online_pedidos',
          filter: `id=eq.${pedido.id}`,
        },
        (payload) => {
          const row = payload.new as { pagamento_status?: string | null }
          if (row.pagamento_status === 'pago') marcarPago()
        }
      )
      .subscribe()

    return () => {
      ativo = false
      window.clearInterval(interval)
      void supabase.removeChannel(channel)
    }
  }, [verificar, pedido.id, slug, options?.pix, checar, marcarPago])

  return { pago, verificando, verificarAgora }
}
