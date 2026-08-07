export const FORMA_PAGAMENTO_LABELS: Record<string, string> = {
  DINHEIRO: 'Dinheiro',
  DEBITO: 'Cartão débito',
  CREDITO: 'Cartão crédito',
  PIX: 'PIX',
  A_PRAZO: 'A prazo',
  CASHBACK: 'Cashback',
  OUTROS: 'Outros',
  LOJA_ONLINE: 'Loja online',
}

export function labelFormaPagamento(forma: string): string {
  const key = forma.trim().toUpperCase()
  return FORMA_PAGAMENTO_LABELS[key] ?? forma
}
