-- profiles: extends auth.users with our app-level fields
create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  handle        text not null unique,
  display_name  text not null,
  avatar_color  text not null,
  created_at    timestamptz not null default now()
);

-- Enable RLS
alter table public.profiles enable row level security;

-- Select policy: a signed-in user can read their own profile.
-- (Friend visibility is added in Phase 2 when the friendships table exists.)
create policy "Users can read own profile"
  on public.profiles
  for select
  using (auth.uid() = id);

-- Insert policy: a signed-in user can only insert their own row.
create policy "Users can create own profile"
  on public.profiles
  for insert
  with check (auth.uid() = id);

-- Update policy: a signed-in user can only update their own row.
create policy "Users can update own profile"
  on public.profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- (No delete policy — deletion cascades from auth.users on account deletion.)
