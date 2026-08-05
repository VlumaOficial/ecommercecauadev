-- =====================================================
-- Codigo do Produto: novo modo "Automatico" deriva o prefixo do NOME
-- DO PRODUTO (decisao #24, derivarPrefixo() reaproveitado sem
-- mudanca em src/lib/produto-codigo.ts). "Herdar da categoria"
-- continua existindo como opcao separada, reaproveitando
-- gerar_codigo_produto/category_code_sequences (migration 016) sem
-- nenhuma alteracao. Ver ESCOPO_PROJETO.md decisoes #18/#23/#24 e
-- REGRAS_DE_NEGOCIO.md §4.6 para o historico completo.
--
-- Sequencia chaveada por (tenant_id, prefixo), nao por produto nem
-- por categoria: dois produtos com nomes diferentes que derivam o
-- mesmo prefixo (ex.: dois produtos cujo nome deriva "RAFP") dividem
-- a mesma sequencia (RAFP-0001, RAFP-0002) - o sufixo numerico de 4
-- digitos e a rede de seguranca contra colisao de prefixo, igual ja
-- acontece hoje entre categorias com prefixo parecido (decisao #23).
--
-- Nenhuma mudanca em criar_produto_com_variacoes nem em
-- atualizar_produto_com_variacoes (016/017): as duas ja recebem
-- "codigo" como string pronta - quem decide automatico/categoria/
-- manual e o Route Handler, chamando a RPC de reserva adequada ANTES
-- de criar o produto, exatamente como o modo "categoria" ja faz hoje
-- via gerar_codigo_produto. Opcao A, aprovada pelo usuario em
-- 04/08/2026 (Opcao B, RPC atomica unica, foi considerada e descartada
-- por exigir alterar a RPC de criacao ja testada em producao).
--
-- Sem migracao de dados: nenhum produto real existe ainda no catalogo
-- (ambiente de homologacao, so produtos de teste ja inativados).
-- Projeto: Criatorio Capua
-- =====================================================

create table if not exists public.product_code_sequences (
  tenant_id uuid not null default public.current_tenant_id() references public.tenants(id) on delete cascade,
  prefixo text not null,
  ultimo_numero integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (tenant_id, prefixo)
);

alter table public.product_code_sequences enable row level security;

drop policy if exists "product_code_sequences_staff_all" on public.product_code_sequences;
create policy "product_code_sequences_staff_all" on public.product_code_sequences
  for all to authenticated
  using (public.is_staff() and tenant_id = public.current_tenant_id())
  with check (public.is_staff() and tenant_id = public.current_tenant_id());

-- Recebe o prefixo JA DERIVADO em TypeScript (produto-codigo.ts,
-- derivarPrefixo, chamado no servidor a partir de produto.nome no
-- momento do submit) - nao reimplementa a regra de linguistica em
-- SQL, so faz a reserva atomica do proximo numero pra aquele prefixo.
create or replace function public.gerar_codigo_produto_por_prefixo(p_prefixo text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prefixo text := upper(trim(p_prefixo));
  v_numero integer;
begin
  if not public.is_staff() then
    raise exception 'Acesso restrito a equipe.';
  end if;

  if v_prefixo = '' then
    raise exception 'Não foi possível gerar um prefixo a partir do nome do produto.';
  end if;

  insert into public.product_code_sequences (tenant_id, prefixo, ultimo_numero)
  values (public.current_tenant_id(), v_prefixo, 1)
  on conflict (tenant_id, prefixo)
  do update set ultimo_numero = product_code_sequences.ultimo_numero + 1,
                updated_at = now()
  returning ultimo_numero into v_numero;

  return v_prefixo || '-' || lpad(v_numero::text, 4, '0');
end;
$$;
