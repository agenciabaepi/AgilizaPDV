import { useCallback, useEffect, useId, useMemo, useState } from 'react'
import { initMercadoPago, Payment } from '@mercadopago/sdk-react'

type Props = {
  publicKey: string
  amount: number
  email: string
  payerName?: string
  processing?: boolean
  onSubmit: (formData: Record<string, unknown>) => Promise<void>
  onError?: (message: string) => void
}

let mpInitializedKey: string | null = null

export function LojaOnlineMercadoPagoBrick({
  publicKey,
  amount,
  email,
  payerName,
  processing,
  onSubmit,
  onError,
}: Props) {
  const reactId = useId()
  const containerId = useMemo(() => `mp-brick-${reactId.replace(/:/g, '')}`, [reactId])
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!publicKey) return
    if (mpInitializedKey !== publicKey) {
      initMercadoPago(publicKey, { locale: 'pt-BR' })
      mpInitializedKey = publicKey
    }
    setReady(true)
  }, [publicKey])

  const payer = useMemo(() => {
    const [firstName, ...rest] = (payerName ?? '').trim().split(/\s+/)
    const lastName = rest.join(' ')
    return {
      email,
      ...(firstName ? { firstName, lastName: lastName || firstName } : {}),
    }
  }, [email, payerName])

  const initialization = useMemo(
    () => ({
      amount: Number(amount.toFixed(2)),
      payer,
    }),
    [amount, payer]
  )

  const customization = useMemo(
    () => ({
      paymentMethods: {
        creditCard: 'all' as const,
        debitCard: 'all' as const,
        ticket: 'all' as const,
        bankTransfer: 'all' as const,
      },
    }),
    []
  )

  const handleSubmit = useCallback(
    async ({ formData }: { formData: Record<string, unknown> }) => {
      try {
        await onSubmit(formData)
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erro ao processar pagamento.'
        onError?.(msg)
      }
    },
    [onSubmit, onError]
  )

  const handleError = useCallback(
    (error: unknown) => {
      const msg =
        typeof error === 'object' && error && 'message' in error
          ? String((error as { message?: string }).message)
          : 'Erro no formulário do Mercado Pago.'
      onError?.(msg)
    },
    [onError]
  )

  if (!ready || amount <= 0) return null

  const isTest = publicKey.startsWith('TEST-')

  return (
    <div className="loja-store-mp-brick" aria-busy={processing}>
      {isTest && (
        <p className="loja-store-mp-test-hint">
          Modo teste: use cartões de teste do Mercado Pago com o mesmo par de credenciais (Public Key + Access Token de teste).
        </p>
      )}
      <Payment
        id={containerId}
        initialization={initialization}
        customization={customization}
        onSubmit={handleSubmit}
        onError={handleError}
      />
    </div>
  )
}
