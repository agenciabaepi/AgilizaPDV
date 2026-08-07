import type { VercelRequest, VercelResponse } from '@vercel/node'

/** E-mail transacional simples via Resend (opcional — configure RESEND_API_KEY e LOJA_ONLINE_EMAIL_FROM). */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Método não permitido' })
    return
  }

  const apiKey = process.env.RESEND_API_KEY?.trim()
  const from = process.env.LOJA_ONLINE_EMAIL_FROM?.trim()
  if (!apiKey || !from) {
    res.status(200).json({ ok: true, skipped: true })
    return
  }

  const { to, subject, html } = req.body as { to?: string; subject?: string; html?: string }
  if (!to?.trim() || !subject?.trim() || !html?.trim()) {
    res.status(400).json({ ok: false, error: 'Dados inválidos' })
    return
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [to.trim()],
      subject: subject.trim(),
      html: html.trim(),
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    res.status(502).json({ ok: false, error: err || 'Falha ao enviar e-mail' })
    return
  }

  res.status(200).json({ ok: true })
}
