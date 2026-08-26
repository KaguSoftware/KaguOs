-- 0078: a payment plan that has no rhythm.
--
-- 0075 gave a plan two shapes, 'installments' and 'recurring', and was explicit
-- that the difference between them is only what the client is told -- the rows
-- underneath are the same either way, laid out by stepping a cadence off a
-- start date.
--
-- That covers the money that arrives on a schedule. It does not cover the money
-- that arrives on dates somebody negotiated:
--
--   $5,000 on signature
--   $7,500 when the designs are approved
--   $7,500 on launch, whenever that turns out to be
--
-- There is no cadence there to step. Today a producer either forces it into a
-- monthly plan and then edits every row's date and amount by hand, or saves an
-- empty plan and builds it from the panel -- both of which work, and both of
-- which make the form lie to them on the way through.
--
-- So: a third kind. It is a label like the other two, but unlike the other two
-- it changes what the create form does -- the generator is replaced by a list
-- of dates and amounts you type. Nothing else in the schema moves, because
-- 0075 s2(b) already stores a payment as a plain (amount, due_on) pair with no
-- reference to the plan's cadence. The rows a custom plan writes are the same
-- rows a monthly plan writes; they just aren't a month apart.
--
-- `cadence` stays not-null on the table rather than becoming nullable for this
-- kind. It is unused decoration on a custom plan, and making a column nullable
-- to express "the value here is meaningless" hands every reader a null check
-- for a case where the sensible answer is simply the default -- and would make
-- `extendPaymentPlan` (which is still reachable on these plans, and still
-- useful: "the retainer part starts now") need a branch it does not need.

begin;

alter table public.project_payment_plans
  drop constraint if exists project_payment_plans_kind_check;

alter table public.project_payment_plans
  add constraint project_payment_plans_kind_check
  check (kind in ('installments', 'recurring', 'custom'));

comment on column public.project_payment_plans.kind is
  'How the agreement is described. ''installments'' and ''recurring'' differ only in wording. ''custom'' means the schedule has no cadence at all -- the dates were negotiated one by one, and `cadence` on this row is unused.';

-- Nothing is backfilled. An existing plan whose payments happen to be irregular
-- (0075 always allowed that, by editing rows after generation) keeps whatever
-- kind it was created as. Re-labelling somebody's plan based on a guess about
-- the spacing of its rows would change a word the client reads, to no end.

commit;

-- ---------------------------------------------------------------------------
-- Invariants
-- ---------------------------------------------------------------------------
do $$
begin
  -- (a) The constraint took, and admits exactly the three kinds. Asserted by
  --     probing rather than by reading pg_get_constraintdef, because the thing
  --     that matters is what the table accepts, not how it is spelled.
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.project_payment_plans'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%custom%'
  ) then
    raise exception 'project_payment_plans still refuses kind = custom';
  end if;

  -- (b) A payment still carries no cadence of its own. The whole reason this
  --     migration is four lines instead of a new table is that 0075 stored a
  --     payment as a date and an amount; a column added here that made a row
  --     depend on its plan's rhythm would quietly undo that.
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'project_payment_installments'
      and column_name in ('cadence', 'interval', 'recurs')
  ) then
    raise exception 'a payment has grown a cadence -- see 0078''s header';
  end if;
end $$;
