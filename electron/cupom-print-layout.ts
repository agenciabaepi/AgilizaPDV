import type { WebContentsPrintOptions } from 'electron'

/** Preset de página/CSS para impressão térmica (cupom, fechamento, recibo). */
export type CupomLayoutPagina = 'compat' | 'thermal_80_72' | 'thermal_80_full'

export function normalizeCupomLayoutPagina(raw: string | null | undefined): CupomLayoutPagina {
  const v = (raw ?? '').trim()
  if (v === 'thermal_80_72' || v === 'thermal_80_full') return v
  return 'compat'
}

const BODY_SKIN = `
  background: #fff;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
  color: #000;
  font-family: "Courier New", Consolas, monospace;
  font-weight: 600;
  text-rendering: geometricPrecision;
`

/** HTML completo para impressão: envolve o inner gerado por cupom/fechamento/recibo. */
export function buildThermalReceiptHtml(innerHtml: string, layout: CupomLayoutPagina = 'compat'): string {
  if (layout === 'compat') {
    return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      @page { margin: 0; size: auto; }
      html, body {
        margin: 0;
        padding: 0;
        width: 302px;
        max-width: 302px;
        box-sizing: border-box;
        ${BODY_SKIN}
      }
    </style>
  </head>
  <body>${innerHtml}</body>
</html>`
  }

  if (layout === 'thermal_80_full') {
    return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      @page { size: 80mm auto; margin: 0; }
      html {
        margin: 0;
        padding: 0;
        width: 80mm;
        background: #fff;
      }
      body {
        margin: 0;
        padding: 2mm 1mm;
        width: 80mm;
        max-width: 80mm;
        box-sizing: border-box;
        ${BODY_SKIN}
      }
    </style>
  </head>
  <body>${innerHtml}</body>
</html>`
  }

  // thermal_80_72 — área útil ~72,1 mm (margens físicas comuns)
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      @page { size: 80mm 297mm; margin: 0; }
      html {
        margin: 0;
        padding: 0;
        width: 80mm;
        background: #fff;
      }
      body {
        margin: 0;
        padding: 0 3.95mm;
        width: 80mm;
        max-width: 80mm;
        box-sizing: border-box;
        ${BODY_SKIN}
      }
      body > * {
        width: 100%;
        max-width: 72.1mm;
        margin: 0 auto;
        box-sizing: border-box;
      }
    </style>
  </head>
  <body>${innerHtml}</body>
</html>`
}

export function buildCupomPrintOptions(
  impressoraCupom: string | null,
  layout: CupomLayoutPagina = 'compat'
): WebContentsPrintOptions {
  const base: WebContentsPrintOptions = {
    silent: Boolean(impressoraCupom),
    printBackground: true,
    margins: { marginType: 'none' },
    scaleFactor: 100,
  }
  if (layout !== 'compat') {
    base.dpi = { horizontal: 203, vertical: 203 }
  }
  if (impressoraCupom) {
    base.deviceName = impressoraCupom
  }
  return base
}

/** Cupom fictício para pré-visualização do preset na tela de configurações. */
export function buildSampleCupomInnerHtml(): string {
  return `<div style="font-family: 'Courier New', Consolas, monospace; font-size: 13px; line-height: 1.32; color: #000; width: 100%; padding: 2.5mm 1mm; box-sizing: border-box;">
  <div style="text-align: center; font-weight: bold; margin-bottom: 8px;">Exemplo — Sua Loja</div>
  <div style="text-align: center; font-size: 10px; margin-bottom: 12px;">CUPOM NÃO FISCAL (EXEMPLO)</div>
  <div style="border-bottom: 1px dashed #000; margin-bottom: 8px;">Venda #999 &nbsp; 25/03/2025 14:30</div>
  <table style="width: 100%; font-size: 12px; border-collapse: collapse;">
    <thead><tr style="border-bottom: 1px solid #000;"><th style="text-align: left;">Item</th><th style="text-align: right;">Qtd</th><th style="text-align: right;">Valor</th></tr></thead>
    <tbody>
      <tr style="border-bottom: 1px dotted #000;"><td>Produto exemplo A</td><td style="text-align: right;">2</td><td style="text-align: right;">R$ 10,00</td></tr>
      <tr style="border-bottom: 1px dotted #000;"><td>Produto exemplo B</td><td style="text-align: right;">1</td><td style="text-align: right;">R$ 5,50</td></tr>
    </tbody>
  </table>
  <div style="border-top: 1px dashed #000; margin-top: 8px; padding-top: 8px; font-size: 11px;">
    <div style="display: flex; justify-content: space-between;"><span>Subtotal</span><span>R$ 15,50</span></div>
    <div style="display: flex; justify-content: space-between; font-weight: bold; margin-top: 4px;"><span>Total</span><span>R$ 15,50</span></div>
    <div style="display: flex; justify-content: space-between;"><span>Dinheiro</span><span>R$ 20,00</span></div>
    <div style="display: flex; justify-content: space-between;"><span>Troco</span><span>R$ 4,50</span></div>
  </div>
  <div style="text-align: center; margin-top: 14px; font-size: 10px;">Obrigado pela preferência!</div>
</div>`
}
