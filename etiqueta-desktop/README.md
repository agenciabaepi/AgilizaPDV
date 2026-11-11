# Agiliza Etiquetas (desktop)

App Electron dedicado à **impressão de etiquetas de produtos**, com login do admin igual ao painel web e foco na **Argox OS-214 Plus** (2 etiquetas por fileira).

## O que faz

- Login com e-mail/login + senha (mesma tabela `usuarios` / hash PBKDF2 do AgilizaPDV web)
- Lista só produtos ativos da empresa
- Fila de impressão com quantidade
- Modelos **40×25 mm, 2 colunas** em **PPLB** e **PPLA**
- Envio **RAW** para a fila do Windows/macOS/Linux (comandos PPLA/PPLB)

## Conexão com a Argox OS-214 Plus

Pesquisa em manuais e softwares oficiais (BarTender, driver Seagull, iLabelPrint+, Argox SDK):

1. **Interface:** USB (ou serial RS-232). No PC, use o cabo USB.
2. **Driver Windows:** instale o **Argox Windows Printer Driver (Seagull)** pelo site da Argox — *não* use só o assistente “Adicionar impressora” do Windows.
3. **Emulação:** a OS-214 Plus fala **PPLA** ou **PPLB**. O nome da fila costuma incluir isso (ex.: `Argox OS-214plus PPLB`). No app, o modelo deve bater com a emulação da impressora.
4. **Software de referência:** BarTender (Seagull), ArgoBar Pro, iLabelPrint+ e o Argox SDK enviam comandos PPLA/PPLB (ou usam o driver GDI). Este app envia **comandos RAW PPLB/PPLA** via spooler (`RAW` no Windows / `lp -o raw` no macOS/Linux), no mesmo espírito de utilitários de etiqueta térmica.
5. **Se a fila “imprime” mas nada sai:** crie uma impressora **Genérico / Somente texto** na **mesma porta USB** da Argox e selecione essa fila no app (pass-through RAW). Isso é comum quando o driver Seagull engole jobs RAW do aplicativo.

Drivers: [argox.com/download/drivers](https://www.argox.com/download/drivers/)

## Como rodar

```bash
cd etiqueta-desktop
cp .env.example .env   # use as mesmas VITE_SUPABASE_* do web
npm install
npm run dev
```

O Vite sobe a UI e o Electron. Em produção:

```bash
npm run build
npx electron .
```

## Instalador Windows

No Mac ou no PC (gera NSIS x64):

```bash
cd etiqueta-desktop
npm install
npm run dist:win
```

O instalador sai em:

`etiqueta-desktop/release/1.0.0/Agiliza-Etiquetas-Windows-1.0.0-Setup.exe`

Requer `.env` com `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (embutidos no build).

## Pasta

Criado em `AgilizaPDV/etiqueta-desktop` (separado do `web/` e do PDV Electron completo). O motor de layout/comandos foi reaproveitado de `electron/labels/` do monorepo (Argox 40×25 2 colunas).
