# Instalador Windows (NSIS) — identidade visual

O instalador assistente (`oneClick: false`) usa os bitmaps que o NSIS espera para **sidebar** (boas-vindas / conclusão) e **header** (páginas internas). Eles são gerados automaticamente a partir das mesmas cores do app:

| Token        | Uso no app              | Hex       |
|-------------|-------------------------|-----------|
| Topbar      | `.app-topbar`           | `#1e293b` |
| Primário    | botões, abas, destaques | `#1d4ed8` |

## Gerar os arquivos

```bash
npm run generate:nsis-bitmaps
```

Saída:

- `build/installerSidebar.bmp` — 164×314 px  
- `build/installerHeader.bmp` — 150×57 px  

`npm run build:win` e `npm run release:win` já executam esse passo antes do `electron-builder`.

## Configuração

Definido em `electron-builder.yml` (`nsis.installerSidebar`, `installerHeader`, `uninstallerSidebar`). O script fonte é `scripts/windows/generate-nsis-bitmaps.mjs` (somente Node, sem dependências extras).

## Limitações do NSIS

- A escolha **Servidor vs Terminal** continua em um `MessageBox` nativo (`build/installer.nsh`); personalização visual completa exigiria página customizada com `nsDialogs`.
- Imagens precisam ser **BMP 24 bits** (requisito do NSIS).

Para incluir logo ou texto desenhado na sidebar, gere novas BMPs (Figma/Photoshop) com os mesmos tamanhos e aponte os caminhos no `electron-builder.yml`, ou estenda o script para compor sobre PNG exportado.
