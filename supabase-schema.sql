-- ============================================================
-- Cuzco — Esquema de base de datos para Supabase
-- ============================================================
-- Cómo usarlo:
--   1. Entra en https://supabase.com/dashboard
--   2. Abre tu proyecto → SQL Editor → New query
--   3. Pega todo este archivo y pulsa Run
--
-- Después, en el panel de Supabase:
--   • Authentication → Providers → Email → activar "Confirm email"
--   • Authentication → URL Configuration
--       Site URL:      tu URL pública (ej. https://cuzco.vercel.app)
--       Redirect URLs: http://localhost:3456/**  y  https://tu-dominio/**
-- ============================================================

-- Tabla de perfiles (un registro por usuario registrado)
create table if not exists public.perfiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text not null default '',
  created_at timestamptz default now()
);

alter table public.perfiles enable row level security;

drop policy if exists "Ver propio perfil" on public.perfiles;
create policy "Ver propio perfil"
  on public.perfiles for select
  using (auth.uid() = id);

drop policy if exists "Insertar propio perfil" on public.perfiles;
create policy "Insertar propio perfil"
  on public.perfiles for insert
  with check (auth.uid() = id);

drop policy if exists "Actualizar propio perfil" on public.perfiles;
create policy "Actualizar propio perfil"
  on public.perfiles for update
  using (auth.uid() = id);

-- Tabla de clientes (cada profesional ve solo los suyos)
create table if not exists public.clientes (
  id uuid primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  data jsonb not null default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists clientes_user_id_idx on public.clientes(user_id);

alter table public.clientes enable row level security;

drop policy if exists "Ver propios clientes" on public.clientes;
create policy "Ver propios clientes"
  on public.clientes for select
  using (auth.uid() = user_id);

drop policy if exists "Insertar propios clientes" on public.clientes;
create policy "Insertar propios clientes"
  on public.clientes for insert
  with check (auth.uid() = user_id);

drop policy if exists "Actualizar propios clientes" on public.clientes;
create policy "Actualizar propios clientes"
  on public.clientes for update
  using (auth.uid() = user_id);

drop policy if exists "Eliminar propios clientes" on public.clientes;
create policy "Eliminar propios clientes"
  on public.clientes for delete
  using (auth.uid() = user_id);

-- Trigger: crea el perfil automáticamente al registrarse un usuario
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.perfiles (id, nombre)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nombre', split_part(new.email, '@', 1))
  )
  on conflict (id) do update
    set nombre = excluded.nombre;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Comprobar si un email ya está registrado (para aviso en el formulario de alta)
create or replace function public.email_registrado(check_email text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  return exists (
    select 1
    from auth.users
    where lower(email) = lower(trim(check_email))
  );
end;
$$;

revoke all on function public.email_registrado(text) from public;
grant execute on function public.email_registrado(text) to anon, authenticated;

-- Visibilidad de equipo: perfiles y clientes legibles por todos los miembros autenticados
drop policy if exists "Ver equipo perfiles" on public.perfiles;
create policy "Ver equipo perfiles"
  on public.perfiles for select
  to authenticated
  using (true);

drop policy if exists "Ver clientes del equipo" on public.clientes;
create policy "Ver clientes del equipo"
  on public.clientes for select
  to authenticated
  using (true);

-- Configuración compartida del equipo (objetivos y porcentajes)
create table if not exists public.equipo_config (
  id int primary key default 1 check (id = 1),
  config jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);

insert into public.equipo_config (id, config)
values (1, '{}'::jsonb)
on conflict (id) do nothing;

alter table public.equipo_config enable row level security;

drop policy if exists "Equipo config lectura" on public.equipo_config;
create policy "Equipo config lectura"
  on public.equipo_config for select
  to authenticated
  using (true);

drop policy if exists "Equipo config escritura" on public.equipo_config;
create policy "Equipo config escritura"
  on public.equipo_config for all
  to authenticated
  using (true)
  with check (true);