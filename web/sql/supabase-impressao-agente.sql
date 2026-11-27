-- =============================================================================
-- Agiliza Impressão: fila de impressão consumida pelo programa instalado no
-- computador ligado à impressora térmica (mesmo modelo do print-agent do Apetite).
--
-- * impressao_impressoras: impressoras "lógicas" da loja (ex.: Caixa 1, Caixa 2).
--   Cada computador com o Agiliza Impressão liga uma delas a uma impressora do Windows.
-- * impressao_estacoes: computadores conectados. Autenticam com um código
--   (token) cujo hash fica no banco; o token em si só aparece uma vez.
-- * impressao_jobs: documentos a imprimir. O sistema web insere; o programa
--   pega (agente_impressao_pegar), imprime e conclui (agente_impressao_concluir).
--   Um aviso via Realtime (sem conteúdo) acorda o programa na hora.
--
-- Pode rodar mais de uma vez (idempotente).
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;

-- -----------------------------------------------------------------------------
-- Tabelas
-- -----------------------------------------------------------------------------
create table if not exists public.impressao_impressoras (
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null,
  nome text not null check (char_length(nome) between 1 and 40),
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index if not exists impressao_impressoras_nome_uq
  on public.impressao_impressoras (empresa_id, lower(nome));

create table if not exists public.impressao_estacoes (
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null,
  nome text not null check (char_length(nome) between 1 and 40),
  token_hash bytea not null unique,
  ultimo_contato timestamptz,
  versao text,
  created_at timestamptz not null default now()
);

create index if not exists impressao_estacoes_empresa_idx on public.impressao_estacoes (empresa_id);

create table if not exists public.impressao_jobs (
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null,
  impressora_id uuid not null references public.impressao_impressoras (id) on delete cascade,
  tipo text not null check (tipo in ('documento', 'teste')),
  titulo text check (titulo is null or char_length(titulo) <= 120),
  payload jsonb not null check (jsonb_typeof(payload) = 'object' and pg_column_size(payload) <= 131072),
  status text not null default 'pendente' check (status in ('pendente', 'imprimindo', 'impresso', 'falhou')),
  tentativas integer not null default 0,
  erro text check (erro is null or char_length(erro) <= 500),
  estacao_id uuid references public.impressao_estacoes (id) on delete set null,
  created_at timestamptz not null default now(),
  pego_em timestamptz,
  concluido_em timestamptz
);

-- Primeira versão usava uuid; empresas.id é texto.
drop function if exists public.criar_estacao_impressao(uuid, text);
alter table public.impressao_impressoras alter column empresa_id type text using empresa_id::text;
alter table public.impressao_estacoes alter column empresa_id type text using empresa_id::text;
alter table public.impressao_jobs alter column empresa_id type text using empresa_id::text;

create index if not exists impressao_jobs_fila_idx on public.impressao_jobs (impressora_id, created_at)
  where status in ('pendente', 'imprimindo');
create index if not exists impressao_jobs_empresa_idx on public.impressao_jobs (empresa_id, created_at desc);

-- -----------------------------------------------------------------------------
-- Acesso (o sistema usa a chave anon, como o resto do projeto).
-- O hash do token nunca é legível pela API.
-- -----------------------------------------------------------------------------
alter table public.impressao_impressoras enable row level security;
alter table public.impressao_estacoes enable row level security;
alter table public.impressao_jobs enable row level security;

revoke all on public.impressao_impressoras, public.impressao_estacoes, public.impressao_jobs from anon, authenticated;
grant select, insert, update, delete on public.impressao_impressoras to anon, authenticated;
grant select (id, empresa_id, nome, ultimo_contato, versao, created_at) on public.impressao_estacoes to anon, authenticated;
grant update (nome) on public.impressao_estacoes to anon, authenticated;
grant delete on public.impressao_estacoes to anon, authenticated;
grant select, insert on public.impressao_jobs to anon, authenticated;

drop policy if exists "impressao_impressoras_all" on public.impressao_impressoras;
create policy "impressao_impressoras_all" on public.impressao_impressoras
  for all to anon, authenticated using (true) with check (true);

drop policy if exists "impressao_estacoes_all" on public.impressao_estacoes;
create policy "impressao_estacoes_all" on public.impressao_estacoes
  for all to anon, authenticated using (true) with check (true);

drop policy if exists "impressao_jobs_select" on public.impressao_jobs;
create policy "impressao_jobs_select" on public.impressao_jobs
  for select to anon, authenticated using (true);

-- Pelo sistema só entram documentos novos, pendentes.
drop policy if exists "impressao_jobs_insert" on public.impressao_jobs;
create policy "impressao_jobs_insert" on public.impressao_jobs
  for insert to anon, authenticated
  with check (status = 'pendente' and tentativas = 0 and estacao_id is null);

-- -----------------------------------------------------------------------------
-- Aviso instantâneo para os computadores da loja
-- -----------------------------------------------------------------------------
create or replace function public.impressao_avisar_estacoes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_estacao uuid;
begin
  for v_estacao in
    select e.id from public.impressao_estacoes e
    where e.empresa_id in (select distinct j.empresa_id from novos j where j.status = 'pendente')
  loop
    begin
      perform realtime.send('{}'::jsonb, 'jobs', 'impressao-estacao:' || v_estacao, false);
    exception when others then
      -- O programa também consulta a fila a cada 2 s; perder o aviso só atrasa.
      null;
    end;
  end loop;
  return null;
end;
$$;

drop trigger if exists impressao_jobs_avisar on public.impressao_jobs;
create trigger impressao_jobs_avisar
  after insert on public.impressao_jobs
  referencing new table as novos
  for each statement execute function public.impressao_avisar_estacoes();

-- -----------------------------------------------------------------------------
-- Computadores (gerenciados pela tela Configurações › Impressoras)
-- -----------------------------------------------------------------------------

-- Devolve o token uma única vez; só o hash fica salvo.
create or replace function public.criar_estacao_impressao(p_empresa_id text, p_nome text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text;
begin
  if p_empresa_id is null or char_length(trim(p_empresa_id)) = 0 then
    raise exception 'Empresa não informada' using errcode = '22023';
  end if;
  if p_nome is null or char_length(trim(p_nome)) not between 1 and 40 then
    raise exception 'Informe um nome com até 40 caracteres' using errcode = '22023';
  end if;
  if (select count(*) from public.impressao_estacoes where empresa_id = p_empresa_id) >= 20 then
    raise exception 'Limite de computadores de impressão atingido' using errcode = 'P0001';
  end if;

  v_token := 'agl_' || encode(extensions.gen_random_bytes(24), 'hex');

  insert into public.impressao_estacoes (empresa_id, nome, token_hash)
  values (p_empresa_id, trim(p_nome), extensions.digest(v_token, 'sha256'));

  return v_token;
end;
$$;

-- -----------------------------------------------------------------------------
-- API do programa (autenticada só pelo token)
-- -----------------------------------------------------------------------------
create or replace function public.impressao_estacao_do_token(p_token text, p_versao text default null)
returns public.impressao_estacoes
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_estacao public.impressao_estacoes;
begin
  if p_token is null or char_length(p_token) > 200 then
    raise exception 'Código de conexão inválido' using errcode = '28000';
  end if;

  update public.impressao_estacoes
  set ultimo_contato = now(),
      versao = coalesce(left(p_versao, 20), versao)
  where token_hash = extensions.digest(p_token, 'sha256')
  returning * into v_estacao;

  if not found then
    raise exception 'Código de conexão inválido ou removido' using errcode = '28000';
  end if;
  return v_estacao;
end;
$$;

create or replace function public.agente_impressao_ola(p_token text, p_versao text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_estacao public.impressao_estacoes := public.impressao_estacao_do_token(p_token, p_versao);
begin
  delete from public.impressao_jobs
  where empresa_id = v_estacao.empresa_id
    and created_at < now() - interval '7 days';

  return jsonb_build_object(
    'estacao', jsonb_build_object('id', v_estacao.id, 'nome', v_estacao.nome),
    'empresa', (
      select jsonb_build_object('id', e.id, 'nome', e.nome)
      from public.empresas e where e.id = v_estacao.empresa_id
    ),
    'impressoras', coalesce((
      select jsonb_agg(jsonb_build_object('id', i.id, 'nome', i.nome) order by i.nome)
      from public.impressao_impressoras i
      where i.empresa_id = v_estacao.empresa_id and i.ativo
    ), '[]'::jsonb)
  );
end;
$$;

-- Pega documentos pendentes das impressoras deste computador. O que ninguém
-- imprimiu em 15 minutos expira, e o que travou em "imprimindo" (programa
-- fechado no meio) volta para a fila até 3 vezes.
create or replace function public.agente_impressao_pegar(p_token text, p_impressora_ids uuid[])
returns table (
  id uuid,
  impressora_id uuid,
  tipo text,
  titulo text,
  payload jsonb,
  tentativas integer,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_estacao public.impressao_estacoes := public.impressao_estacao_do_token(p_token);
begin
  if p_impressora_ids is null or cardinality(p_impressora_ids) = 0 then
    return;
  end if;

  update public.impressao_jobs j
  set status = 'falhou', concluido_em = now(),
      erro = case when j.status = 'pendente' then 'Expirou: nenhum computador imprimiu a tempo'
                  else 'O computador de impressão parou de responder' end
  where j.empresa_id = v_estacao.empresa_id
    and j.impressora_id = any (p_impressora_ids)
    and (
      (j.status = 'pendente' and j.created_at < now() - interval '15 minutes')
      or (j.status = 'imprimindo' and j.pego_em < now() - interval '2 minutes' and j.tentativas >= 3)
    );

  return query
  update public.impressao_jobs j
  set status = 'imprimindo', estacao_id = v_estacao.id, pego_em = now(), tentativas = j.tentativas + 1
  where j.id in (
    select q.id from public.impressao_jobs q
    where q.empresa_id = v_estacao.empresa_id
      and q.impressora_id = any (p_impressora_ids)
      and (q.status = 'pendente' or (q.status = 'imprimindo' and q.pego_em < now() - interval '2 minutes'))
    order by q.created_at
    limit 20
    for update skip locked
  )
  returning j.id, j.impressora_id, j.tipo, j.titulo, j.payload, j.tentativas, j.created_at;
end;
$$;

create or replace function public.agente_impressao_concluir(p_token text, p_job_id uuid, p_erro text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_estacao public.impressao_estacoes := public.impressao_estacao_do_token(p_token);
begin
  update public.impressao_jobs
  set status = case when p_erro is null then 'impresso' else 'falhou' end,
      erro = left(p_erro, 500),
      concluido_em = now()
  where id = p_job_id and estacao_id = v_estacao.id and status = 'imprimindo';
end;
$$;

revoke execute on function
  public.impressao_avisar_estacoes(),
  public.impressao_estacao_do_token(text, text)
from public, anon, authenticated;

grant execute on function
  public.criar_estacao_impressao(text, text),
  public.agente_impressao_ola(text, text),
  public.agente_impressao_pegar(text, uuid[]),
  public.agente_impressao_concluir(text, uuid, text)
to anon, authenticated;
