create type public.challenge_state as enum (
  'pending',
  'completed',
  'expired_forfeit',
  'expired_no_contest',
  'cancelled'
);

create table public.challenges (
  id                       uuid primary key default gen_random_uuid(),
  sender_id                uuid not null references public.profiles(id),
  recipient_id             uuid not null references public.profiles(id),
  problem_slug             text not null,
  problem_title            text not null,
  sender_time_ms           int  not null,
  sender_lc_runtime_pct    int,
  sender_lc_memory_pct     int,
  accepted_at              timestamptz,
  recipient_time_ms        int,
  recipient_lc_runtime_pct int,
  recipient_lc_memory_pct  int,
  state        public.challenge_state not null default 'pending',
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null,
  completed_at timestamptz,
  winner_id    uuid references public.profiles(id)
);

create index challenges_recipient_pending_idx
  on public.challenges (recipient_id, state) where state = 'pending';
create index challenges_sender_pending_idx
  on public.challenges (sender_id, state) where state = 'pending';

alter table public.challenges enable row level security;

-- SELECT: sender or recipient
create policy "Users see their own challenges"
  on public.challenges for select
  using (auth.uid() = sender_id or auth.uid() = recipient_id);

-- INSERT: sender only; recipient must be accepted friend
create policy "Sender creates challenge"
  on public.challenges for insert
  with check (
    auth.uid() = sender_id
    and state = 'pending'
    and exists (
      select 1 from public.friendships f
      where ((f.user_a = auth.uid() and f.user_b = recipient_id)
          or (f.user_b = auth.uid() and f.user_a = recipient_id))
        and f.status = 'accepted'
    )
  );

-- Column-level grants for UPDATE (shared set; RLS WITH CHECK restricts who can do what)
revoke update on public.challenges from authenticated;
grant update (
  accepted_at,
  recipient_time_ms, recipient_lc_runtime_pct, recipient_lc_memory_pct,
  state, completed_at, winner_id
) on public.challenges to authenticated;

-- UPDATE: recipient can update their columns while pending
create policy "Recipient updates challenge"
  on public.challenges for update
  using  (state = 'pending' and auth.uid() = recipient_id)
  with check (auth.uid() = recipient_id);

-- UPDATE: sender can only cancel
create policy "Sender cancels challenge"
  on public.challenges for update
  using  (state = 'pending' and auth.uid() = sender_id)
  with check (auth.uid() = sender_id and state = 'cancelled');

-- DELETE: disallowed (no policy = default deny)
