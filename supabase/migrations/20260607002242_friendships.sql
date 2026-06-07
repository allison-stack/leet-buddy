-- =============================================================================
-- Friendships: bidirectional pair rows stored in canonical order (user_a < user_b).
-- =============================================================================

create type public.friendship_status as enum ('pending', 'accepted');

create table public.friendships (
  id            uuid primary key default gen_random_uuid(),
  user_a        uuid not null references public.profiles(id) on delete cascade,
  user_b        uuid not null references public.profiles(id) on delete cascade,
  status        public.friendship_status not null default 'pending',
  requested_by  uuid not null references public.profiles(id),
  created_at    timestamptz not null default now(),
  constraint user_a_lt_user_b check (user_a < user_b),
  unique (user_a, user_b)
);

-- user_a is covered by the UNIQUE index. Add user_b for the OR-branch in
-- friend-row visibility lookups.
create index friendships_user_b_idx on public.friendships (user_b);

alter table public.friendships enable row level security;

-- -----------------------------------------------------------------------------
-- SELECT: I can see any friendship row I'm part of (pending or accepted).
-- -----------------------------------------------------------------------------
create policy "Users see their own friendships"
  on public.friendships
  for select
  using (auth.uid() = user_a or auth.uid() = user_b);

-- -----------------------------------------------------------------------------
-- INSERT: disallowed for `authenticated`. The request_friendship() RPC is the
-- single insertion path (it runs SECURITY DEFINER, looks up the target by
-- handle or email, enforces canonical ordering, and sets requested_by).
-- -----------------------------------------------------------------------------
-- (No insert policy defined; default-deny under RLS.)

-- -----------------------------------------------------------------------------
-- UPDATE: only the recipient (not requested_by) can flip pending → accepted.
-- Column grants restrict which columns can change.
-- -----------------------------------------------------------------------------
revoke update on public.friendships from authenticated;
grant  update (status) on public.friendships to authenticated;

create policy "Recipient accepts a pending request"
  on public.friendships
  for update
  using (
    status = 'pending'
    and (auth.uid() = user_a or auth.uid() = user_b)
    and auth.uid() <> requested_by
  )
  with check (status = 'accepted');

-- -----------------------------------------------------------------------------
-- DELETE: either party can remove an accepted friendship. Pending requests are
-- not deletable in v1 (recipient ignores or accepts; sender has no cancel UI in
-- Phase 2 — defer to a later phase if needed).
-- -----------------------------------------------------------------------------
create policy "Either party can remove an accepted friendship"
  on public.friendships
  for delete
  using (
    status = 'accepted'
    and (auth.uid() = user_a or auth.uid() = user_b)
  );

-- =============================================================================
-- Extend profiles SELECT so friends/counterparties are visible.
-- The Phase 1 policy ("Users can read own profile") stays; we add a second
-- policy that ORs in friend visibility. Postgres applies policies as OR for
-- the same command, so either policy passing is enough.
-- =============================================================================
create policy "Users can read profiles linked via friendship"
  on public.profiles
  for select
  using (
    exists (
      select 1
      from public.friendships f
      where (f.user_a = auth.uid() and f.user_b = public.profiles.id)
         or (f.user_b = auth.uid() and f.user_a = public.profiles.id)
    )
  );

-- =============================================================================
-- request_friendship(target text) — the only path that can resolve a handle
-- or email belonging to a user you haven't met yet. SECURITY DEFINER bypasses
-- RLS on profiles (handle lookup) and reads auth.users.email (email lookup).
-- It sets canonical ordering and never trusts the caller for requested_by.
-- =============================================================================
create or replace function public.request_friendship(target text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  me         uuid := auth.uid();
  target_id  uuid;
  a          uuid;
  b          uuid;
  existing   public.friendships%rowtype;
  new_id     uuid;
  normalized text := lower(trim(target));
begin
  if me is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;

  if normalized = '' then
    return jsonb_build_object('status', 'not_found');
  end if;

  -- 1. Handle match (case-insensitive).
  select id into target_id
  from public.profiles
  where lower(handle) = normalized
  limit 1;

  -- 2. Email match against auth.users (only reachable via SECURITY DEFINER).
  if target_id is null then
    select u.id into target_id
    from auth.users u
    where lower(u.email) = normalized
      and exists (select 1 from public.profiles p where p.id = u.id)
    limit 1;
  end if;

  if target_id is null then
    return jsonb_build_object('status', 'not_found');
  end if;

  if target_id = me then
    return jsonb_build_object('status', 'self');
  end if;

  if me < target_id then
    a := me; b := target_id;
  else
    a := target_id; b := me;
  end if;

  select * into existing
  from public.friendships
  where user_a = a and user_b = b;

  if found then
    if existing.status = 'accepted' then
      return jsonb_build_object('status', 'already_accepted', 'friendship_id', existing.id);
    else
      return jsonb_build_object('status', 'already_pending', 'friendship_id', existing.id);
    end if;
  end if;

  insert into public.friendships (user_a, user_b, status, requested_by)
  values (a, b, 'pending', me)
  returning id into new_id;

  return jsonb_build_object('status', 'created', 'friendship_id', new_id);
end;
$$;

revoke all on function public.request_friendship(text) from public;
grant  execute on function public.request_friendship(text) to authenticated;
