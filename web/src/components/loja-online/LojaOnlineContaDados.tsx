import { useEffect, useRef, useState } from 'react'
import { buscarCep } from '../../lib/cep'
import { formatCPF, formatPhone, isValidCPF, isValidPhone, onlyDigits } from '../../lib/validators'
import { useLojaOnlineClienteAuth } from '../../hooks/useLojaOnlineClienteAuth'

function maskCep(v: string): string {
  const d = onlyDigits(v).slice(0, 8)
  if (d.length <= 5) return d
  return `${d.slice(0, 5)}-${d.slice(5)}`
}

function formatEnderecoFromCep(data: {
  logradouro: string
  bairro: string
  localidade: string
  uf: string
  complemento: string
}): string {
  const linha = [data.logradouro, data.bairro, data.localidade, data.uf].filter(Boolean).join(', ')
  if (data.complemento && linha) return `${linha} — ${data.complemento}`
  return linha
}

export function LojaOnlineContaDados() {
  const { cliente, updateProfile } = useLojaOnlineClienteAuth()
  const [nome, setNome] = useState(cliente?.nome ?? '')
  const [email, setEmail] = useState(cliente?.email ?? '')
  const [cpf, setCpf] = useState(cliente?.cpf_cnpj ? formatCPF(cliente.cpf_cnpj) : '')
  const [whatsapp, setWhatsapp] = useState(cliente?.telefone ? formatPhone(cliente.telefone) : '')
  const [cep, setCep] = useState(cliente?.cep ? maskCep(cliente.cep) : '')
  const [endereco, setEndereco] = useState(cliente?.endereco ?? '')
  const [senhaAtual, setSenhaAtual] = useState('')
  const [senhaNova, setSenhaNova] = useState('')
  const [senhaConfirm, setSenhaConfirm] = useState('')
  const [cepLoading, setCepLoading] = useState(false)
  const [cepErro, setCepErro] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const ultimoCepBuscadoRef = useRef(onlyDigits(cliente?.cep ?? ''))

  useEffect(() => {
    const digits = onlyDigits(cep)
    if (digits.length !== 8) {
      setCepErro(null)
      setCepLoading(false)
      return
    }
    if (digits === ultimoCepBuscadoRef.current) return

    const timer = window.setTimeout(() => {
      void (async () => {
        setCepLoading(true)
        setCepErro(null)
        try {
          const data = await buscarCep(digits)
          ultimoCepBuscadoRef.current = digits
          if (!data) {
            setCepErro('CEP não encontrado. Confira o número e tente de novo.')
            return
          }
          const linha = formatEnderecoFromCep(data)
          if (linha) setEndereco(linha)
        } catch {
          setCepErro('Não foi possível consultar o CEP. Tente de novo.')
        } finally {
          setCepLoading(false)
        }
      })()
    }, 350)

    return () => window.clearTimeout(timer)
  }, [cep])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (onlyDigits(cpf).length !== 11 || !isValidCPF(cpf)) {
      setError('Informe um CPF válido.')
      return
    }
    if (!onlyDigits(whatsapp) || !isValidPhone(whatsapp)) {
      setError('Informe um WhatsApp válido com DDD.')
      return
    }
    if (senhaNova || senhaConfirm || senhaAtual) {
      if (!senhaAtual) {
        setError('Informe a senha atual para definir uma nova.')
        return
      }
      if (senhaNova.length < 6) {
        setError('A nova senha deve ter pelo menos 6 caracteres.')
        return
      }
      if (senhaNova !== senhaConfirm) {
        setError('A confirmação da senha não coincide.')
        return
      }
    }

    setLoading(true)
    try {
      await updateProfile({
        nome,
        email,
        telefone: formatPhone(whatsapp),
        endereco,
        cpf_cnpj: cpf,
        cep,
        senhaAtual: senhaNova ? senhaAtual : undefined,
        senhaNova: senhaNova || undefined,
      })
      setSenhaAtual('')
      setSenhaNova('')
      setSenhaConfirm('')
      setSuccess('Dados atualizados.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar os dados.')
    } finally {
      setLoading(false)
    }
  }

  if (!cliente) return null

  return (
    <form onSubmit={handleSubmit} className="loja-store-conta-dados">
      <div>
        <h2>Dados do cadastro</h2>
        <p>Nome, contato e endereço usados nos seus pedidos.</p>
      </div>

      <label className="input-wrap">
        <span className="input-label">Nome completo</span>
        <input className="input-el" value={nome} onChange={(e) => setNome(e.target.value)} required autoComplete="name" />
      </label>

      <div className="loja-store-conta-dados-grid">
        <label className="input-wrap">
          <span className="input-label">CPF</span>
          <input
            className="input-el"
            inputMode="numeric"
            autoComplete="off"
            value={formatCPF(cpf)}
            onChange={(e) => setCpf(e.target.value)}
            required
          />
        </label>
        <label className="input-wrap">
          <span className="input-label">E-mail</span>
          <input
            className="input-el"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </label>
        <label className="input-wrap">
          <span className="input-label">WhatsApp</span>
          <input
            className="input-el"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="(11) 99999-9999"
            value={whatsapp}
            onChange={(e) => setWhatsapp(formatPhone(e.target.value))}
            required
          />
        </label>
        <label className="input-wrap">
          <span className="input-label">CEP</span>
          <input
            className="input-el"
            inputMode="numeric"
            autoComplete="postal-code"
            placeholder="00000-000"
            value={maskCep(cep)}
            onChange={(e) => {
              const next = e.target.value
              setCep(next)
              if (onlyDigits(next).length < 8) {
                ultimoCepBuscadoRef.current = ''
                setCepErro(null)
              }
            }}
          />
          {cepLoading ? <span className="loja-online-hint">Buscando endereço…</span> : null}
          {cepErro ? <span className="loja-online-field-error">{cepErro}</span> : null}
        </label>
      </div>

      <label className="input-wrap">
        <span className="input-label">Endereço</span>
        <textarea
          className="input-el loja-online-textarea"
          rows={2}
          value={endereco}
          placeholder="Rua, número, bairro, cidade"
          autoComplete="street-address"
          onChange={(e) => setEndereco(e.target.value)}
        />
      </label>

      <fieldset className="loja-store-conta-dados-senha">
        <legend>Trocar senha</legend>
        <p>Preencha só se quiser alterar a senha de acesso.</p>
        <label className="input-wrap">
          <span className="input-label">Senha atual</span>
          <input
            className="input-el"
            type="password"
            value={senhaAtual}
            onChange={(e) => setSenhaAtual(e.target.value)}
            autoComplete="current-password"
          />
        </label>
        <div className="loja-store-conta-dados-grid">
          <label className="input-wrap">
            <span className="input-label">Nova senha</span>
            <input
              className="input-el"
              type="password"
              value={senhaNova}
              onChange={(e) => setSenhaNova(e.target.value)}
              autoComplete="new-password"
            />
          </label>
          <label className="input-wrap">
            <span className="input-label">Confirmar nova senha</span>
            <input
              className="input-el"
              type="password"
              value={senhaConfirm}
              onChange={(e) => setSenhaConfirm(e.target.value)}
              autoComplete="new-password"
            />
          </label>
        </div>
      </fieldset>

      {error ? <p className="loja-online-field-error">{error}</p> : null}
      {success ? <p className="loja-store-conta-dados-ok">{success}</p> : null}

      <button type="submit" className="loja-store-btn-primary" disabled={loading}>
        {loading ? 'Salvando…' : 'Salvar dados'}
      </button>
    </form>
  )
}
