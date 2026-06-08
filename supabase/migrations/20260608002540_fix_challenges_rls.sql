-- Fix 1: Recipient update policy — constrain state transitions and winner_id values
drop policy if exists "Recipient updates challenge" on public.challenges;
create policy "Recipient updates challenge"
  on public.challenges for update
  using  (state = 'pending' and auth.uid() = recipient_id)
  with check (
    auth.uid() = recipient_id
    and state in ('pending', 'completed')
    and (winner_id is null or winner_id = auth.uid() or winner_id = sender_id)
  );

-- Fix 2: Sender cancel policy — disallow cancelling after recipient accepted
drop policy if exists "Sender cancels challenge" on public.challenges;
create policy "Sender cancels challenge"
  on public.challenges for update
  using  (state = 'pending' and accepted_at is null and auth.uid() = sender_id)
  with check (auth.uid() = sender_id and state = 'cancelled');
