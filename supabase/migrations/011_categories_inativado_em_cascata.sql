-- =====================================================
-- Cascata de inativacao/reativacao em categorias
-- inativado_em_cascata marca linhas derrubadas como efeito colateral
-- da inativacao de um ANCESTRAL (nao por decisao propria) — permite
-- restaurar so essas na reativacao.
-- Projeto: Criatorio Capua
-- =====================================================

alter table public.categories
  add column if not exists inativado_em_cascata boolean not null default false;

-- Integridade: categoria ativa nunca pode estar marcada como
-- "inativada por cascata" — pega qualquer bug de logica na RPC.
alter table public.categories
  drop constraint if exists chk_inativado_em_cascata_requires_inativo;
alter table public.categories
  add constraint chk_inativado_em_cascata_requires_inativo
  check (not inativado_em_cascata or not ativo);

-- ---------- RPC atomica: aplica a cascata inteira numa transacao so ----------
create or replace function public.set_category_ativo_cascade(
  p_category_id uuid,
  p_ativo boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_staff() then
    raise exception 'Acesso restrito a equipe.';
  end if;

  if p_ativo = false then
    -- A propria categoria: sempre "manual" (nunca fica marcada como
    -- cascata, mesmo se ela mesma tivesse sido cascateada antes por
    -- um ancestral — a partir de agora e uma decisao explicita).
    update public.categories
    set ativo = false, inativado_em_cascata = false
    where id = p_category_id;

    -- Subarvore inteira (qualquer profundidade) que estiver ATIVA
    -- agora vira inativa E marcada como cascata. Quem ja estava
    -- inativo (por conta propria ou de cascata anterior) nao e
    -- tocado — o filtro "c.ativo = true" garante isso.
    with recursive descendentes as (
      select id from public.categories where parent_id = p_category_id
      union all
      select c.id from public.categories c join descendentes d on c.parent_id = d.id
    )
    update public.categories c
    set ativo = false, inativado_em_cascata = true
    from descendentes d
    where c.id = d.id and c.ativo = true;
  else
    -- A propria categoria volta, sempre "manual".
    update public.categories
    set ativo = true, inativado_em_cascata = false
    where id = p_category_id;

    -- SO quem foi derrubado por cascata (inativado_em_cascata = true)
    -- volta e perde a marca. Quem esta inativo por conta propria
    -- (inativado_em_cascata = false) fica exatamente como estava.
    with recursive descendentes as (
      select id from public.categories where parent_id = p_category_id
      union all
      select c.id from public.categories c join descendentes d on c.parent_id = d.id
    )
    update public.categories c
    set ativo = true, inativado_em_cascata = false
    from descendentes d
    where c.id = d.id and c.inativado_em_cascata = true;
  end if;
end;
$$;
