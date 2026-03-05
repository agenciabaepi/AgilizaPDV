# Categorias: "Recurso de categorias não disponível"

Se ao criar ou editar categorias aparecer **"Recurso de categorias não disponível"**, o app está rodando com uma versão antiga do código (sem a API de categorias no preload do Electron).

## O que fazer

1. **Feche completamente o Agiliza PDV** (todas as janelas).
2. **Abra o app a partir do projeto** (código atualizado):
   - No terminal, na pasta do projeto:  
     `npm run dev`
   - Use a janela do Electron que abrir — não use o instalador antigo (.exe) nem uma build antiga.
3. Se for usar o instalador no Windows/Mac, **gere uma nova build** e instale de novo:
   - `npm run build`
   - Depois: `npm run build:win` (ou `build:mac` / `build:linux`)
   - Instale o novo instalador gerado em `release/`.

Assim o preload e o processo principal passam a incluir a API de categorias e o erro deixa de aparecer.
