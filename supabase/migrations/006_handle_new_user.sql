-- =====================================================
-- F3 - Provisionamento automatico de usuario
-- Ao criar auth.users, direciona para customers ou profiles
-- conforme o metadata informado no cadastro.
-- Projeto: Criatorio Capua
-- =====================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_role text;
  v_nome text;
  v_whatsapp text;
  v_city_id uuid;
begin
  -- tenant padrao (MVP single-tenant)
  select id into v_tenant_id from public.tenants where slug = 'capua' limit 1;

  v_role     := coalesce(new.raw_user_meta_data->>'role', 'cliente');
  v_nome     := coalesce(new.raw_user_meta_data->>'nome', split_part(new.email, '@', 1));
  v_whatsapp := new.raw_user_meta_data->>'whatsapp';

  if v_role in ('admin', 'operador') then
    -- Equipe interna
    insert into public.profiles (id, tenant_id, nome, email, role)
    values (
      new.id,
      v_tenant_id,
      v_nome,
      new.email,
      v_role::user_role
    )
    on conflict (id) do nothing;
  else
    -- Cliente final
    begin
      v_city_id := nullif(new.raw_user_meta_data->>'delivery_city_id', '')::uuid;
    exception when others then
      v_city_id := null;
    end;

    insert into public.customers (tenant_id, auth_user_id, nome, whatsapp, email, delivery_city_id)
    values (
      v_tenant_id,
      new.id,
      v_nome,
      coalesce(v_whatsapp, ''),
      new.email,
      v_city_id
    )
    on conflict (auth_user_id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
