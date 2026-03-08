# Configurar Supabase no build do GitHub Actions

Para o instalador Windows sair **já com Supabase configurado** (sem precisar editar .env na máquina do cliente), é obrigatório configurar os secrets no repositório.

**Importante:** use **Repository secrets** (não só Environment secrets). Se você colocou `SUPABASE_URL` em um environment e `SUPABASE_ANON_KEY` em outro, o job só enxerga um. Coloque **os dois** em **Repository secrets**.

## Passo a passo

1. No GitHub, abra o repositório **AgilizaPDV**.
2. Vá em **Settings** (Configurações).
3. No menu lateral, em **Security** → **Secrets and variables** → **Actions**.
4. Aba **Secrets** (não Variables).
5. Em **Repository secrets**, clique em **New repository secret**.
6. Crie **dois** secrets com estes **nomes exatos**:

   | Nome do secret   | Valor |
   |------------------|--------|
   | `SUPABASE_URL`   | A URL do seu projeto. Ex.: `https://xxxxxxxx.supabase.co` (copie em Supabase → Project Settings → API → Project URL). |
   | `SUPABASE_ANON_KEY` | A chave **anon public**. Ex.: `eyJhbGciOiJIUzI1NiIsInR5cCI6...` (copie em Supabase → Project Settings → API → anon public). |

7. Salve os dois. **Não** use Environment para isso a menos que já tenha configurado; **Repository secrets** são suficientes.

## Como conferir

Depois de configurar, dispare um novo build (nova tag ou **Run workflow** em Actions). No log do job **build-windows**:

- No passo **"Verificar env Supabase (diagnóstico)"** deve aparecer:
  - `SUPABASE_URL está definido`
  - `SUPABASE_ANON_KEY está definido`
- No passo **"Build Windows installer"**, na saída do `generate-env-install`, deve aparecer:
  - `env.install gerado com SUPABASE_URL e SUPABASE_ANON_KEY.`

Se ainda aparecer "NÃO definido" ou "valores em branco", confira:

- Os nomes dos secrets são **exatamente** `SUPABASE_URL` e `SUPABASE_ANON_KEY` (com S maiúsculo, sem espaço).
- Eles estão em **Secrets**, não só em **Variables**.
- Eles estão em **Repository secrets** (Actions → Secrets), não só em um Environment.
