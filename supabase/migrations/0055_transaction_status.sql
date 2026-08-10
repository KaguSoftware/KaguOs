-- A transaction can now be money that HASN'T arrived yet.
--
-- Until now a transactions row meant "this happened": an amount, a direction,
-- a date. But half of what management actually tracks is expected money — an
-- invoice sent and not yet paid, a bill due at the end of the month. Those
-- lived in people's heads (or in notes text), and the totals couldn't tell
-- settled cash from hoped-for cash.
--
-- `status` makes the distinction a column: 'pending' is recorded-but-not-
-- settled, 'paid' is done. The default is 'paid' — every existing row was
-- entered as a thing that happened, so backfilling them as paid keeps history
-- truthful, and the common case (recording money that just moved) stays a
-- one-field-shorter form.
--
-- Same shape as every status in this schema (contracts.status, debug_tasks
-- .state): text + CHECK, never a Postgres enum, so widening it later is one
-- constraint swap (see 0038). Deliberately NOT a paid_at date — "when did it
-- settle" can become a column the day someone asks for it; today the question
-- is only "is this money real yet".

alter table public.transactions
  add column status text not null default 'paid'
  check (status in ('pending', 'paid'));

-- Filterable the same way debug_tasks.state is (debug_tasks_state_idx).
create index transactions_status_idx on public.transactions (status);
