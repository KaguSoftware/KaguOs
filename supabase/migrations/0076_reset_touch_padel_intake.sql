-- Reset Touch Padel's input pack: wipe every answer they have given, so the
-- questionnaire is blank again and they start over.
--
-- DESTRUCTIVE AND NOT REVERSIBLE. There is no soft-delete on these tables and
-- no snapshot is taken here — once this runs the answers are gone. It is
-- scoped to ONE project id on purpose: never widen it to a `where` on client
-- name or on `intake_pack`, because both would match any future padel project.
--
-- The `project_intake` meta row is KEPT but rewound rather than deleted. It
-- carries `submitted_at`/`submitted_by`, and clearing the answers while leaving
-- those set would show the team a pack that is dated, signed and empty. The row
-- itself stays because 0072 treats null `submitted_at` as "still filling it in",
-- which is exactly the state a reset should land in.

begin;

delete from public.project_intake_answers
where project_id = '37024fb4-0852-4fe3-a9f8-3835f4ee4666';

delete from public.project_intake_rows
where project_id = '37024fb4-0852-4fe3-a9f8-3835f4ee4666';

update public.project_intake
set submitted_at = null,
    submitted_by = null
where project_id = '37024fb4-0852-4fe3-a9f8-3835f4ee4666';

commit;
