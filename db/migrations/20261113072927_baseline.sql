do $$
begin
    if not exists (select 1 from pg_catalog.pg_roles where rolname = 'app_be') then
        create role app_be login noinherit nosuperuser nobypassrls nocreatedb nocreaterole;
    end if;
end;
$$;

-- The attributes a migration may change: SUPERUSER and BYPASSRLS stay as create role set them.
alter role app_be login noinherit nocreatedb nocreaterole;

create schema if not exists private;

revoke all on schema private from public, anon, authenticated;

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

-- The device sessions and rotating refresh tokens of @starci/auth. A token is stored by its sha256 only; a rotated token stays,
-- marked used, so a replay is detected: a replay inside the grace window gets a successor of its own (raced_count bounds how many),
-- an older one ends the session and every token of it.
-- identity_attempts counts the sign-in attempts of one address in a window every replica shares (the budget of failures).
-- The app owns auth.users (db/bootstrap.sql) and the role app_be.

create table public.identity_sessions (
    id uuid primary key,
    user_id uuid not null references auth.users (id) on delete cascade,
    created_at timestamptz not null default now(),
    refreshed_at timestamptz not null default now(),
    user_agent text,
    ip text
);

create index identity_sessions_user_idx on public.identity_sessions (user_id);

create table public.identity_refresh_tokens (
    id uuid primary key default gen_random_uuid(),
    session_id uuid not null references public.identity_sessions (id) on delete cascade,
    user_id uuid not null,
    token_hash text not null,
    created_at timestamptz not null default now(),
    expires_at timestamptz not null,
    used_at timestamptz,
    raced_count integer not null default 0,
    constraint identity_refresh_tokens_hash_key unique (token_hash)
);

create index identity_refresh_tokens_session_idx on public.identity_refresh_tokens (session_id);
create index identity_refresh_tokens_expiry_idx on public.identity_refresh_tokens (user_id, expires_at);

create table public.identity_attempts (
    key varchar(128) primary key,
    hits integer not null,
    reset_at timestamptz not null
);

create index identity_attempts_reset_idx on public.identity_attempts (reset_at);

alter table public.identity_sessions enable row level security;
alter table public.identity_sessions force row level security;
alter table public.identity_refresh_tokens enable row level security;
alter table public.identity_refresh_tokens force row level security;
alter table public.identity_attempts enable row level security;
alter table public.identity_attempts force row level security;

revoke all on table public.identity_sessions from public;
revoke all on table public.identity_refresh_tokens from public;
revoke all on table public.identity_attempts from public;
grant select, insert, update, delete on table public.identity_sessions to app_be;
grant select, insert, update, delete on table public.identity_refresh_tokens to app_be;
grant select, insert, update, delete on table public.identity_attempts to app_be;

create policy identity_sessions_app_be_all on public.identity_sessions
    for all to app_be using (current_user = 'app_be') with check (current_user = 'app_be');
create policy identity_refresh_tokens_app_be_all on public.identity_refresh_tokens
    for all to app_be using (current_user = 'app_be') with check (current_user = 'app_be');
create policy identity_attempts_app_be_all on public.identity_attempts
    for all to app_be using (current_user = 'app_be') with check (current_user = 'app_be');

-- The account doors of a lite app: the only way app_be reaches auth.users and auth.identities (it holds no grant on schema auth). Eight
-- SECURITY DEFINER functions with a pinned search_path, EXECUTE revoked from public and the browser roles and granted to app_be alone: an
-- account comes back only for an exact address or id, a hash only for an exact address, and no door writes role or app metadata; the hash
-- is written only by a new account and by be_auth_set_password.
-- The text is the canon owner of the doors (templates/app/auth-doors.sql.partial); the back end calls them through persistence/account-doors.port.ts.

-- Looks up an address in lower case; the bootstrap index serves email as written, not lower(email).
create index if not exists users_email_lower_idx on auth.users (lower(email)) where is_anonymous = false;

-- A person by sign-in address (lower-cased), with the stored bcrypt hash so the back end can verify it.
CREATE FUNCTION public.be_auth_user_by_email(p_email text)
    RETURNS TABLE(id uuid, email text, encrypted_password text, email_confirmed_at timestamp with time zone, disabled boolean)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select u.id, u.email::text, u.encrypted_password::text, u.email_confirmed_at,
         (u.deleted_at is not null or (u.banned_until is not null and u.banned_until > now()))
    from auth.users u
   where lower(u.email) = p_email and u.is_anonymous = false
   order by u.created_at asc nulls last
   limit 1;
$$;

-- One person by id.
CREATE FUNCTION public.be_auth_user_by_id(p_user uuid)
    RETURNS TABLE(id uuid, email text, last_sign_in_at timestamp with time zone, meta jsonb, disabled boolean)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select u.id, u.email::text, u.last_sign_in_at, coalesce(u.raw_user_meta_data, '{}'::jsonb),
         (u.deleted_at is not null or (u.banned_until is not null and u.banned_until > now()))
    from auth.users u where u.id = p_user;
$$;

-- The person a Google account is linked to, if any.
CREATE FUNCTION public.be_auth_user_by_google(p_provider_id text) RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select i.user_id from auth.identities i where i.provider = 'google' and i.provider_id = p_provider_id limit 1;
$$;

-- Creates a person; a null hash is an invited or Google-only account that has no password yet.
CREATE FUNCTION public.be_auth_create_user(p_id uuid, p_email text, p_hash text, p_confirmed boolean, p_meta jsonb, p_now timestamp with time zone)
    RETURNS uuid
    LANGUAGE sql VOLATILE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, invited_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', p_id, 'authenticated', 'authenticated', p_email, p_hash,
          case when p_confirmed then p_now end, case when p_hash is null and not p_confirmed then p_now end,
          '{"provider":"email","providers":["email"]}'::jsonb, p_meta, p_now, p_now)
  returning id;
$$;

-- Links a Google account to a person.
CREATE FUNCTION public.be_auth_link_google(p_user uuid, p_provider_id text, p_data jsonb, p_now timestamp with time zone) RETURNS void
    LANGUAGE sql VOLATILE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (p_provider_id, p_user, p_data, 'google', p_now, p_now, p_now)
  on conflict (provider_id, provider) do update set last_sign_in_at = p_now, updated_at = p_now;
$$;

-- Records a sign-in; a verified Google address also confirms the mailbox; profile keys only fill what the person has not set.
CREATE FUNCTION public.be_auth_touch_user(p_user uuid, p_now timestamp with time zone, p_confirm boolean, p_meta jsonb) RETURNS void
    LANGUAGE sql VOLATILE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  update auth.users
     set last_sign_in_at = p_now,
         updated_at = p_now,
         email_confirmed_at = case when p_confirm then coalesce(email_confirmed_at, p_now) else email_confirmed_at end,
         raw_user_meta_data = p_meta || coalesce(raw_user_meta_data, '{}'::jsonb)
   where id = p_user;
$$;

-- Stamps the confirmation of a mailbox (a spent confirmation link); a mailbox that is already confirmed keeps its date and the sign-in record is untouched.
CREATE FUNCTION public.be_auth_confirm_user(p_user uuid, p_now timestamp with time zone) RETURNS void
    LANGUAGE sql VOLATILE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  update auth.users set email_confirmed_at = coalesce(email_confirmed_at, p_now), updated_at = p_now where id = p_user;
$$;

-- Sets a new password hash; when p_confirm is true (a spent reset link proved the mailbox) the address is confirmed too.
CREATE FUNCTION public.be_auth_set_password(p_user uuid, p_hash text, p_confirm boolean, p_now timestamp with time zone) RETURNS void
    LANGUAGE sql VOLATILE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  update auth.users
     set encrypted_password = p_hash,
         email_confirmed_at = case when p_confirm then coalesce(email_confirmed_at, p_now) else email_confirmed_at end,
         updated_at = p_now
   where id = p_user;
$$;

REVOKE EXECUTE ON FUNCTION public.be_auth_user_by_email(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.be_auth_user_by_email(text) TO app_be;
REVOKE EXECUTE ON FUNCTION public.be_auth_user_by_id(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.be_auth_user_by_id(uuid) TO app_be;
REVOKE EXECUTE ON FUNCTION public.be_auth_user_by_google(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.be_auth_user_by_google(text) TO app_be;
REVOKE EXECUTE ON FUNCTION public.be_auth_create_user(uuid, text, text, boolean, jsonb, timestamp with time zone) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.be_auth_create_user(uuid, text, text, boolean, jsonb, timestamp with time zone) TO app_be;
REVOKE EXECUTE ON FUNCTION public.be_auth_link_google(uuid, text, jsonb, timestamp with time zone) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.be_auth_link_google(uuid, text, jsonb, timestamp with time zone) TO app_be;
REVOKE EXECUTE ON FUNCTION public.be_auth_touch_user(uuid, timestamp with time zone, boolean, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.be_auth_touch_user(uuid, timestamp with time zone, boolean, jsonb) TO app_be;
REVOKE EXECUTE ON FUNCTION public.be_auth_confirm_user(uuid, timestamp with time zone) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.be_auth_confirm_user(uuid, timestamp with time zone) TO app_be;
REVOKE EXECUTE ON FUNCTION public.be_auth_set_password(uuid, text, boolean, timestamp with time zone) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.be_auth_set_password(uuid, text, boolean, timestamp with time zone) TO app_be;

-- The single-use links that confirm a mailbox or reset a password (the email doors of sign-in): only the sha256 of the token is
-- stored, a spent link stays marked used, and a new link of the same purpose ends the older ones.
create table public.identity_email_tokens (
    id uuid primary key,
    user_id uuid not null references auth.users (id) on delete cascade,
    purpose varchar(16) not null check (purpose in ('confirm', 'reset')),
    token_hash varchar(64) not null,
    expires_at timestamptz not null,
    used_at timestamptz,
    created_at timestamptz not null,
    constraint identity_email_tokens_hash_key unique (token_hash)
);

create index identity_email_tokens_user_idx on public.identity_email_tokens (user_id, purpose);

alter table public.identity_email_tokens enable row level security;
alter table public.identity_email_tokens force row level security;
revoke all on table public.identity_email_tokens from public;
grant select, insert, update, delete on table public.identity_email_tokens to app_be;
create policy identity_email_tokens_app_be_all on public.identity_email_tokens
    for all to app_be using (current_user = 'app_be') with check (current_user = 'app_be');

create table public.profiles (
    id uuid primary key references auth.users (id) on delete cascade,
    display_name text not null check (char_length(display_name) between 1 and 120),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.profiles force row level security;

create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function private.set_updated_at();

create policy profiles_app_be_select
on public.profiles
for select
to app_be
using (current_user = 'app_be');

create policy profiles_app_be_insert
on public.profiles
for insert
to app_be
with check (current_user = 'app_be');

create policy profiles_app_be_update
on public.profiles
for update
to app_be
using (current_user = 'app_be')
with check (current_user = 'app_be');

grant usage on schema public to app_be;
revoke all on table public.profiles from public, anon, authenticated;
grant select, insert on table public.profiles to app_be;
grant update (display_name) on table public.profiles to app_be;

-- The rate limit windows of platform/http-security: every api replica counts a caller's hits in the same row, and a hit
-- that opens a fresh window prunes a bounded batch of the ended ones.
create table public.http_security_rate_windows (
    key varchar(128) primary key,
    hits integer not null check (hits > 0),
    reset_at timestamptz not null
);

create index http_security_rate_windows_reset_at_idx on public.http_security_rate_windows (reset_at);

alter table public.http_security_rate_windows enable row level security;
alter table public.http_security_rate_windows force row level security;

create policy http_security_rate_windows_app_be_select
on public.http_security_rate_windows
for select
to app_be
using (current_user = 'app_be');

create policy http_security_rate_windows_app_be_insert
on public.http_security_rate_windows
for insert
to app_be
with check (current_user = 'app_be');

create policy http_security_rate_windows_app_be_update
on public.http_security_rate_windows
for update
to app_be
using (current_user = 'app_be')
with check (current_user = 'app_be');

create policy http_security_rate_windows_app_be_delete
on public.http_security_rate_windows
for delete
to app_be
using (current_user = 'app_be');

revoke all on table public.http_security_rate_windows from public, anon, authenticated;
grant select, insert, update, delete on table public.http_security_rate_windows to app_be;
