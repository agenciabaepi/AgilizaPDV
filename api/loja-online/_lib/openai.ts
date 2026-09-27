import type { SupabaseClient } from '@supabase/supabase-js'

export const OPENAI_DEFAULT_MODEL = 'gpt-5-mini'

export type OpenAiMessage = { role: 'system' | 'user' | 'assistant'; content: string }

export type IaConfig = { apiKey: string | null; model: string }

export async function loadIaConfig(supabase: SupabaseClient, empresaId: string): Promise<IaConfig> {
  const { data, error } = await supabase
    .from('loja_online_ia_config')
    .select('openai_api_key, openai_model')
    .eq('empresa_id', empresaId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return {
    apiKey: (data?.openai_api_key as string | null) ?? null,
    model: (data?.openai_model as string | null) || OPENAI_DEFAULT_MODEL,
  }
}

export function maskApiKey(key: string | null): string | null {
  if (!key) return null
  return key.length <= 10 ? '••••' : `${key.slice(0, 5)}…${key.slice(-4)}`
}

function isReasoningModel(model: string): boolean {
  return /^(o\d|gpt-5)/i.test(model)
}

function openAiErrorMessage(status: number, body: string): string {
  let msg = ''
  try {
    msg = (JSON.parse(body) as { error?: { message?: string } }).error?.message ?? ''
  } catch {
    /* corpo não-JSON */
  }
  if (status === 401) return 'Chave da OpenAI inválida ou revogada.'
  if (status === 429) return msg.includes('quota') ? 'Sua conta OpenAI está sem créditos (quota excedida).' : 'Limite de requisições da OpenAI atingido. Tente em instantes.'
  if (status === 404) return `Modelo não disponível para esta chave. ${msg}`.trim()
  return msg || `Erro da OpenAI (HTTP ${status}).`
}

export async function validateOpenAiKey(apiKey: string): Promise<void> {
  const res = await fetch('https://api.openai.com/v1/models', {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) throw new Error(openAiErrorMessage(res.status, await res.text()))
}

export async function openAiChat(input: {
  apiKey: string
  model: string
  messages: OpenAiMessage[]
  json?: boolean
  maxTokens?: number
  timeoutMs?: number
}): Promise<{ content: string; tokensIn: number | null; tokensOut: number | null }> {
  const body: Record<string, unknown> = {
    model: input.model,
    messages: input.messages,
    max_completion_tokens: input.maxTokens ?? 12_000,
  }
  if (input.json) body.response_format = { type: 'json_object' }
  if (isReasoningModel(input.model)) body.reasoning_effort = 'low'
  else body.temperature = 0.4

  let res: Response
  try {
    res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${input.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(input.timeoutMs ?? 55_000),
    })
  } catch (err) {
    if (err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError')) {
      throw new Error('A IA demorou demais para responder. Tente um período menor ou um modelo mais rápido.')
    }
    throw err
  }

  const text = await res.text()
  if (!res.ok) throw new Error(openAiErrorMessage(res.status, text))

  const data = JSON.parse(text) as {
    choices?: { message?: { content?: string | null }; finish_reason?: string }[]
    usage?: { prompt_tokens?: number; completion_tokens?: number }
  }
  const choice = data.choices?.[0]
  const content = choice?.message?.content ?? ''
  if (!content.trim()) {
    throw new Error(
      choice?.finish_reason === 'length'
        ? 'A resposta da IA excedeu o limite de tokens. Tente novamente.'
        : 'A IA retornou uma resposta vazia.'
    )
  }
  return {
    content,
    tokensIn: data.usage?.prompt_tokens ?? null,
    tokensOut: data.usage?.completion_tokens ?? null,
  }
}
