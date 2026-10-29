-- Éducateur coranique : base de la synchronisation (Supabase, offre gratuite).
-- À coller une seule fois dans Supabase > SQL Editor > New query, puis « Run ». Peut être relancé sans dommage.
-- Un compte (une adresse e-mail) = un espace famille : une seule ligne contenant la sauvegarde complète.
-- Règles : chaque compte ne lit et n'écrit que sa propre ligne ; personne ne peut supprimer de ligne depuis l'appli.

create table if not exists public.espaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique default auth.uid() references auth.users (id) on delete cascade,
  data jsonb not null,
  rev integer not null default 1,                -- numéro de version : une écriture ne passe que sur la version lue
  updated_at timestamptz not null default now(),
  constraint espaces_taille check (pg_column_size(data) < 5000000),
  constraint espaces_objet check (jsonb_typeof(data) = 'object')
);

alter table public.espaces enable row level security;

revoke all on public.espaces from anon, authenticated;
grant select, insert, update on public.espaces to authenticated;

drop policy if exists "espaces_lire" on public.espaces;
drop policy if exists "espaces_creer" on public.espaces;
drop policy if exists "espaces_modifier" on public.espaces;
create policy "espaces_lire" on public.espaces for select to authenticated using (owner_id = (select auth.uid()));
create policy "espaces_creer" on public.espaces for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "espaces_modifier" on public.espaces for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
-- Pas de règle « delete » : aucune suppression possible depuis l'appli.

create or replace function public.espaces_date() returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists espaces_date on public.espaces;
create trigger espaces_date before update on public.espaces for each row execute function public.espaces_date();
