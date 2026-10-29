#!/bin/sh
# Vérifie serveur/supabase.sql sur un Postgres local, avec une imitation minimale de Supabase (schéma auth, rôles, auth.uid()).
# Usage : sh test/regles_sql.sh   (Postgres installé ; lancé en root, il utilise l'utilisateur postgres)
set -e
BIN=$(ls -d /usr/lib/postgresql/*/bin | tail -1)
D=$(mktemp -d); chmod 777 "$D"
cp "$(cd "$(dirname "$0")/.." && pwd)/serveur/supabase.sql" "$D/s.sql"; chmod 644 "$D/s.sql"
run() { if [ "$(id -u)" = 0 ]; then su postgres -c "$*"; else sh -c "$*"; fi; }
run "$BIN/initdb -D $D/db -A trust >/dev/null && $BIN/pg_ctl -D $D/db -o '-k $D -p 54329 -c listen_addresses=' -l $D/log start >/dev/null"
trap 'run "$BIN/pg_ctl -D $D/db stop -m fast" >/dev/null; rm -rf "$D"' EXIT
P="$BIN/psql -h $D -p 54329 -d postgres -v ON_ERROR_STOP=1 -qAt"
run "$P" <<'SQL'
create role anon nologin; create role authenticated nologin;
create schema auth; grant usage on schema auth to anon, authenticated;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema public to anon, authenticated;
insert into auth.users values ('00000000-0000-0000-0000-00000000000a'), ('00000000-0000-0000-0000-00000000000b');
SQL
run "$P -f $D/s.sql"
run "$P -f $D/s.sql"   # relançable
run "$P" <<'SQL'
create function pg_temp.ok(c boolean, m text) returns void language plpgsql as $$ begin raise notice '%', (case when c then 'ok   ' else 'ÉCHEC ' end) || m; if not c then raise exception 'échec'; end if; end $$;
-- A crée son espace
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
insert into public.espaces (data) values ('{"profiles":[{"id":"amina"}]}');
select pg_temp.ok((select count(*) from public.espaces) = 1, 'A voit son espace');
select pg_temp.ok((select owner_id from public.espaces) = auth.uid(), 'propriétaire = A par défaut');
-- B ne voit ni ne modifie l'espace de A
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select pg_temp.ok((select count(*) from public.espaces) = 0, 'B ne voit pas l''espace de A');
update public.espaces set data = '{}';
do $$ begin delete from public.espaces; raise exception 'passé'; exception when insufficient_privilege then null; end $$;
reset role;
select pg_temp.ok((select data->'profiles'->0->>'id' from public.espaces) = 'amina', 'B n''a rien pu modifier ni supprimer');
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
do $$ begin insert into public.espaces (owner_id, data) values ('00000000-0000-0000-0000-00000000000a', '{}'); raise exception 'passé'; exception when others then if sqlerrm = 'passé' then raise; end if; end $$;
select pg_temp.ok(true, 'B ne peut pas créer un espace au nom de A');
-- A : un seul espace, pas de suppression, écriture conditionnée à la version
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
do $$ begin insert into public.espaces (data) values ('{}'); raise exception 'passé'; exception when unique_violation then null; end $$;
select pg_temp.ok(true, 'un seul espace par compte');
do $$ begin delete from public.espaces; raise exception 'passé'; exception when insufficient_privilege then null; end $$;
select pg_temp.ok((select count(*) from public.espaces) = 1, 'A ne peut pas supprimer son espace');
update public.espaces set data = '{"v":2}', rev = 2 where rev = 1;
update public.espaces set data = '{"v":3}', rev = 2 where rev = 1;
select pg_temp.ok((select data->>'v' from public.espaces) = '2', 'écriture sur une version périmée ignorée');
do $$ begin update public.espaces set owner_id = '00000000-0000-0000-0000-00000000000b'; raise exception 'passé'; exception when others then if sqlerrm = 'passé' then raise; end if; end $$;
select pg_temp.ok(true, 'A ne peut pas donner son espace à B');
do $$ begin update public.espaces set data = '[1]'; raise exception 'passé'; exception when check_violation then null; end $$;
select pg_temp.ok(true, 'données non conformes refusées');
-- Visiteur non connecté
set role anon; reset request.jwt.claim.sub;
do $$ begin perform * from public.espaces; raise exception 'passé'; exception when insufficient_privilege then null; end $$;
select pg_temp.ok(true, 'un visiteur non connecté n''a aucun accès');
SQL
