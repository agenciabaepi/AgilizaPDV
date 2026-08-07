/** Impressão no browser sem pop-up (iframe oculto). */
export function webPrintHtml(html: string): { ok: boolean; error?: string } {
  try {
    const iframe = document.createElement('iframe')
    iframe.setAttribute('aria-hidden', 'true')
    Object.assign(iframe.style, {
      position: 'fixed',
      right: '0',
      bottom: '0',
      width: '0',
      height: '0',
      border: 'none',
      visibility: 'hidden',
    })
    document.body.appendChild(iframe)

    const win = iframe.contentWindow
    const doc = iframe.contentDocument ?? win?.document
    if (!win || !doc) {
      iframe.remove()
      return { ok: false, error: 'Não foi possível preparar a impressão.' }
    }

    doc.open()
    doc.write(html)
    doc.close()

    const cleanup = () => {
      window.setTimeout(() => {
        try {
          iframe.remove()
        } catch {
          /* ignore */
        }
      }, 500)
    }

    win.onafterprint = cleanup
    window.setTimeout(cleanup, 60_000)

    window.setTimeout(() => {
      win.focus()
      win.print()
    }, 300)

    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Erro ao imprimir.' }
  }
}

export function webPrintPdfDataUrl(dataUrl: string): { ok: boolean; error?: string } {
  try {
    const iframe = document.createElement('iframe')
    iframe.setAttribute('aria-hidden', 'true')
    Object.assign(iframe.style, {
      position: 'fixed',
      right: '0',
      bottom: '0',
      width: '0',
      height: '0',
      border: 'none',
      visibility: 'hidden',
    })
    iframe.src = dataUrl
    document.body.appendChild(iframe)

    const cleanup = () => {
      window.setTimeout(() => {
        try {
          iframe.remove()
        } catch {
          /* ignore */
        }
      }, 500)
    }

    iframe.onload = () => {
      window.setTimeout(() => {
        const win = iframe.contentWindow
        if (!win) {
          cleanup()
          return
        }
        win.onafterprint = cleanup
        window.setTimeout(cleanup, 60_000)
        win.focus()
        win.print()
      }, 400)
    }

    iframe.onerror = () => {
      iframe.remove()
    }

    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Erro ao imprimir PDF.' }
  }
}
